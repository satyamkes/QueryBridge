"""
QueryBridge – LLM Translation Layer
Sends the user's natural-language prompt to a locally-running Ollama
instance and returns a clean, validated PostgreSQL statement.
"""

import re
import requests

from config import Config


DB_SCHEMA_DESCRIPTION = """
Tables in the PostgreSQL database:

1. users (id PK, name, email, state CHAR(2), created_at DATE)
2. products (product_id PK VARCHAR, name, price NUMERIC, category VARCHAR)
3. orders (order_id PK VARCHAR, user_id FK→users.id, order_date DATE,
           total_amount NUMERIC, status VARCHAR)
4. order_items (item_id PK SERIAL, order_id FK→orders.order_id,
                product_id FK→products.product_id,
                quantity INTEGER, total_price NUMERIC)
5. student (student_id PK, name, math INT, science INT, english INT,
            history INT, hindi INT, average NUMERIC)
"""

SYSTEM_PROMPT_USER = f"""You are QueryBridge, an expert PostgreSQL query generator.

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

SYSTEM_PROMPT_ADMIN = f"""You are QueryBridge, an expert PostgreSQL query generator with ADMIN privileges.

Your job is to convert the user's natural-language request into a
syntactically correct PostgreSQL statement.

Rules you must follow:
- Output ONLY the SQL statement — no explanation, no markdown, no backticks.
- You may generate PostgreSQL SELECT, INSERT, and UPDATE statements.
- You are STRICTLY PROHIBITED from generating DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, or REVOKE statements.
- Use ANSI SQL that is 100%% compatible with PostgreSQL 16.
- Use proper JOIN syntax when multiple tables are needed.
- Apply LIMIT 100 for SELECT queries when the user does not specify a row limit.
- If the question is completely unrelated to the database schema, output
  exactly:  SELECT 'Query not applicable to the available schema' AS message;

Database schema you must use:
{DB_SCHEMA_DESCRIPTION}
"""

SYSTEM_PROMPT = SYSTEM_PROMPT_USER


def count_tokens(prompt: str, sql: str) -> int:
    """
    Approximates total tokens consumed.
    Ollama does not return token counts in its /api/chat response by
    default, so we use the well-known ≈4 chars-per-token heuristic.
    """
    combined = SYSTEM_PROMPT + prompt + sql
    return max(1, len(combined) // 4)


def translate_to_sql(prompt: str, role: str = 'user') -> str:
    """
    Send `prompt` to Ollama and return a clean PostgreSQL statement string.

    Raises:
        ValueError – when the LLM response cannot be parsed into valid SQL.
        RuntimeError – when Ollama is unreachable or returns an HTTP error.
    """
    system_prompt = SYSTEM_PROMPT_ADMIN if role == 'admin' else SYSTEM_PROMPT_USER
    payload = {
        "model": Config.OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
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

    raw_text: str = (
        data.get("message", {}).get("content", "")
        or data.get("response", "")
    ).strip()

    if not raw_text:
        raise ValueError("Ollama returned an empty response. Try rephrasing the prompt.")

    sql = _clean_sql(raw_text)
    validate_sql(sql, role)

    return sql


def _clean_sql(raw: str) -> str:
    """
    Strip markdown code fences and any surrounding whitespace.
    """
    # Remove ```sql ... ``` or ``` ... ``` fences
    cleaned = re.sub(r"```(?:sql)?\s*", "", raw, flags=re.IGNORECASE)
    cleaned = cleaned.replace("```", "").strip()

    # If it is SELECT, we can extract it
    select_match = re.search(r"(SELECT\b.*)", cleaned, re.IGNORECASE | re.DOTALL)
    # Check if SELECT is the main verb, but avoid stripping leading UPDATE/INSERT
    first_word = cleaned.split()[0].upper() if cleaned.split() else ""
    if select_match and first_word not in ("INSERT", "UPDATE"):
        cleaned = select_match.group(1).strip()

    # Normalise excessive whitespace inside the query (keep newlines for readability)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)

    return cleaned


def validate_sql(sql: str, role: str = 'user') -> None:
    """
    Lightweight safety check.

    For 'user' role:
      1. The query must start with SELECT.
      2. None of the blocked DML/DDL keywords may appear as whole words.
    For 'admin' role:
      1. The query must start with SELECT, INSERT, or UPDATE.
      2. None of the blocked admin keywords (DELETE, DROP, TRUNCATE) may appear as whole words.

    Raises ValueError with a user-friendly message on any violation.
    """
    first_word = sql.split()[0].upper() if sql.split() else ""

    if role == 'user':
        if first_word not in ("SELECT",):
            raise ValueError(
                f"The AI produced a '{first_word}' statement instead of a SELECT. "
                "Only read-only SELECT queries are permitted. Please rephrase."
            )
        if ";" in sql.rstrip(";"):
            raise ValueError("Multiple SQL statements are not allowed.")
        for keyword in Config.BLOCKED_SQL_KEYWORDS:
            if re.search(rf"\b{keyword}\b", sql, re.IGNORECASE):
                raise ValueError(
                    f"Generated SQL contains a blocked keyword: '{keyword}'. "
                    "Only read-only SELECT queries are allowed."
                )
    else:
        if first_word not in ("SELECT", "INSERT", "UPDATE"):
            raise ValueError(
                f"Access denied: '{first_word}' operations are not allowed for your role. "
                "Admins are only permitted to fetch and edit data (SELECT, INSERT, UPDATE)."
            )
        if ";" in sql.rstrip(";"):
            raise ValueError("Multiple SQL statements are not allowed.")
        for keyword in Config.BLOCKED_ADMIN_KEYWORDS:
            if re.search(rf"\b{keyword}\b", sql, re.IGNORECASE):
                raise ValueError(
                    f"Generated SQL contains a blocked keyword: '{keyword}'. "
                    "Admins are not permitted to run DELETE, DROP, or TRUNCATE operations."
                )


# Keep the private alias for backwards compatibility
_validate_sql = validate_sql
