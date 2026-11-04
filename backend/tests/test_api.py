import pytest
from httpx import ASGITransport, AsyncClient
from backend.app.main import app


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
async def test_admin_sync_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/admin/sync-check")
        assert res.status_code == 200
        assert res.json()["in_sync"] is True


@pytest.mark.asyncio
async def test_ledger_stats_empty():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/ledger/stats?ticker=NONEXISTENT")
        assert res.status_code == 200
        data = res.json()
        assert data["resolved_count"] == 0

