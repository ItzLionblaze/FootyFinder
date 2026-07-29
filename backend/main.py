from typing import Optional
from pathlib import Path
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json

load_dotenv(Path(__file__).resolve().parent / ".env")

from auth import create_access_token, decode_access_token, verify_google_token
from database import (
    build_player,
    get_connection,
    get_user_by_id,
    init_db,
    init_users_table,
    row_to_game,
    row_to_user,
    upsert_user,
)

app = FastAPI(title="FootyFinder API")

# Comma-separated list, e.g. "http://localhost:3000,https://your-app.vercel.app"
_cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

SKILL_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}
AGE_RANGES = {"12+", "18+", "12-17"}


class GameCreate(BaseModel):
    title: str
    date_time: str
    first_name: str
    last_name: str
    skill_level: str
    age_range: str
    location: str = "Eastvale, CA"
    zip_code: str = "92880"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_id: Optional[str] = None
    place_address: Optional[str] = None
    min_players: int = 10
    max_players: int = 20


class GoogleAuthRequest(BaseModel):
    token: str


class GameScoreUpdate(BaseModel):
    score_team_a: int
    score_team_b: int


@app.on_event("startup")
def on_startup():
    init_db()
    init_users_table()


@app.get("/")
def read_root():
    return {"message": "Welcome to FootyFinder API"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


def _parse_bearer_token(authorization: Optional[str] = None) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization.removeprefix("Bearer ").strip()


def _get_current_user(authorization: Optional[str] = Header(None)):
    token = _parse_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        user_id = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    row = get_user_by_id(user_id)
    if not row:
        raise HTTPException(status_code=401, detail="User not found")

    return row_to_user(row)


@app.post("/auth/google")
def google_auth(body: GoogleAuthRequest):
    try:
        idinfo = verify_google_token(body.token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Google token") from exc

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    first_name = idinfo.get("given_name", "")
    last_name = idinfo.get("family_name", "")

    if not first_name and idinfo.get("name"):
        name_parts = idinfo["name"].split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

    picture = idinfo.get("picture", "")
    row = upsert_user(google_id, email, first_name, last_name, picture)
    user = row_to_user(row)
    access_token = create_access_token(user["id"])

    return {"access_token": access_token, "user": user}


@app.get("/auth/me")
def auth_me(authorization: Optional[str] = Header(None)):
    return _get_current_user(authorization)


@app.get("/games")
def list_games(zip_code: Optional[str] = None, host_name: Optional[str] = None):
    connection = get_connection()
    rows = connection.execute("SELECT * FROM games").fetchall()
    connection.close()

    games = [row_to_game(row) for row in rows]
    status_order = {
        "looking_for_players": 0,
        "confirmed": 1,
        "full": 2,
        "cancelled": 3,
        "completed": 4,
    }
    games.sort(
        key=lambda game: (
            status_order.get(game["status"], 3),
            game["date_time"],
        )
    )

    if zip_code and zip_code.strip():
        zip_query = zip_code.strip()
        games = [
            game
            for game in games
            if zip_query in (game.get("zip_code") or "")
        ]

    if host_name and host_name.strip():
        name_query = host_name.strip().lower()
        games = [game for game in games if _game_matches_host(game, name_query)]

    return games


def _game_matches_host(game, name_query):
    for player in game.get("player_names", []):
        if not player.get("is_host"):
            continue
        first_name = (player.get("first_name") or "").lower()
        last_name = (player.get("last_name") or "").lower()
        full_name = f"{first_name} {last_name}".strip()
        if (
            name_query in full_name
            or name_query in first_name
            or name_query in last_name
        ):
            return True
    return False


@app.get("/parks/recent")
def recent_parks(authorization: Optional[str] = Header(None)):
    """Return unique parks this user has already hosted games at."""
    current_user = _get_current_user(authorization)
    connection = get_connection()
    rows = connection.execute(
        """
        SELECT location, zip_code, latitude, longitude, place_id, place_address, created_at
        FROM games
        WHERE host_user_id = %s
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        ORDER BY created_at DESC, id DESC
        """,
        (current_user["id"],),
    ).fetchall()
    connection.close()

    parks = []
    seen = set()
    for row in rows:
        place_key = row["place_id"] or f"{row['latitude']},{row['longitude']}"
        if place_key in seen:
            continue
        seen.add(place_key)
        parks.append(
            {
                "location": row["location"],
                "zip_code": row["zip_code"] or "",
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "place_id": row["place_id"] or "",
                "place_address": row["place_address"] or "",
            }
        )
        if len(parks) >= 8:
            break

    return parks


@app.post("/games")
def create_game(
    game: GameCreate, authorization: Optional[str] = Header(None)
):
    current_user = _get_current_user(authorization)

    if game.skill_level not in SKILL_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid skill level")

    if game.age_range not in AGE_RANGES:
        raise HTTPException(status_code=400, detail="Invalid age range")

    if (game.latitude is None) != (game.longitude is None):
        raise HTTPException(
            status_code=400, detail="Latitude and longitude must be provided together"
        )
    if game.latitude is not None and not -90 <= game.latitude <= 90:
        raise HTTPException(status_code=400, detail="Invalid latitude")
    if game.longitude is not None and not -180 <= game.longitude <= 180:
        raise HTTPException(status_code=400, detail="Invalid longitude")

    if game.min_players < 2:
        raise HTTPException(status_code=400, detail="Minimum players must be at least 2")
    if game.max_players > 30:
        raise HTTPException(status_code=400, detail="Maximum players cannot exceed 30")
    if game.min_players > game.max_players:
        raise HTTPException(
            status_code=400,
            detail="Minimum players cannot be greater than maximum players",
        )

    host = build_player(
        current_user["first_name"] or game.first_name.strip(),
        current_user["last_name"] or game.last_name.strip(),
        game.skill_level,
        game.age_range,
        is_host=True,
        user_id=current_user["id"],
    )
    players_json = json.dumps([host])

    connection = get_connection()
    inserted = connection.execute(
        """
        INSERT INTO games (
            title, location, zip_code, latitude, longitude, place_id,
            place_address, date_time, min_players, max_players, player_count,
            player_names, host_user_id
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            game.title.strip(),
            game.location.strip(),
            game.zip_code.strip(),
            game.latitude,
            game.longitude,
            game.place_id.strip() if game.place_id else None,
            game.place_address.strip() if game.place_address else None,
            game.date_time,
            game.min_players,
            game.max_players,
            1,
            players_json,
            current_user["id"],
        ),
    ).fetchone()
    connection.commit()

    new_row = connection.execute(
        "SELECT * FROM games WHERE id = %s", (inserted["id"],)
    ).fetchone()
    connection.close()

    return row_to_game(new_row)


@app.patch("/games/{game_id}/cancel")
def cancel_game(
    game_id: int, authorization: Optional[str] = Header(None)
):
    current_user = _get_current_user(authorization)
    connection = get_connection()
    row = connection.execute(
        "SELECT * FROM games WHERE id = %s", (game_id,)
    ).fetchone()

    if not row:
        connection.close()
        raise HTTPException(status_code=404, detail="Game not found")

    if row["host_user_id"] != current_user["id"]:
        connection.close()
        raise HTTPException(
            status_code=403, detail="Only the game host can cancel this game"
        )

    game = row_to_game(row)
    if game["status"] == "completed":
        connection.close()
        raise HTTPException(
            status_code=400, detail="Completed games cannot be cancelled"
        )

    if row["status"] != "cancelled":
        connection.execute(
            "UPDATE games SET status = %s WHERE id = %s", ("cancelled", game_id)
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM games WHERE id = %s", (game_id,)
        ).fetchone()

    connection.close()
    return row_to_game(row)


@app.post("/games/{game_id}/join")
def join_game(game_id: int, authorization: Optional[str] = Header(None)):
    current_user = _get_current_user(authorization)
    connection = get_connection()
    row = connection.execute(
        "SELECT * FROM games WHERE id = %s", (game_id,)
    ).fetchone()

    if not row:
        connection.close()
        raise HTTPException(status_code=404, detail="Game not found")

    game = row_to_game(row)

    if game["status"] == "cancelled":
        connection.close()
        raise HTTPException(status_code=400, detail="This game was cancelled")
    if game["status"] == "completed":
        connection.close()
        raise HTTPException(status_code=400, detail="This game is already completed")
    if game["status"] == "full":
        connection.close()
        raise HTTPException(status_code=400, detail="This game is full")

    players = list(game["player_names"])
    already_joined = any(
        player.get("user_id") == current_user["id"]
        or (
            player.get("is_host")
            and game.get("host_user_id") == current_user["id"]
        )
        for player in players
    )
    if already_joined:
        connection.close()
        raise HTTPException(status_code=400, detail="You already joined this game")

    if game["host_user_id"] == current_user["id"]:
        connection.close()
        raise HTTPException(status_code=400, detail="You are already the host of this game")

    players.append(
        build_player(
            current_user["first_name"] or "Player",
            current_user["last_name"] or "",
            "Intermediate",
            "18+",
            is_host=False,
            user_id=current_user["id"],
        )
    )
    new_count = len(players)

    connection.execute(
        """
        UPDATE games
        SET player_names = %s, player_count = %s
        WHERE id = %s
        """,
        (json.dumps(players), new_count, game_id),
    )
    connection.commit()
    updated = connection.execute(
        "SELECT * FROM games WHERE id = %s", (game_id,)
    ).fetchone()
    connection.close()
    return row_to_game(updated)


@app.patch("/games/{game_id}/score")
def set_game_score(
    game_id: int,
    body: GameScoreUpdate,
    authorization: Optional[str] = Header(None),
):
    current_user = _get_current_user(authorization)
    connection = get_connection()
    row = connection.execute(
        "SELECT * FROM games WHERE id = %s", (game_id,)
    ).fetchone()

    if not row:
        connection.close()
        raise HTTPException(status_code=404, detail="Game not found")

    if row["host_user_id"] != current_user["id"]:
        connection.close()
        raise HTTPException(
            status_code=403, detail="Only the game host can post the score"
        )

    game = row_to_game(row)
    if game["status"] != "completed":
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="Scores can only be posted after the game has ended",
        )

    if body.score_team_a < 0 or body.score_team_b < 0:
        connection.close()
        raise HTTPException(status_code=400, detail="Scores cannot be negative")

    connection.execute(
        """
        UPDATE games
        SET score_team_a = %s, score_team_b = %s
        WHERE id = %s
        """,
        (body.score_team_a, body.score_team_b, game_id),
    )
    connection.commit()
    updated = connection.execute(
        "SELECT * FROM games WHERE id = %s", (game_id,)
    ).fetchone()
    connection.close()
    return row_to_game(updated)
