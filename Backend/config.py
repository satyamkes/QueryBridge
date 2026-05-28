"""
QueryBridge – Centralised Configuration
All tuneable values live here. Override any of them by setting the
corresponding environment variable (or creating a .env file and using
python-dotenv to load it).
"""

import os
from dotenv import load_dotenv

# Load .env if present (safe to call even when the file is absent)
load_dotenv()


class Config:
    # ── Flask ─────────────────────────────────────────────────────────────────
    HOST  = os.getenv("FLASK_HOST",  "0.0.0.0")
    PORT  = int(os.getenv("FLASK_PORT", 5000))
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed frontend origins.
    # The React dev server runs on 5173 by default.
    _cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",")]

    # ── PostgreSQL ────────────────────────────────────────────────────────────
    PG_HOST     = os.getenv("PG_HOST",     "localhost")
    PG_PORT     = int(os.getenv("PG_PORT", 5432))
    PG_DATABASE = os.getenv("PG_DATABASE", "querybridge")
    PG_USER     = os.getenv("PG_USER",     "postgres")
    PG_PASSWORD = os.getenv("PG_PASSWORD", "postgres")
    PG_VERSION  = os.getenv("PG_VERSION",  "16")
    PG_SSLMODE  = os.getenv("PG_SSLMODE",  "require")

    # Connection pool sizing
    PG_MIN_CONN = int(os.getenv("PG_MIN_CONN", 1))
    PG_MAX_CONN = int(os.getenv("PG_MAX_CONN", 10))

    # ── Ollama LLM ────────────────────────────────────────────────────────────
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "llama3")

    # How long (seconds) to wait for Ollama before timing out
    OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", 30))

    # ── Safety ────────────────────────────────────────────────────────────────
    # Maximum length of the natural-language prompt accepted by /api/generate
    MAX_PROMPT_LENGTH = int(os.getenv("MAX_PROMPT_LENGTH", 500))

    # SQL keywords that are never allowed in generated queries.
    # The LLM prompt also instructs the model to produce only SELECT statements,
    # but this list acts as a second line of defence.
    BLOCKED_SQL_KEYWORDS = [
        "DROP", "DELETE", "TRUNCATE", "ALTER",
        "INSERT", "UPDATE", "CREATE", "GRANT", "REVOKE",
    ]
