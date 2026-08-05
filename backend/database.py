import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg
from psycopg.rows import dict_row

DATABASE_URL_DEFAULT = "postgresql://shabana@localhost:5432/footyfinder"


def get_connection():
    """Open a connection to the PostgreSQL database."""
    database_url = os.environ.get("DATABASE_URL", DATABASE_URL_DEFAULT)
    return psycopg.connect(database_url, row_factory=dict_row)


def init_db():
    """Create the games table if it does not exist yet."""
    connection = get_connection()
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS games (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            location TEXT NOT NULL DEFAULT 'Eastvale, CA',
            zip_code TEXT NOT NULL DEFAULT '92880',
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            place_id TEXT,
            place_address TEXT,
            date_time TEXT NOT NULL,
            min_players INTEGER NOT NULL DEFAULT 10,
            max_players INTEGER NOT NULL DEFAULT 20,
            player_count INTEGER NOT NULL DEFAULT 0,
            player_names TEXT NOT NULL DEFAULT '[]',
            host_user_id INTEGER,
            score_team_a INTEGER,
            score_team_b INTEGER,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.commit()
    connection.close()


def init_users_table():
    """Create the users table for Google sign-in."""
    connection = get_connection()
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            google_id TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            first_name TEXT NOT NULL DEFAULT '',
            last_name TEXT NOT NULL DEFAULT '',
            picture TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.commit()
    connection.close()


def row_to_user(row):
    """Convert a database row into a user dictionary for the API."""
    return {
        "id": row["id"],
        "email": row["email"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "picture": row["picture"],
    }


def get_user_by_id(user_id):
    connection = get_connection()
    row = connection.execute(
        "SELECT * FROM users WHERE id = %s", (user_id,)
    ).fetchone()
    connection.close()
    return row


def get_user_emails_by_ids(user_ids):
    """Return verified Google account emails for the given user ids."""
    ids = sorted({int(user_id) for user_id in user_ids if user_id is not None})
    if not ids:
        return []

    connection = get_connection()
    placeholders = ", ".join(["%s"] * len(ids))
    rows = connection.execute(
        f"SELECT id, email FROM users WHERE id IN ({placeholders})",
        ids,
    ).fetchall()
    connection.close()

    emails = []
    for row in rows:
        email = (row.get("email") or "").strip()
        if email:
            emails.append(email)
    return emails


def upsert_user(google_id, email, first_name, last_name, picture):
    connection = get_connection()
    existing = connection.execute(
        "SELECT * FROM users WHERE google_id = %s", (google_id,)
    ).fetchone()

    if existing:
        connection.execute(
            """
            UPDATE users
            SET email = %s, first_name = %s, last_name = %s, picture = %s
            WHERE google_id = %s
            """,
            (email, first_name, last_name, picture, google_id),
        )
        user_id = existing["id"]
    else:
        row = connection.execute(
            """
            INSERT INTO users (google_id, email, first_name, last_name, picture)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (google_id, email, first_name, last_name, picture),
        ).fetchone()
        user_id = row["id"]

    connection.commit()
    row = connection.execute(
        "SELECT * FROM users WHERE id = %s", (user_id,)
    ).fetchone()
    connection.close()
    return row


def build_player(
    first_name, last_name, skill_level, age_range, is_host=False, user_id=None
):
    player = {
        "first_name": first_name,
        "last_name": last_name,
        "skill_level": skill_level,
        "age_range": age_range,
        "is_host": is_host,
    }
    if user_id is not None:
        player["user_id"] = user_id
    return player


def compute_game_status(row):
    """Derive display status from cancel flag, schedule time, and roster size."""
    if row["status"] == "cancelled":
        return "cancelled"

    try:
        scheduled_at = datetime.fromisoformat(row["date_time"])
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=ZoneInfo("America/Los_Angeles"))
        if scheduled_at <= datetime.now(ZoneInfo("America/Los_Angeles")):
            return "completed"
    except (TypeError, ValueError):
        pass

    player_count = row["player_count"] or 0
    max_players = row["max_players"] or 0
    min_players = (
        row["min_players"] if row.get("min_players") is not None else max_players
    )

    if max_players > 0 and player_count >= max_players:
        return "full"
    if player_count >= min_players:
        return "confirmed"
    return "looking_for_players"


def row_to_game(row):
    """Convert a database row into a dictionary for the API."""
    min_players = (
        row["min_players"] if row.get("min_players") is not None else row["max_players"]
    )
    player_names = row["player_names"]
    if isinstance(player_names, str):
        player_names = json.loads(player_names)

    created_at = row["created_at"]
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()

    return {
        "id": row["id"],
        "title": row["title"],
        "location": row["location"],
        "zip_code": row.get("zip_code") or "92880",
        "latitude": row.get("latitude"),
        "longitude": row.get("longitude"),
        "place_id": row.get("place_id"),
        "place_address": row.get("place_address"),
        "date_time": row["date_time"],
        "min_players": min_players,
        "max_players": row["max_players"],
        "player_count": row["player_count"],
        "player_names": player_names,
        "host_user_id": row.get("host_user_id"),
        "score_team_a": row.get("score_team_a"),
        "score_team_b": row.get("score_team_b"),
        "status": compute_game_status(row),
        "created_at": created_at,
    }
