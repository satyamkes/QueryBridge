from db import db_connection, fetch_schema_info


def build_dynamic_schema():
    """
    Fetch the live PostgreSQL schema and convert it into
    a readable format for the LLM.
    """
    with db_connection() as conn:
        tables = fetch_schema_info(conn)

    schema = []

    schema.append("Database Schema")
    schema.append("=" * 60)

    for table in tables:
        schema.append(f"\nTable: {table['name']}")
        schema.append(f"Approximate Rows: {table['count']}")
        schema.append("Columns:")

        for column in table["columns"]:
            schema.append(f"  - {column}")

    return "\n".join(schema)


def get_system_prompt():
    schema = build_dynamic_schema()

    return f"""
You are QueryBridge, an expert PostgreSQL SQL query generator.

Your ONLY job is to convert the user's natural-language question into a
syntactically correct PostgreSQL SELECT statement.

Rules you must follow:

- Output ONLY the SQL statement.
- No explanation.
- No markdown.
- No backticks.
- Always use only SELECT statements.
- Never generate INSERT, UPDATE, DELETE, DROP, ALTER,
  CREATE, TRUNCATE, or any mutating statement.
- Use ANSI SQL compatible with PostgreSQL.
- Use proper JOIN syntax whenever multiple tables are required.
- Use table aliases where appropriate.
- Apply LIMIT 100 when the user does not specify a limit.
- Never invent tables or columns.
- Use ONLY the schema provided below.
- If the question is unrelated to the schema, return exactly:

SELECT 'Query not applicable to the available schema' AS message;

Database Schema:

{schema}
"""