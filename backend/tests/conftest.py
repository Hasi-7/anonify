"""Shared test fixtures for the anonify backend."""

import sqlite3
import pytest
from backend.models import create_schema
from backend.app import create_app


@pytest.fixture
def db():
    """In-memory SQLite database with schema applied."""
    conn = sqlite3.connect(":memory:", detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    create_schema(conn)
    yield conn
    conn.close()


@pytest.fixture
def app():
    """Flask test app with a shared in-memory database."""
    application = create_app()
    application.config["TESTING"] = True

    # Keep a connection alive so the shared in-memory DB is not garbage collected
    # between requests during the test
    _holder = sqlite3.connect(
        "file::memory:?cache=shared",
        detect_types=sqlite3.PARSE_DECLTYPES,
        uri=True,
    )
    _holder.row_factory = sqlite3.Row
    create_schema(_holder)

    yield application

    _holder.close()


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()
