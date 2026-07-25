import json
import sqlite3
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# Database file lives in the backend folder
DATABASE_PATH = Path(__file__).parent / "footyfinder.db"


def get_connection():
    """Open a connection to the SQLite database."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    """Create the games table if it does not exist yet."""
    connection = get_connection()
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            location TEXT NOT NULL DEFAULT 'Eastvale, CA',
            zip_code TEXT NOT NULL DEFAULT '92880',
            latitude REAL,
            longitude REAL,
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
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    columns = [
        row[1] for row in connection.execute("PRAGMA table_info(games)").fetchall()
    ]
    if "zip_code" not in columns:
        connection.execute(
            "ALTER TABLE games ADD COLUMN zip_code TEXT NOT NULL DEFAULT '92880'"
        )
    optional_columns = {
        "latitude": "REAL",
        "longitude": "REAL",
        "place_id": "TEXT",
        "place_address": "TEXT",
        "host_user_id": "INTEGER",
        "min_players": "INTEGER NOT NULL DEFAULT 10",
        "score_team_a": "INTEGER",
        "score_team_b": "INTEGER",
    }
    for column_name, column_type in optional_columns.items():
        if column_name not in columns:
            connection.execute(
                f"ALTER TABLE games ADD COLUMN {column_name} {column_type}"
            )

    connection.commit()
    connection.close()


def init_users_table():
    """Create the users table for Google sign-in."""
    connection = get_connection()
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_id TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            first_name TEXT NOT NULL DEFAULT '',
            last_name TEXT NOT NULL DEFAULT '',
            picture TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    connection.close()
    return row


def upsert_user(google_id, email, first_name, last_name, picture):
    connection = get_connection()
    existing = connection.execute(
        "SELECT * FROM users WHERE google_id = ?", (google_id,)
    ).fetchone()

    if existing:
        connection.execute(
            """
            UPDATE users
            SET email = ?, first_name = ?, last_name = ?, picture = ?
            WHERE google_id = ?
            """,
            (email, first_name, last_name, picture, google_id),
        )
        user_id = existing["id"]
    else:
        cursor = connection.execute(
            """
            INSERT INTO users (google_id, email, first_name, last_name, picture)
            VALUES (?, ?, ?, ?, ?)
            """,
            (google_id, email, first_name, last_name, picture),
        )
        user_id = cursor.lastrowid

    connection.commit()
    row = connection.execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
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
        row["min_players"]
        if "min_players" in row.keys() and row["min_players"] is not None
        else max_players
    )

    if max_players > 0 and player_count >= max_players:
        return "full"
    if player_count >= min_players:
        return "confirmed"
    return "looking_for_players"


def row_to_game(row):
    """Convert a database row into a dictionary for the API."""
    min_players = (
        row["min_players"]
        if "min_players" in row.keys() and row["min_players"] is not None
        else row["max_players"]
    )

    return {
        "id": row["id"],
        "title": row["title"],
        "location": row["location"],
        "zip_code": row["zip_code"] if "zip_code" in row.keys() else "92880",
        "latitude": row["latitude"] if "latitude" in row.keys() else None,
        "longitude": row["longitude"] if "longitude" in row.keys() else None,
        "place_id": row["place_id"] if "place_id" in row.keys() else None,
        "place_address": (
            row["place_address"] if "place_address" in row.keys() else None
        ),
        "date_time": row["date_time"],
        "min_players": min_players,
        "max_players": row["max_players"],
        "player_count": row["player_count"],
        "player_names": json.loads(row["player_names"]),
        "host_user_id": (
            row["host_user_id"] if "host_user_id" in row.keys() else None
        ),
        "score_team_a": (
            row["score_team_a"] if "score_team_a" in row.keys() else None
        ),
        "score_team_b": (
            row["score_team_b"] if "score_team_b" in row.keys() else None
        ),
        "status": compute_game_status(row),
        "created_at": row["created_at"],
    }
