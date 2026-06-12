"""
QueryBridge authentication helpers.
Uses Werkzeug password hashing and compact HMAC-signed bearer tokens.
"""

import base64
import hashlib
import hmac
import json
import time
from functools import wraps

from flask import g, request
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config
from db import db_connection


def _b64_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "iat": int(time.time()),
        "exp": int(time.time()) + Config.AUTH_TOKEN_TTL_SECONDS,
    }
    payload_part = _b64_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        Config.SECRET_KEY.encode("utf-8"),
        payload_part.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{payload_part}.{_b64_encode(signature)}"


def verify_token(token: str) -> dict | None:
    try:
        payload_part, signature_part = token.split(".", 1)
        expected_signature = hmac.new(
            Config.SECRET_KEY.encode("utf-8"),
            payload_part.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        actual_signature = _b64_decode(signature_part)
        if not hmac.compare_digest(expected_signature, actual_signature):
            return None

        payload = json.loads(_b64_decode(payload_part))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def sanitize_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def create_user(name: str, email: str, password: str) -> dict:
    password_hash = generate_password_hash(password)
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO auth_users (name, email, password_hash)
                VALUES (%s, %s, %s)
                RETURNING id, name, email, created_at;
                """,
                (name, email, password_hash),
            )
            row = cur.fetchone()
    return sanitize_user({
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "created_at": row[3],
    })


def find_user_by_email(email: str) -> dict | None:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, email, password_hash, created_at
                FROM auth_users
                WHERE email = %s;
                """,
                (email,),
            )
            row = cur.fetchone()

    if not row:
        return None

    return {
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "password_hash": row[3],
        "created_at": row[4],
    }


def authenticate_user(email: str, password: str) -> dict | None:
    user = find_user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return None
    return sanitize_user(user)


def get_current_user() -> dict | None:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    payload = verify_token(auth_header.removeprefix("Bearer ").strip())
    if not payload:
        return None

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, email, created_at
                FROM auth_users
                WHERE id = %s;
                """,
                (payload["sub"],),
            )
            row = cur.fetchone()

    if not row:
        return None

    return sanitize_user({
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "created_at": row[3],
    })


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = get_current_user()
        if not user:
            return {"status": "error", "message": "Authentication required."}, 401
        g.current_user = user
        return view(*args, **kwargs)

    return wrapped
