"""
connection.py router
Handles DB connection, CSV upload, and disconnection endpoints.
"""

import uuid
import os
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File
from models.backend_schemas import ConnectionRequest, ConnectionResponse, TableInfo
from services import db_connector

router = APIRouter(prefix="/api/connection", tags=["Connection"])


@router.post("/connect", response_model=ConnectionResponse)
def connect_database(request: ConnectionRequest):
    """
    Connect to a database using a connection string.
    Returns session_id + discovered schema.

    Example connection strings:
    - PostgreSQL: postgresql://user:password@localhost:5432/mydb
    - MySQL:      mysql+pymysql://user:password@localhost:3306/mydb
    - SQLite:     sqlite:///path/to/file.db
    - Supabase:   postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
    """
    try:
        session_id, tables, message = db_connector.create_session(request.connection_string)
        return ConnectionResponse(
            success=True,
            message=message,
            tables=tables,
            session_id=session_id,
        )
    except ConnectionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/upload-csv", response_model=ConnectionResponse)
async def upload_csv(file: UploadFile = File(...)):
    """
    Accept a CSV or TSV file, load it into an in-memory SQLite database,
    and return a session_id + schema — identical shape to /connect.

    Supports:
    - Comma-separated  (.csv)
    - Tab-separated    (.tsv)
    - Auto-detected delimiter via Python csv.Sniffer
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file received.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".csv", ".tsv"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Please upload a .csv or .tsv file.",
        )

    # ── Read file content ──────────────────────────────────────────────────
    content_bytes = await file.read()
    if len(content_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        # Decode — try UTF-8 first, fall back to latin-1 (covers most Excel exports)
        try:
            text = content_bytes.decode("utf-8-sig")   # strips BOM if present
        except UnicodeDecodeError:
            text = content_bytes.decode("latin-1")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode file: {e}")

    # ── Auto-detect delimiter ──────────────────────────────────────────────
    import csv as csv_mod
    try:
        dialect = csv_mod.Sniffer().sniff(text[:4096], delimiters=",\t;|")
        delimiter = dialect.delimiter
    except csv_mod.Error:
        delimiter = "\t" if ext == ".tsv" else ","

    # ── Parse CSV into rows ────────────────────────────────────────────────
    import io
    reader   = csv_mod.DictReader(io.StringIO(text), delimiter=delimiter)
    rows     = list(reader)
    fieldnames = reader.fieldnames

    if not fieldnames:
        raise HTTPException(status_code=400, detail="Could not read column headers from the file.")
    if not rows:
        raise HTTPException(status_code=400, detail="File has headers but no data rows.")

    # ── Sanitize column names (SQLite doesn't like spaces/special chars) ──
    import re
    def sanitize(name: str) -> str:
        return re.sub(r"[^a-zA-Z0-9_]", "_", name.strip()).strip("_") or "col"

    col_map   = {orig: sanitize(orig) for orig in fieldnames}   # original → safe
    safe_cols = list(col_map.values())

    # ── Infer column types ─────────────────────────────────────────────────
    def infer_type(col_orig: str) -> str:
        """Sample first 100 non-empty values to decide INTEGER/REAL/TEXT."""
        samples = [r[col_orig] for r in rows[:100] if r.get(col_orig, "").strip()]
        if not samples:
            return "TEXT"
        int_ok = real_ok = True
        for s in samples:
            s = s.replace(",", "")   # handle "1,234" style numbers
            if int_ok:
                try: int(s)
                except ValueError: int_ok = False
            if real_ok and not int_ok:
                try: float(s)
                except ValueError: real_ok = False
        if int_ok:   return "INTEGER"
        if real_ok:  return "REAL"
        return "TEXT"

    col_types = {orig: infer_type(orig) for orig in fieldnames}

    # ── Build SQLite table name from file name ─────────────────────────────
    table_name = sanitize(os.path.splitext(file.filename)[0]) or "uploaded_data"

    # ── Create in-memory SQLite via SQLAlchemy ─────────────────────────────
    from sqlalchemy import create_engine, text as sa_text

    # Use a file-based SQLite so the session engine can reconnect;
    # store in a temp file that lives for the session lifetime.
    tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp_db.close()
    conn_str = f"sqlite:///{tmp_db.name}"
    engine   = create_engine(conn_str, connect_args={"check_same_thread": False})

    col_defs = ", ".join(
        f'"{col_map[orig]}" {col_types[orig]}' for orig in fieldnames
    )
    create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({col_defs})'

    with engine.begin() as conn:
        conn.execute(sa_text(create_sql))

        # Insert rows in batches of 500
        placeholders = ", ".join(f":{col_map[o]}" for o in fieldnames)
        insert_sql   = sa_text(
            f'INSERT INTO "{table_name}" VALUES ({placeholders})'
        )
        batch = []
        for row in rows:
            clean = {}
            for orig in fieldnames:
                val = row.get(orig, "").strip()
                t   = col_types[orig]
                if val == "":
                    clean[col_map[orig]] = None
                elif t == "INTEGER":
                    try: clean[col_map[orig]] = int(val.replace(",", ""))
                    except ValueError: clean[col_map[orig]] = val
                elif t == "REAL":
                    try: clean[col_map[orig]] = float(val.replace(",", ""))
                    except ValueError: clean[col_map[orig]] = val
                else:
                    clean[col_map[orig]] = val
            batch.append(clean)
            if len(batch) >= 500:
                conn.execute(insert_sql, batch)
                batch = []
        if batch:
            conn.execute(insert_sql, batch)

    # ── Register session ───────────────────────────────────────────────────
    session_id = str(uuid.uuid4())
    db_connector._sessions[session_id] = engine

    # ── Build TableInfo for response ───────────────────────────────────────
    columns_info = [
        {"name": col_map[orig], "type": col_types[orig]}
        for orig in fieldnames
    ]
    table_info = TableInfo(
        table_name=table_name,
        columns=columns_info,
        row_count=len(rows),
    )

    return ConnectionResponse(
        success=True,
        message=f"CSV loaded successfully! Table '{table_name}' with {len(rows):,} rows and {len(fieldnames)} columns.",
        tables=[table_info],
        session_id=session_id,
    )


@router.delete("/disconnect/{session_id}")
def disconnect_database(session_id: str):
    """Disconnect and clean up a session."""
    try:
        db_connector.remove_session(session_id)
        return {"success": True, "message": "Disconnected successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/schema/{session_id}")
def get_schema(session_id: str):
    """Get the full schema for a connected session."""
    try:
        schema = db_connector.get_schema_context(session_id)
        return {"session_id": session_id, "schema": schema}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
