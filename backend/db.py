import sqlite3
from pathlib import Path
from flask import g, current_app

DATABASE_PATH = Path(__file__).resolve().parent / "anonify.db"


def get_db() -> sqlite3.Connection:
    db = getattr(g, "_database", None)
    if db is None:
        if current_app.config.get("TESTING"):
            # Shared in-memory DB so data persists across requests in the same process
            db = sqlite3.connect(
                "file::memory:?cache=shared",
                detect_types=sqlite3.PARSE_DECLTYPES,
                uri=True,
            )
        else:
            db = sqlite3.connect(str(DATABASE_PATH), detect_types=sqlite3.PARSE_DECLTYPES)
        db.row_factory = sqlite3.Row
        g._database = db
    return db


def close_db(e=None) -> None:
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()
        g._database = None
