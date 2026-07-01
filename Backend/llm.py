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
from ai.prompt import get_system_prompt


def count_tokens(SYSTEM_PROMPT: str, prompt: str, sql: str) -> int:
    """
    Approximate token count using the 4 chars/token heuristic.
    """
    combined = SYSTEM_PROMPT + prompt + sql
    return max(1, len(combined) // 4)


def translate_to_sql(prompt: str) -> str:
    """
    Send prompt to Ollama and return a validated PostgreSQL SELECT query.
    """

    # Build the schema-aware system prompt only once
    SYSTEM_PROMPT = get_system_prompt()

    payload = {
        "model": Config.OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
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
        raise RuntimeError(
            f"Ollama API error {exc.response.status_code}: {exc}"
        )

    data = response.json()

    raw_text = (
        data.get("message", {}).get("content", "")
        or data.get("response", "")
    ).strip()

    if not raw_text:
        raise ValueError(
            "Ollama returned an empty response. Try rephrasing the prompt."
        )

    sql = _clean_sql(raw_text)
    _validate_sql(sql)

    # Optional: Calculate tokens if you need them later
    tokens = count_tokens(SYSTEM_PROMPT, prompt, sql)

    return sql


def _clean_sql(raw: str) -> str:
    """
    Remove markdown code fences and normalize whitespace.
    """

    cleaned = re.sub(r"```(?:sql)?\s*", "", raw, flags=re.IGNORECASE)
    cleaned = cleaned.replace("```", "").strip()

    select_match = re.search(
        r"(SELECT\b.*)",
        cleaned,
        re.IGNORECASE | re.DOTALL,
    )

    if select_match:
        cleaned = select_match.group(1).strip()

    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)

    return cleaned


def _validate_sql(sql: str) -> None:
    """
    Allow only read-only SELECT statements.
    """

    first_word = sql.split()[0].upper() if sql.split() else ""

    if first_word != "SELECT":
        raise ValueError(
            f"The AI produced a '{first_word}' statement instead of a SELECT. "
            "Only read-only SELECT queries are permitted."
        )

    for keyword in Config.BLOCKED_SQL_KEYWORDS:
        if re.search(rf"\b{keyword}\b", sql, re.IGNORECASE):
            raise ValueError(
                f"Generated SQL contains blocked keyword '{keyword}'."
            )