"""
QueryBridge – Centralised Configuration
All tuneable values live here. Override any of them by setting the
corresponding environment variable (or creating a .env file and using
python-dotenv to load it).
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
   
    HOST  = os.getenv("FLASK_HOST",  "0.0.0.0")
    PORT  = int(os.getenv("FLASK_PORT", 5000))
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")

    AUTH_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", 60 * 60 * 24 * 7))

    _cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000")
    CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",")]

    
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

    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "llama3")

    OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", 30))

    MAX_PROMPT_LENGTH = int(os.getenv("MAX_PROMPT_LENGTH", 500))

    BLOCKED_SQL_KEYWORDS = [
        "DROP", "DELETE", "TRUNCATE", "ALTER",
        "INSERT", "UPDATE", "CREATE", "GRANT", "REVOKE",
    ]
