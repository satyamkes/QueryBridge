"""
QueryBridge – Database Layer
Handles PostgreSQL connections via psycopg2 and exposes helpers for
fetching schema metadata and seeding the demo dataset.
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
    Return metadata for every user-created table:
        [
          {
            "name":    "users",
            "count":   188,
            "columns": ["id (PK)", "name", "email", "state", "created_at"]
          },
          ...
        ]

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
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]

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


SEED_SQL = """
-- ─── Schema ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    email       VARCHAR(200) UNIQUE NOT NULL,
    state       CHAR(2)      NOT NULL,
    created_at  DATE         NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS products (
    product_id  VARCHAR(20)      PRIMARY KEY,
    name        VARCHAR(200)     NOT NULL,
    price       NUMERIC(12, 2)   NOT NULL,
    category    VARCHAR(80)      NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    order_id     VARCHAR(20)    PRIMARY KEY,
    user_id      INTEGER        REFERENCES users(id),
    order_date   DATE           NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    status       VARCHAR(30)    NOT NULL DEFAULT 'processing'
);

CREATE TABLE IF NOT EXISTS order_items (
    item_id     SERIAL         PRIMARY KEY,
    order_id    VARCHAR(20)    REFERENCES orders(order_id),
    product_id  VARCHAR(20)    REFERENCES products(product_id),
    quantity    INTEGER        NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS app_users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES app_users(id),
    action        VARCHAR(50) NOT NULL,
    query_executed TEXT NOT NULL,
    timestamp     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Seed Data ────────────────────────────────────────────────────────────

-- Users
INSERT INTO users (name, email, state, created_at) VALUES
  ('Elena Rostova',  'elena.r@nebula.io',  'CA', '2026-05-20'),
  ('Marcus Vance',   'm.vance@orion.org',  'CA', '2026-05-18'),
  ('Serah Chen',     'schen@quantum.com',  'CA', '2026-05-12'),
  ('Jared Leto',     'jleto@galaxy.net',   'CA', '2026-05-09'),
  ('Tasha Yar',      'tyar@starfleet.mil', 'CA', '2026-05-01'),
  ('Obi Kenobi',     'obi@jedi.org',       'TX', '2026-04-30'),
  ('Diana Prince',   'diana@amazon.io',    'NY', '2026-04-28'),
  ('Bruce Banner',   'banner@gamma.com',   'TX', '2026-04-25'),
  ('Natasha Romanov','black@shield.gov',   'NY', '2026-04-20'),
  ('Tony Stark',     'tony@starkinc.com',  'CA', '2026-04-15')
ON CONFLICT DO NOTHING;

-- Products
INSERT INTO products (product_id, name, price, category) VALUES
  ('PRD-808', 'Hover Propulsion Module v4',   199.70, 'Hardware'),
  ('PRD-102', 'Quantum Core Reactor',        1489.99, 'Energy'),
  ('PRD-441', 'Cybernetic Neural Link',       399.00, 'Biotech'),
  ('PRD-009', 'Sub-space Receiver',            99.90, 'Comms'),
  ('PRD-773', 'Tachyon Containment Grid',    1999.00, 'Energy')
ON CONFLICT DO NOTHING;

-- Orders
INSERT INTO orders (order_id, user_id, order_date, total_amount, status) VALUES
  ('ORD-9988', 2, '2026-05-26',  149.99, 'processing'),
  ('ORD-9985', 1, '2026-05-26', 1299.00, 'processing'),
  ('ORD-9972', 5, '2026-05-25',   45.50, 'processing'),
  ('ORD-9951', 4, '2026-05-23',  312.00, 'processing'),
  ('ORD-9900', 3, '2026-05-20',  799.00, 'shipped'),
  ('ORD-9870', 6, '2026-05-15', 2250.00, 'delivered'),
  ('ORD-9800', 7, '2026-05-10',  399.00, 'delivered')
ON CONFLICT DO NOTHING;

-- Order Items
INSERT INTO order_items (order_id, product_id, quantity, total_price) VALUES
  ('ORD-9988', 'PRD-808', 1,   199.70),
  ('ORD-9985', 'PRD-102', 1,  1489.99),
  ('ORD-9972', 'PRD-009', 1,    99.90),
  ('ORD-9951', 'PRD-441', 1,   399.00),
  ('ORD-9900', 'PRD-773', 1,  1999.00),
  ('ORD-9870', 'PRD-102', 2,  2979.98),
  ('ORD-9800', 'PRD-441', 1,   399.00)
ON CONFLICT DO NOTHING;
"""


def seed_database() -> None:
    """
    Create tables and insert demo rows if they don't already exist.
    Safe to call repeatedly; uses ON CONFLICT DO NOTHING guards.
    Run via:  python db.py
    """
    with db_connection() as conn:
        try:
            # Temporarily disable autocommit so we can run a multi-statement block
            conn.autocommit = False
            with conn.cursor() as cur:
                cur.execute(SEED_SQL)
                
                # Insert default users
                try:
                    import bcrypt
                    admin_pw = bcrypt.hashpw(b"ad******", bcrypt.gensalt()).decode('utf-8')
                    user_pw = bcrypt.hashpw(b"us********", bcrypt.gensalt()).decode('utf-8')
                    
                    cur.execute(
                        "INSERT INTO app_users (username, password_hash, role) VALUES (%s, %s, %s) ON CONFLICT (username) DO NOTHING",
                        ("ad***", admin_pw, "admin")
                    )
                    cur.execute(
                        "INSERT INTO app_users (username, password_hash, role) VALUES (%s, %s, %s) ON CONFLICT (username) DO NOTHING",
                        ("u***", user_pw, "user")
                    )
                except ImportError:
                    logger.warning("bcrypt not installed, skipping app_users seed data")
                    
            conn.commit()
            logger.info("Database seeded successfully.")
        except Exception as exc:
            conn.rollback()
            logger.error("Seeding failed: %s", exc)
            raise
        finally:
            conn.autocommit = True


if __name__ == "__main__":
    seed_database()
