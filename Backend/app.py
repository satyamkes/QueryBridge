"""
QueryBridge - Flask API Gateway
Natural Language → SQL Translation Engine

Endpoints:
  POST /api/register  → create a new user account
  POST /api/login     → authenticate and receive JWT tokens
  POST /api/refresh   → refresh an expired access token
  POST /api/generate  → translate prompt to SQL & execute
  POST /api/execute   → execute confirmed destructive SQL (admin only)
  GET  /api/health    → service status check
  GET  /api/schema    → expose live DB table metadata
  GET  /api/me        → get current user info
"""

import time
import re
import logging
import bcrypt
from flask import Flask, jsonify, request
from flask_cors import CORS

from config import Config
from db import db_connection, fetch_schema_info
from llm import translate_to_sql, count_tokens, validate_sql
from auth import generate_tokens, verify_token, require_auth, require_admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

CORS(app, resources={
    r"/api/*": {
        "origins": Config.CORS_ORIGINS,
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
})


def success_response(data: dict, status: int = 200):
    return jsonify({"status": "ok", **data}), status


def error_response(message: str, status: int = 400):
    return jsonify({"status": "error", "message": message}), status


# ─── Auth Endpoints ────────────────────────────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    """Register a new user account. Only an existing admin can create admin accounts."""
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "").strip()
    requested_role = (body.get("role") or "user").strip().lower()

    if not username or not password:
        return error_response("Username and password are required.")
    
    if len(username) < 3:
        return error_response("Username must be at least 3 characters.")
    
    if len(password) < 6:
        return error_response("Password must be at least 6 characters.")
    
    if requested_role not in ("admin", "user"):
        return error_response("Role must be 'admin' or 'user'.")

    # Only an authenticated admin can create another admin
    role = "user"
    if requested_role == "admin":
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            payload = verify_token(token)
            if payload and payload.get("role") == "admin":
                role = "admin"
            else:
                return error_response("Only an admin can create admin accounts.", 403)
        else:
            return error_response("Only an admin can create admin accounts.", 403)

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM app_users WHERE username = %s",
                    (username,)
                )
                if cur.fetchone():
                    return error_response("Username already exists.", 409)
                
                conn.autocommit = False
                cur.execute(
                    "INSERT INTO app_users (username, password_hash, role) VALUES (%s, %s, %s) RETURNING id",
                    (username, password_hash, role)
                )
                user_id = cur.fetchone()[0]
                conn.commit()
                conn.autocommit = True

        access_token, refresh_token = generate_tokens(user_id, username, role)
        
        return success_response({
            "message": "Registration successful",
            "user": {"id": user_id, "username": username, "role": role},
            "access_token": access_token,
            "refresh_token": refresh_token
        }, 201)
    except Exception as exc:
        logger.error("Registration failed: %s", exc)
        return error_response(f"Registration failed: {exc}", 500)


@app.route("/api/login", methods=["POST"])
def login():
    """Authenticate user and return JWT tokens."""
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "").strip()

    if not username or not password:
        return error_response("Username and password are required.")

    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, username, password_hash, role FROM app_users WHERE username = %s",
                    (username,)
                )
                row = cur.fetchone()

        if not row:
            return error_response("Invalid credentials.", 401)

        user_id, db_username, password_hash, role = row

        if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
            return error_response("Invalid credentials.", 401)

        access_token, refresh_token = generate_tokens(user_id, db_username, role)

        return success_response({
            "message": "Login successful",
            "user": {"id": user_id, "username": db_username, "role": role},
            "access_token": access_token,
            "refresh_token": refresh_token
        })
    except Exception as exc:
        logger.error("Login failed: %s", exc)
        return error_response(f"Login failed: {exc}", 500)


@app.route("/api/refresh", methods=["POST"])
def refresh():
    """Refresh an expired access token using a valid refresh token."""
    body = request.get_json(silent=True) or {}
    refresh_token = (body.get("refresh_token") or "").strip()

    if not refresh_token:
        return error_response("Refresh token is required.")

    payload = verify_token(refresh_token)
    if not payload:
        return error_response("Invalid or expired refresh token.", 401)

    access_token, new_refresh_token = generate_tokens(
        payload['user_id'], payload['username'], payload['role']
    )

    return success_response({
        "access_token": access_token,
        "refresh_token": new_refresh_token
    })


@app.route("/api/me", methods=["GET"])
@require_auth
def me():
    """Return the current authenticated user's info."""
    return success_response({
        "user": {
            "id": request.user['user_id'],
            "username": request.user['username'],
            "role": request.user['role']
        }
    })


# ─── Existing Endpoints (secured) ──────────────────────────────────────────

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
@require_auth
def schema():
    """
    Returns live table metadata (name, row count, column list) from the
    connected PostgreSQL database.
    """
    try:
        with db_connection() as conn:
            tables = fetch_schema_info(conn)
        return success_response({"tables": tables})
    except Exception as exc:
        logger.error("Schema fetch failed: %s", exc)
        return error_response(f"Schema fetch failed: {exc}", 500)


@app.route("/api/generate", methods=["POST"])
@require_auth
def generate():
    """
    Core translation endpoint.
    For user role: only SELECT queries allowed.
    For admin role: all queries allowed, but destructive ones need confirmation.
    """
    body = request.get_json(silent=True) or {}
    prompt = (body.get("prompt") or "").strip()
    role = request.user.get('role', 'user')

    if not prompt:
        return error_response("Field 'prompt' is required and must not be empty.")

    if len(prompt) > Config.MAX_PROMPT_LENGTH:
        return error_response(
            f"Prompt exceeds maximum length of {Config.MAX_PROMPT_LENGTH} characters."
        )

    logger.info("Received prompt from %s (role=%s): %s", request.user['username'], role, prompt)
    overall_start = time.perf_counter()

    try:
        sql_start = time.perf_counter()
        sql_query = translate_to_sql(prompt, role)
        sql_elapsed = time.perf_counter() - sql_start

        logger.info("Generated SQL (%.0fms): %s", sql_elapsed * 1000, sql_query)

        # Check if this is a destructive query for admin
        first_word = sql_query.strip().split()[0].upper() if sql_query.strip() else ""
        is_destructive = first_word in ("DELETE", "DROP", "TRUNCATE", "ALTER", "INSERT", "UPDATE", "CREATE")

        if is_destructive and role == 'admin':
            total_latency_ms = int((time.perf_counter() - overall_start) * 1000)
            tokens_used = count_tokens(prompt, sql_query)
            return success_response({
                "sql": sql_query,
                "requires_confirmation": True,
                "action_type": first_word,
                "columns": [],
                "rows": [],
                "latency": f"{total_latency_ms}ms",
                "tokensUsed": tokens_used,
                "database": f"PostgreSQL {Config.PG_VERSION} (Ollama {Config.OLLAMA_MODEL})",
            })
        
        if is_destructive and role == 'user':
            return error_response(
                f"Access denied: '{first_word}' operations are not allowed for your role. "
                "Only SELECT queries are permitted. Please rephrase your request.",
                403
            )

        # Execute SELECT queries directly
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
            "sql": sql_query,
            "columns": columns,
            "rows": rows,
            "latency": f"{total_latency_ms}ms",
            "tokensUsed": tokens_used,
            "database": f"PostgreSQL {Config.PG_VERSION} (Ollama {Config.OLLAMA_MODEL})",
        })

    except ValueError as exc:
        logger.warning("SQL translation error: %s", exc)
        return error_response(str(exc), 422)

    except Exception as exc:
        logger.error("Unhandled error in /api/generate: %s", exc, exc_info=True)
        return error_response(f"Server error: {exc}", 500)


@app.route("/api/execute", methods=["POST"])
@require_admin
def execute_sql():
    """
    Execute a confirmed destructive SQL query (admin only).
    Writes an entry to the audit_logs table.
    """
    body = request.get_json(silent=True) or {}
    sql_query = (body.get("sql") or "").strip()

    if not sql_query:
        return error_response("SQL query is required.")

    try:
        validate_sql(sql_query, 'admin')
    except ValueError as exc:
        return error_response(str(exc), 403)

    first_word = sql_query.split()[0].upper() if sql_query.split() else ""
    
    logger.info(
        "Admin '%s' executing confirmed destructive query: %s",
        request.user['username'], sql_query
    )

    try:
        with db_connection() as conn:
            conn.autocommit = False
            try:
                with conn.cursor() as cur:
                    exec_start = time.perf_counter()
                    cur.execute(sql_query)
                    exec_elapsed = time.perf_counter() - exec_start

                    rows_affected = cur.rowcount

                    # Log to audit_logs
                    cur.execute(
                        "INSERT INTO audit_logs (user_id, action, query_executed) VALUES (%s, %s, %s)",
                        (request.user['user_id'], first_word, sql_query)
                    )

                conn.commit()
            except Exception as exc:
                conn.rollback()
                raise exc
            finally:
                conn.autocommit = True

        logger.info(
            "Destructive query executed in %.0fms – %d rows affected",
            exec_elapsed * 1000, rows_affected
        )

        return success_response({
            "message": f"{first_word} query executed successfully.",
            "rows_affected": rows_affected,
            "latency": f"{int(exec_elapsed * 1000)}ms",
            "sql": sql_query,
            "logged": True
        })

    except Exception as exc:
        logger.error("Execute failed: %s", exc, exc_info=True)
        return error_response(f"Execution failed: {exc}", 500)


@app.route("/api/audit-logs", methods=["GET"])
@require_admin
def audit_logs():
    """Return all audit log entries (admin only)."""
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT al.id, au.username, al.action, al.query_executed, al.timestamp
                    FROM audit_logs al
                    JOIN app_users au ON al.user_id = au.id
                    ORDER BY al.timestamp DESC
                    LIMIT 100
                """)
                columns = [desc[0] for desc in cur.description]
                rows = [dict(zip(columns, row)) for row in cur.fetchall()]

        return success_response({"logs": rows})
    except Exception as exc:
        logger.error("Audit logs fetch failed: %s", exc)
        return error_response(f"Failed to fetch audit logs: {exc}", 500)


if __name__ == "__main__":
    logger.info(
        "Starting QueryBridge API on %s:%s (debug=%s)",
        Config.HOST,
        Config.PORT,
        Config.DEBUG,
    )
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
