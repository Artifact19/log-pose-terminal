from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.auth import require_admin
from backend.app.api.routes import forecast, health, ledger, market, models, retrain
from backend.app.config import settings
from backend.app.db import init_db
from backend.app.ml_core.manifest import check_sync
from backend.app.ml_core.pipeline import ROOT
from backend.app.services.reconciliation_service import reconciliation_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    init_db()

    # Startup: check notebook sync
    in_sync, msg = check_sync(ROOT)
    app.state.ml_stale = not in_sync
    if not in_sync:
        print(f"[main] WARNING: ML exports are not in sync with notebooks: {msg}")
    else:
        print("[main] Notebook exports are verified and in sync.")

    # Background task for periodic reconciliation (every 60 minutes)
    async def periodic_reconcile():
        while True:
            await asyncio.sleep(3600)
            try:
                reconciliation_service.resolve_pending_forecasts()
            except Exception as e:
                print(f"[reconcile-loop] Error: {e}")

    reconcile_task = asyncio.create_task(periodic_reconcile())

    yield

    reconcile_task.cancel()


app = FastAPI(
    title="Log Pose Terminal API",
    version="2.0.0",
    description="Auditable stock forecasting and live forward-testing platform.",
    lifespan=lifespan,
)

# CORS Middleware
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
origin_regex = getattr(settings, "CORS_ORIGIN_REGEX", None) or None
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes under /api
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(market.router, prefix="/api", tags=["Market Data"])
app.include_router(forecast.router, prefix="/api", tags=["Forecast"])
app.include_router(ledger.router, prefix="/api", tags=["Audit Ledger"])
app.include_router(models.router, prefix="/api", tags=["Model Lineage"])
app.include_router(retrain.router, prefix="/api", tags=["Model Operations"])


@app.post("/api/admin/sync-check", tags=["Admin"])
def admin_sync_check(_admin: dict = Depends(require_admin)):
    in_sync, msg = check_sync(ROOT)
    return {"in_sync": in_sync, "message": msg}


@app.get("/api/admin/data-check", tags=["Admin"])
def admin_data_check(_admin: dict = Depends(require_admin)):
    """Admin endpoint to test Yahoo Finance connectivity from hosting environment."""
    from datetime import date, timedelta
    from backend.app.services.data_service import data_service
    start_date = date.today() - timedelta(days=10)
    try:
        df = data_service.fetch_ohlcv("AAPL", start=start_date, force=True)
        return {
            "status": "ok",
            "ticker": "AAPL",
            "rows": len(df),
            "start_date": str(df.index[0].date()) if not df.empty else None,
            "end_date": str(df.index[-1].date()) if not df.empty else None,
            "latest_close": float(df["Close"].iloc[-1]) if not df.empty else None,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.post("/api/admin/pretrain-all", tags=["Admin"])
def admin_pretrain_all(force: bool = False, _admin: dict = Depends(require_admin)):
    """Admin endpoint to trigger background pre-training across all SUPPORTED_TICKERS."""
    from backend.app.services.retrain_service import retrain_service
    jobs = []
    for t in settings.SUPPORTED_TICKERS:
        try:
            res = retrain_service.trigger_retrain(t, force=force, horizon=settings.DEFAULT_HORIZON)
            jobs.append(res)
        except Exception as e:
            jobs.append({"ticker": t, "error": str(e)})
    return {"message": "Pre-training triggered for supported tickers", "jobs": jobs}


@app.get("/")
def root():
    return {
        "terminal": "Log Pose Terminal",
        "docs": "/docs",
        "health": "/api/health",
        "disclaimer": settings.DISCLAIMER,
    }

