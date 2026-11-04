from fastapi import APIRouter
from backend.app.config import settings
from backend.app.ml_core.manifest import check_sync
from backend.app.ml_core.pipeline import ROOT, load_methodology
from backend.app.schemas.api import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health():
    in_sync, _ = check_sync(ROOT)
    try:
        m = load_methodology()
        methodology = m.methodology_name
    except Exception:
        methodology = "XGBoostDirectMultiHorizon"

    db_backend = "sqlite" if not settings.DATABASE_URL or settings.DATABASE_URL.startswith("sqlite") else "postgresql"

    return HealthResponse(
        status="ok",
        db_backend=db_backend,
        ml_exports_in_sync=in_sync,
        methodology_name=methodology,
        disclaimer=settings.DISCLAIMER,
    )

