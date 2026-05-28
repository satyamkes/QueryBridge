"""
QueryBridge – LLM Translation Layer
Sends the user's natural-language prompt to a locally-running Ollama
instance and returns a clean, validated PostgreSQL SELECT statement.

Prompt engineering strategy
────────────────────────────
1. System message tells the model its exact role, constraints, and the
   full database schema it is working with.
2. User message is the raw prompt as typed by the end-user.
3. The response is stripped of markdown fences, validated with a simple
   keyword allow-list, and returned as a string.

Changing models
────────────────
Set the OLLAMA_MODEL environment variable to any model you have pulled,
e.g. "qwen2.5-coder", "mistral", "codellama".  The system prompt is
model-agnostic; all tested models produce valid SQL when given it.

"""

import re
import logging
import requests

from config import Config

logger = logging.getLogger(__name__)

# ─── Schema Snapshot ──────────────────────────────────────────────────────────
# Kept in sync with db.py / README. Injected into every LLM prompt so the
# model doesn't have to guess column names.

DB_SCHEMA_DESCRIPTION = """
Tables in the PostgreSQL database:

1. users (id PK, name, email, state CHAR(2), created_at DATE)
2. products (product_id PK VARCHAR, name, price NUMERIC, category VARCHAR)
3. orders (order_id PK VARCHAR, user_id FK→users.id, order_date DATE,
           total_amount NUMERIC, status VARCHAR)
4. order_items (item_id PK SERIAL, order_id FK→orders.order_id,
                product_id FK→products.product_id,
                quantity INTEGER, total_price NUMERIC)
"""

SYSTEM_PROMPT = f"""You are QueryBridge, an expert PostgreSQL query generator.

Your ONLY job is to convert the user's natural-language question into a
syntactically correct PostgreSQL SELECT statement.

Rules you must follow:
- Output ONLY the SQL statement — no explanation, no markdown, no backticks.
- Always use only SELECT statements. Never write INSERT, UPDATE, DELETE,
  DROP, ALTER, CREATE, TRUNCATE, or any other mutating statement.
- Use ANSI SQL that is 100%% compatible with PostgreSQL 16.
- Use proper JOIN syntax when multiple tables are needed.
- Apply LIMIT 100 when the user does not specify a row limit, to avoid
  returning enormous result sets.
- If a question is ambiguous, make the most reasonable assumption and
  still produce valid SQL.
- If the question is completely unrelated to the database schema, output
  exactly:  SELECT 'Query not applicable to the available schema' AS message;

Database schema you must use:
{DB_SCHEMA_DESCRIPTION}
"""


def count_tokens(prompt: str, sql: str) -> int:
    """
    Approximates total tokens consumed.
    Ollama does not return token counts in its /api/chat response by
    default, so we use the well-known ≈4 chars-per-token heuristic.
    """
    combined = SYSTEM_PROMPT + prompt + sql
    return max(1, len(combined) // 4)


def translate_to_sql(prompt: str) -> str:
    """
    Send `prompt` to Ollama and return a clean PostgreSQL SELECT string.

    Raises:
        ValueError – when the LLM response cannot be parsed into valid SQL.
        RuntimeError – when Ollama is unreachable or returns an HTTP error.
    """
    payload = {
        "model": Config.OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
    }

    try:
        response = requests.post(
            f"{Config.OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=Config.OLLAMA_TIMEOUT,
        )
        response.raise_for_status()
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            "Cannot reach Ollama service. "
            "Make sure Ollama is running (`ollama serve`) and "
            f"listening on {Config.OLLAMA_BASE_URL}."
        )
    except requests.exceptions.Timeout:
        raise RuntimeError(
            f"Ollama did not respond within {Config.OLLAMA_TIMEOUT}s. "
            "Try a lighter model or increase OLLAMA_TIMEOUT."
        )
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(f"Ollama API error {exc.response.status_code}: {exc}")

    data = response.json()

    # Navigate the Ollama /api/chat response envelope
    raw_text: str = (
        data.get("message", {}).get("content", "")
        or data.get("response", "")
    ).strip()

    if not raw_text:
        raise ValueError("Ollama returned an empty response. Try rephrasing the prompt.")

    sql = _clean_sql(raw_text)
    _validate_sql(sql)

    return sql

def _clean_sql(raw: str) -> str:
    """
    Strip markdown code fences and any surrounding whitespace that some
    models add despite the system prompt telling them not to.

    Handles:
        ```sql
        SELECT ...
        ```
    and bare:
        SELECT ...
    """
    # Remove ```sql ... ``` or ``` ... ``` fences
    cleaned = re.sub(r"```(?:sql)?\s*", "", raw, flags=re.IGNORECASE)
    cleaned = cleaned.replace("```", "").strip()

    # If the model included a preamble sentence before the SQL, try to
    # extract just the SELECT block
    select_match = re.search(r"(SELECT\b.*)", cleaned, re.IGNORECASE | re.DOTALL)
    if select_match:
        cleaned = select_match.group(1).strip()

    # Normalise excessive whitespace inside the query (keep newlines for readability)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)

    return cleaned


def _validate_sql(sql: str) -> None:
    """
    Lightweight safety check.

    1. The query must start with SELECT (or the special "not applicable" message).
    2. None of the blocked DML/DDL keywords may appear as whole words.

    Raises ValueError with a user-friendly message on any violation.
    """
    first_word = sql.split()[0].upper() if sql.split() else ""

    if first_word not in ("SELECT",):
        raise ValueError(
            f"The AI produced a '{first_word}' statement instead of a SELECT. "
            "Only read-only SELECT queries are permitted. Please rephrase."
        )

    for keyword in Config.BLOCKED_SQL_KEYWORDS:
        # \b word-boundary so "created_at" doesn't match "CREATE"
        if re.search(rf"\b{keyword}\b", sql, re.IGNORECASE):
            raise ValueError(
                f"Generated SQL contains a blocked keyword: '{keyword}'. "
                "Only read-only SELECT queries are allowed."
            )
