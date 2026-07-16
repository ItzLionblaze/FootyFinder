import os
from datetime import datetime, timedelta, timezone

import jwt
import requests

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "footyfinder-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7


def verify_google_token(token: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID is not configured on the backend")

    response = requests.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": token},
        timeout=10,
    )

    if response.status_code != 200:
        raise ValueError("Invalid Google token")

    idinfo = response.json()

    if idinfo.get("aud") != GOOGLE_CLIENT_ID:
        raise ValueError("Google token is not for this app")

    if idinfo.get("email_verified") not in (True, "true"):
        raise ValueError("Google email is not verified")

    return idinfo


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid or expired token") from exc
