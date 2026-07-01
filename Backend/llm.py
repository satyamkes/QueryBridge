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
import requests

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config import Config
from ai.prompt import SYSTEM_PROMPT


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
        if re.search(rf"\b{keyword}\b", sql, re.IGNORECASE):
            raise ValueError(
                f"Generated SQL contains a blocked keyword: '{keyword}'. "
                "Only read-only SELECT queries are allowed."
            )
