"""
QueryBridge - Flask API Gateway
Natural Language → SQL Translation Engine

Endpoints:
  POST /api/generate   → translate prompt to SQL & execute
  GET  /api/health     → service status check
  GET  /api/schema     → expose live DB table metadata
"""

import time
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS

from config import Config
from db import db_connection, fetch_schema_info
from llm import translate_to_sql, count_tokens

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}})


def success_response(data: dict, status: int = 200):
    return jsonify({"status": "ok", **data}), status


def error_response(message: str, status: int = 400):
    return jsonify({"status": "error", "message": message}), status


@app.route("/api/health", methods=["GET"])
def health():
    """
    Health-check endpoint.
    The React frontend pings this to decide whether to show LIVE CORE or
    Quantum Simulation mode in the Navbar status badge.

    Returns 200 with service info when everything is reachable.
    """
    db_ok = False
    db_error = None
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            db_ok = True
    except Exception as exc:
        db_error = str(exc)
        logger.warning("Health check – DB unreachable: %s", exc)

    return success_response({
        "service": "QueryBridge API",
        "version": "1.0.0",
        "llm_model": Config.OLLAMA_MODEL,
        "database": "PostgreSQL" if db_ok else "unavailable",
        "db_connected": db_ok,
        "db_error": db_error,
    })


@app.route("/api/schema", methods=["GET"])
def schema():
    """
    Returns live table metadata (name, row count, column list) from the
    connected PostgreSQL database. The frontend Schema Sidebar can call
    this to show real counts instead of the hard-coded mock values.
    """
    try:
        with db_connection() as conn:
            tables = fetch_schema_info(conn)
        return success_response({"tables": tables})
    except Exception as exc:
        logger.error("Schema fetch failed: %s", exc)
        return error_response(f"Schema fetch failed: {exc}", 500)


@app.route("/api/generate", methods=["POST"])
def generate():
    """
    Core translation endpoint.

    Request body (JSON):
        { "prompt": "Show all users from California" }

    Response body (JSON):
        {
          "status":     "ok",
          "sql":        "SELECT ...",
          "columns":    ["id", "name", ...],
          "rows":       [{...}, ...],
          "latency":    "312ms",
          "tokensUsed": 345,
          "database":   "PostgreSQL 16 (Ollama llama3)"
        }

    The frontend (src/services/api.js → generateSqlQuery) maps these fields
    directly onto the queryResult state object.
    """
    body = request.get_json(silent=True) or {}
    prompt = (body.get("prompt") or "").strip()

    if not prompt:
        return error_response("Field 'prompt' is required and must not be empty.")

    if len(prompt) > Config.MAX_PROMPT_LENGTH:
        return error_response(
            f"Prompt exceeds maximum length of {Config.MAX_PROMPT_LENGTH} characters."
        )

    logger.info("Received prompt: %s", prompt)
    overall_start = time.perf_counter()

    try:
        sql_start = time.perf_counter()
        sql_query = translate_to_sql(prompt)
        sql_elapsed = time.perf_counter() - sql_start

        logger.info("Generated SQL (%.0fms): %s", sql_elapsed * 1000, sql_query)

        with db_connection() as conn:
            with conn.cursor() as cur:
                exec_start = time.perf_counter()
                cur.execute(sql_query)
                exec_elapsed = time.perf_counter() - exec_start

                columns = [desc[0] for desc in cur.description] if cur.description else []

                raw_rows = cur.fetchall()
                rows = [dict(zip(columns, row)) for row in raw_rows]

        logger.info(
            "Query executed in %.0fms – returned %d rows", exec_elapsed * 1000, len(rows)
        )

        total_latency_ms = int((time.perf_counter() - overall_start) * 1000)
        tokens_used = count_tokens(prompt, sql_query)

        return success_response({
            "sql":        sql_query,
            "columns":    columns,
            "rows":       rows,
            "latency":    f"{total_latency_ms}ms",
            "tokensUsed": tokens_used,
            "database":   f"PostgreSQL {Config.PG_VERSION} (Ollama {Config.OLLAMA_MODEL})",
        })

    except ValueError as exc:
        # Raised by llm.py when Ollama returns something that isn't valid SQL
        logger.warning("SQL translation error: %s", exc)
        return error_response(str(exc), 422)

    except Exception as exc:
        logger.error("Unhandled error in /api/generate: %s", exc, exc_info=True)
        return error_response(f"Server error: {exc}", 500)

if __name__ == "__main__":
    logger.info(
        "Starting QueryBridge API on %s:%s (debug=%s)",
        Config.HOST,
        Config.PORT,
        Config.DEBUG,
    )
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
