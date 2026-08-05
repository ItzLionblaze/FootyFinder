"""Send transactional emails over Gmail SMTP (or any SMTP server)."""

from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(
        (os.environ.get("SMTP_USER") or "").strip()
        and (os.environ.get("SMTP_PASSWORD") or "").strip()
    )


def _smtp_settings():
    return {
        "host": (os.environ.get("SMTP_HOST") or "smtp.gmail.com").strip(),
        "port": int((os.environ.get("SMTP_PORT") or "587").strip()),
        "user": (os.environ.get("SMTP_USER") or "").strip(),
        "password": (os.environ.get("SMTP_PASSWORD") or "").strip(),
        "from_email": (
            (os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER") or "").strip()
        ),
        "from_name": (os.environ.get("SMTP_FROM_NAME") or "FootyFinder").strip(),
    }


def send_email(to_email: str, subject: str, text_body: str, html_body: Optional[str] = None) -> bool:
    """Send one email. Returns True on success. Never raises to callers."""
    if not to_email or not to_email.strip():
        return False

    settings = _smtp_settings()
    if not settings["user"] or not settings["password"] or not settings["from_email"]:
        logger.warning("SMTP is not configured; skipped email to %s", to_email)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f'{settings["from_name"]} <{settings["from_email"]}>'
    message["To"] = to_email.strip()
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings["host"], settings["port"], timeout=30) as server:
            server.starttls()
            server.login(settings["user"], settings["password"])
            server.send_message(message)
        logger.info("Sent email to %s (%s)", to_email, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


def format_game_when(date_time: Optional[str]) -> str:
    if not date_time:
        return "TBD"
    return str(date_time).replace("T", " ")


def notify_game_confirmed(game: dict, recipient_emails: Iterable[str]) -> int:
    """Email everyone that the game reached its confirm threshold. Returns send count."""
    frontend_url = (
        os.environ.get("FRONTEND_URL") or "https://footy-finder-seven.vercel.app"
    ).rstrip("/")
    my_games_url = f"{frontend_url}/my-games"

    title = game.get("title") or "Pickup soccer game"
    location = game.get("location") or "the park"
    zip_code = game.get("zip_code") or ""
    when = format_game_when(game.get("date_time"))
    player_count = game.get("player_count") or 0
    min_players = game.get("min_players") or player_count
    place_line = f"{location}" + (f" ({zip_code})" if zip_code else "")

    subject = f"FootyFinder: “{title}” is confirmed"
    text_body = (
        f"Good news — “{title}” now has enough players and is confirmed.\n\n"
        f"When: {when}\n"
        f"Where: {place_line}\n"
        f"Players: {player_count} (confirmed at {min_players})\n\n"
        f"View your games: {my_games_url}\n\n"
        "See you on the pitch!\n"
        "— FootyFinder\n"
    )
    html_body = f"""
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #18181b;">
      <p>Good news — <strong>{title}</strong> now has enough players and is confirmed.</p>
      <p>
        <strong>When:</strong> {when}<br/>
        <strong>Where:</strong> {place_line}<br/>
        <strong>Players:</strong> {player_count} (confirmed at {min_players})
      </p>
      <p><a href="{my_games_url}">View your games</a></p>
      <p>See you on the pitch!<br/>— FootyFinder</p>
    </div>
    """

    sent = 0
    seen = set()
    for email in recipient_emails:
        normalized = (email or "").strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        if send_email(email.strip(), subject, text_body, html_body):
            sent += 1
    return sent
