"""
QueryBridge – Database Layer
Handles PostgreSQL connections via psycopg2 and exposes helpers for
fetching live schema metadata from the NeonDB instance.
"""

import logging
from contextlib import contextmanager
from typing import Iterator

import psycopg2
import psycopg2.extras
from psycopg2 import pool

from config import Config

logger = logging.getLogger(__name__)

_pool: pool.SimpleConnectionPool | None = None


def _get_pool() -> pool.SimpleConnectionPool:
    """Return (and lazily create) the shared connection pool."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.SimpleConnectionPool(
            minconn=Config.PG_MIN_CONN,
            maxconn=Config.PG_MAX_CONN,
            host=Config.PG_HOST,
            port=Config.PG_PORT,
            dbname=Config.PG_DATABASE,
            user=Config.PG_USER,
            password=Config.PG_PASSWORD,
            sslmode=Config.PG_SSLMODE,
        )
        logger.info(
            "PostgreSQL pool created  →  %s:%s/%s",
            Config.PG_HOST,
            Config.PG_PORT,
            Config.PG_DATABASE,
        )
    return _pool


def get_db_connection() -> psycopg2.extensions.connection:
    """
    Borrow a connection from the pool.
    Caller MUST call close_db_connection(conn) when finished
    (typically in a finally block).
    """
    conn = _get_pool().getconn()
    conn.autocommit = True          
    return conn


def close_db_connection(conn: psycopg2.extensions.connection) -> None:
    """Return a borrowed connection back to the pool."""
    _get_pool().putconn(conn)


@contextmanager
def db_connection() -> Iterator[psycopg2.extensions.connection]:
    """
    Context manager for a pooled connection.
    Ensures every borrowed connection is returned to the pool.
    """
    conn = get_db_connection()
    try:
        yield conn
    finally:
        close_db_connection(conn)



def fetch_schema_info(conn: psycopg2.extensions.connection) -> list[dict]:
    """
    Return metadata for every user-created table.

    Used by the GET /api/schema endpoint so the React Schema Sidebar can
    display live counts instead of hard-coded mock values.
    """
    tables = []

    # List all user tables in the public schema
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type   = 'BASE TABLE'
            ORDER BY table_name;
        """)
        table_names = [row[0] for row in cur.fetchall()]

    for table in table_names:
        # Row count estimate (fast; exact count is expensive on large tables)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT reltuples::bigint FROM pg_class WHERE relname = %s",
                (table,),
            )
            row = cur.fetchone()
            count = int(row[0]) if row else 0

        # Column list with PK/FK annotations
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    c.column_name,
                    CASE
                        WHEN pk.column_name IS NOT NULL THEN c.column_name || ' (PK)'
                        WHEN fk.column_name IS NOT NULL THEN c.column_name || ' (FK)'
                        ELSE c.column_name
                    END AS annotated
                FROM information_schema.columns c

                LEFT JOIN (
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                         ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                      AND tc.table_name = %s
                ) pk ON c.column_name = pk.column_name

                LEFT JOIN (
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                         ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                      AND tc.table_name = %s
                ) fk ON c.column_name = fk.column_name

                WHERE c.table_name   = %s
                  AND c.table_schema = 'public'
                ORDER BY c.ordinal_position;
            """, (table, table, table))
            columns = [row["annotated"] for row in cur.fetchall()]

        tables.append({"name": table, "count": count, "columns": columns})

    return tables


AUTH_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS auth_users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(200) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def init_auth_schema() -> None:
    """Create authentication tables if they do not exist."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(AUTH_SCHEMA_SQL)



