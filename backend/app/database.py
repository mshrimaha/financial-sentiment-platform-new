"""SQLite persistence layer (local prototype).
Production: use Supabase Postgres via database/schema.sql + Prisma/Supabase client.
Tables mirror the relational design in database/schema.sql.
"""
import sqlite3, os, uuid
from datetime import datetime, timezone

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./financial_platform.db").replace("sqlite:///", "")
if not DB_PATH.startswith("/"):
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", DB_PATH)
DB_PATH = os.path.abspath(DB_PATH)


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str):
    cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, hashed_password TEXT NOT NULL,
        full_name TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, source TEXT, license TEXT,
        record_count INTEGER, class_distribution TEXT, columns TEXT,
        missing_report TEXT, duplicate_count INTEGER, created_at TEXT NOT NULL, user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS dataset_records (
        id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, text TEXT, label TEXT,
        ticker TEXT, platform TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY(dataset_id) REFERENCES datasets(id)
    );
    CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY, user_id TEXT, modality TEXT, input_text TEXT,
        extracted_text TEXT, sentiment TEXT, confidence REAL, emotion TEXT,
        engagement_score REAL, tickers TEXT, modality_results TEXT,
        explanation TEXT, status TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media_uploads (
        id TEXT PRIMARY KEY, user_id TEXT, filename TEXT, file_path TEXT,
        media_type TEXT, mime_type TEXT, file_size INTEGER, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_runs (
        id TEXT PRIMARY KEY, dataset_name TEXT, model_name TEXT, accuracy REAL,
        precision_macro REAL, recall_macro REAL, f1_macro REAL, train_time_s REAL,
        confusion_matrix TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection_records (
        id TEXT PRIMARY KEY, user_id TEXT, platform TEXT, text TEXT, ticker TEXT,
        timestamp TEXT, media_type TEXT, annotator1_label TEXT, annotator2_label TEXT,
        final_label TEXT, notes TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection_methodology (
        id TEXT PRIMARY KEY, user_id TEXT, platform TEXT, method TEXT, date_range TEXT,
        keywords TEXT, tickers TEXT, sampling TEXT, inclusion TEXT, exclusion TEXT,
        annotation_guidelines TEXT, annotators TEXT, kappa REAL, ethics TEXT,
        storage TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY, user_id TEXT, title TEXT, report_type TEXT,
        file_path TEXT, summary TEXT, created_at TEXT NOT NULL
    );
    """)
    # Safe additive migrations for existing SQLite databases
    _ensure_column(conn, "analyses", "platform", "TEXT")
    _ensure_column(conn, "analyses", "model_used", "TEXT")
    _ensure_column(conn, "analyses", "keywords", "TEXT")
    _ensure_column(conn, "analyses", "probabilities", "TEXT")
    _ensure_column(conn, "analyses", "raw_metadata", "TEXT")
    _ensure_column(conn, "users", "updated_at", "TEXT")
    conn.commit()
    conn.close()


def uid():
    return str(uuid.uuid4())
