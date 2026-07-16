import json
import sqlite3
from pathlib import Path

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
            date_time TEXT NOT NULL,
            max_players INTEGER NOT NULL DEFAULT 10,
            player_count INTEGER NOT NULL DEFAULT 0,
            player_names TEXT NOT NULL DEFAULT '[]',
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


def build_player(first_name, last_name, skill_level, age_range, is_host=False):
    return {
        "first_name": first_name,
        "last_name": last_name,
        "skill_level": skill_level,
        "age_range": age_range,
        "is_host": is_host,
    }


def row_to_game(row):
    """Convert a database row into a dictionary for the API."""
    return {
        "id": row["id"],
        "title": row["title"],
        "location": row["location"],
        "zip_code": row["zip_code"] if "zip_code" in row.keys() else "92880",
        "date_time": row["date_time"],
        "max_players": row["max_players"],
        "player_count": row["player_count"],
        "player_names": json.loads(row["player_names"]),
        "status": row["status"],
        "created_at": row["created_at"],
    }
