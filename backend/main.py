from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json

load_dotenv()

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

# Allow the Next.js frontend (localhost:3000) to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SKILL_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}
AGE_RANGES = {"Under 18", "18-25", "26-35", "36-45", "46+", "All ages"}


class GameCreate(BaseModel):
    title: str
    date_time: str
    first_name: str
    last_name: str
    skill_level: str
    age_range: str
    location: str = "Eastvale, CA"
    zip_code: str = "92880"
    max_players: int = 10


class GoogleAuthRequest(BaseModel):
    token: str


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


def _parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
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
    rows = connection.execute(
        "SELECT * FROM games WHERE status = 'active' ORDER BY date_time ASC"
    ).fetchall()
    connection.close()

    games = [row_to_game(row) for row in rows]

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


@app.post("/games")
def create_game(game: GameCreate):
    if game.skill_level not in SKILL_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid skill level")

    if game.age_range not in AGE_RANGES:
        raise HTTPException(status_code=400, detail="Invalid age range")

    host = build_player(
        game.first_name.strip(),
        game.last_name.strip(),
        game.skill_level,
        game.age_range,
        is_host=True,
    )
    players_json = json.dumps([host])

    connection = get_connection()
    cursor = connection.execute(
        """
        INSERT INTO games (title, location, zip_code, date_time, max_players, player_count, player_names)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            game.title.strip(),
            game.location.strip(),
            game.zip_code.strip(),
            game.date_time,
            game.max_players,
            1,
            players_json,
        ),
    )
    connection.commit()

    new_row = connection.execute(
        "SELECT * FROM games WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    connection.close()

    return row_to_game(new_row)
