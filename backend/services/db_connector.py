"""
db_connector.py
Dynamic database connection + schema discovery using SQLAlchemy.
Supports: PostgreSQL, MySQL, SQLite
"""

import uuid
from typing import Dict, List, Any, Optional
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from models.backend_schemas import TableInfo

# In-memory session store: session_id -> engine
_sessions: Dict[str, Any] = {}


def create_session(connection_string: str) -> tuple[str, list[TableInfo], str]:
    """
    Connect to the database, discover schema, store session.
    Returns: (session_id, tables, message)
    """
    try:
        # Create engine and test connection
        engine = create_engine(connection_string, pool_pre_ping=True)

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))  # test ping

        # Discover schema
        tables = _discover_schema(engine)

        # Store session
        session_id = str(uuid.uuid4())
        _sessions[session_id] = engine

        return session_id, tables, f"Connected successfully! Found {len(tables)} table(s)."

    except OperationalError as e:
        raise ConnectionError(f"Could not connect to database: {str(e)}")
    except Exception as e:
        raise ConnectionError(f"Connection failed: {str(e)}")


def _discover_schema(engine) -> list[TableInfo]:
    """Auto-discover all tables and their columns."""
    inspector = inspect(engine)
    tables = []

    for table_name in inspector.get_table_names():
        # Get columns
        columns = []
        for col in inspector.get_columns(table_name):
            columns.append({
                "name": col["name"],
                "type": str(col["type"])
            })

        # Get approximate row count
        try:
            with engine.connect() as conn:
                result = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
                row_count = result.scalar() or 0
        except Exception:
            row_count = 0

        tables.append(TableInfo(
            table_name=table_name,
            columns=columns,
            row_count=row_count
        ))

    return tables


def get_engine(session_id: str):
    """Get engine for an existing session."""
    engine = _sessions.get(session_id)
    if not engine:
        raise ValueError(f"Session '{session_id}' not found. Please reconnect.")
    return engine


def get_schema_context(session_id: str) -> str:
    """
    Build a text description of the DB schema to pass to Groq as context.
    Example:
        Table: orders (5009 rows)
          - order_id: TEXT
          - order_date: DATE
          ...
    """
    engine = get_engine(session_id)
    tables = _discover_schema(engine)

    lines = ["DATABASE SCHEMA:"]
    for table in tables:
        lines.append(f"\nTable: {table.table_name} ({table.row_count} rows)")
        for col in table.columns:
            lines.append(f"  - {col['name']}: {col['type']}")

    return "\n".join(lines)


def execute_query(session_id: str, sql: str) -> list[dict]:
    """
    Execute a SQL query and return results as list of dicts.
    Limits to 500 rows for safety.
    """
    engine = get_engine(session_id)

    try:
        with engine.connect() as conn:
            # Wrap in a safe SELECT-only execution
            safe_sql = sql.strip().rstrip(";")
            result = conn.execute(text(f"SELECT * FROM ({safe_sql}) AS _q LIMIT 500"))
            columns = list(result.keys())
            rows = result.fetchall()

            return [dict(zip(columns, row)) for row in rows]

    except Exception as e:
        raise ValueError(f"SQL execution failed: {str(e)}\nSQL: {sql}")


def remove_session(session_id: str):
    """Clean up a session."""
    if session_id in _sessions:
        _sessions[session_id].dispose()
        del _sessions[session_id]
