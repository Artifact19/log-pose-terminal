import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from backend.app.config import settings
from backend.app.db import init_db
from backend.app.main import app

# Ensure database tables are created for API integration tests
init_db()


TEST_SECRET = "test-secret-at-least-32-bytes-long!!!"


def _create_token(email: str, secret: str = TEST_SECRET) -> str:
    return jwt.encode(
        {"sub": "test-user-id", "email": email, "aud": "authenticated"},
        secret,
        algorithm="HS256",
    )


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "Log Pose Terminal" in data["disclaimer"]
        assert data["ml_exports_in_sync"] is True


@pytest.mark.asyncio
async def test_admin_sync_check_unauthenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/admin/sync-check")
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_sync_check_forbidden_non_admin(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    token = _create_token("stranger@example.com", TEST_SECRET)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/sync-check",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_sync_check_success(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    token = _create_token(settings.ADMIN_EMAIL, TEST_SECRET)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/sync-check",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert res.json()["in_sync"] is True


@pytest.mark.asyncio
async def test_forecast_unsupported_ticker():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/forecast",
            json={"ticker": "GOOGL", "horizon": 5, "force_new": True},
        )
        assert res.status_code == 400
        assert "not supported" in res.json()["detail"]


@pytest.mark.asyncio
async def test_ledger_stats_empty():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/ledger/stats?ticker=NONEXISTENT")
        assert res.status_code == 200
        data = res.json()
        assert data["resolved_count"] == 0


@pytest.mark.asyncio
async def test_admin_data_check_unauthenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/admin/data-check")
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_retrain_returns_202(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    token = _create_token(settings.ADMIN_EMAIL, TEST_SECRET)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/retrain",
            json={"ticker": "AAPL", "force": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 202
        data = res.json()
        assert "job_id" in data
