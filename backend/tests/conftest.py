import pytest
from backend.app.db import init_db


@pytest.fixture(autouse=True, scope="session")
def initialize_test_database():
    """Initialize database tables before running backend tests.

    FastAPI lifespan runs init_db() on startup, but httpx ASGITransport
    does not trigger lifespan events by default during testing.
    """
    init_db()
