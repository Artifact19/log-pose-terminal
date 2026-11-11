import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from backend.app.db import get_session
from backend.app.repositories.forecast_repo import forecast_repo
from backend.app.api.rate_limiter import rate_limit_reconcile
from backend.app.schemas.api import (
    ForecastPointDetail,
    ForecastRunDetail,
    GhostRun,
    GhostRunPoint,
    LedgerStatsResponse,
    ReconcileRequest,
)
from backend.app.services.reconciliation_service import reconciliation_service

router = APIRouter()


@router.get("/ledger", response_model=list[ForecastRunDetail])
def list_ledger_runs(
    ticker: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
):
    # Auto-trigger reconciliation first
    reconciliation_service.resolve_pending_forecasts(ticker=ticker)

    runs = forecast_repo.list_runs(
        session, ticker=ticker, status=status, limit=limit, offset=offset
    )

    results = []
    for r in runs:
        pts = forecast_repo.get_run_points(session, r.id)
        pts_detail = [
            ForecastPointDetail(
                id=p.id,
                step_ahead=p.step_ahead,
                target_trading_date=p.target_trading_date,
                predicted_return=p.predicted_return,
                predicted_close=p.predicted_close,
                lower_80=p.lower_80,
                upper_80=p.upper_80,
                lower_95=p.lower_95,
                upper_95=p.upper_95,
                actual_close=p.actual_close,
                actual_return=p.actual_return,
                abs_error=p.abs_error,
                pct_error=p.pct_error,
                direction_correct=p.direction_correct,
                inside_80_band=p.inside_80_band,
                inside_95_band=p.inside_95_band,
                resolved_at=p.resolved_at,
            )
            for p in pts
        ]
        results.append(
            ForecastRunDetail(
                id=r.id,
                ticker=r.ticker,
                model_version_id=r.model_version_id,
                created_at=r.created_at,
                anchor_date=r.anchor_date,
                anchor_close_price=r.anchor_close_price,
                horizon_days=r.horizon_days,
                confidence_score=r.confidence_score,
                regime_status=r.regime_status,
                confidence_metadata=r.confidence_metadata or {},
                resolution_status=r.resolution_status,
                is_seeded_demo=r.is_seeded_demo,
                points=pts_detail,
            )
        )
    return results


@router.get("/ledger/ghosts", response_model=list[GhostRun])
def get_ghost_runs(
    ticker: str,
    n: int = Query(default=10, ge=1, le=50),
    session: Session = Depends(get_session),
):
    runs = forecast_repo.get_ghost_runs(session, ticker=ticker, limit=n)
    ghosts = []
    for r in runs:
        pts = forecast_repo.get_run_points(session, r.id)
        g_pts = [
            GhostRunPoint(
                step_ahead=p.step_ahead,
                target_trading_date=p.target_trading_date,
                predicted_close=p.predicted_close,
                lower_80=p.lower_80,
                upper_80=p.upper_80,
                actual_close=p.actual_close,
                inside_80_band=p.inside_80_band,
            )
            for p in pts
        ]
        ghosts.append(
            GhostRun(
                run_id=r.id,
                anchor_date=r.anchor_date,
                anchor_close_price=r.anchor_close_price,
                points=g_pts,
            )
        )
    return ghosts


@router.get("/ledger/stats", response_model=LedgerStatsResponse)
def get_ledger_stats(
    ticker: Optional[str] = None,
    window: int = Query(default=30, ge=1, le=365),
    session: Session = Depends(get_session),
):
    stats = forecast_repo.calculate_stats(session, ticker=ticker, window_days=window)
    return LedgerStatsResponse(
        ticker=ticker,
        window_days=window,
        resolved_count=stats["resolved_count"],
        mae_pct=stats["mae_pct"],
        directional_accuracy=stats["directional_accuracy"],
        coverage_80=stats["coverage_80"],
        coverage_95=stats["coverage_95"],
    )


@router.get("/ledger/{run_id}", response_model=ForecastRunDetail)
def get_ledger_run(run_id: uuid.UUID, session: Session = Depends(get_session)):
    run = forecast_repo.get_run(session, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    pts = forecast_repo.get_run_points(session, run.id)
    pts_detail = [
        ForecastPointDetail(
            id=p.id,
            step_ahead=p.step_ahead,
            target_trading_date=p.target_trading_date,
            predicted_return=p.predicted_return,
            predicted_close=p.predicted_close,
            lower_80=p.lower_80,
            upper_80=p.upper_80,
            lower_95=p.lower_95,
            upper_95=p.upper_95,
            actual_close=p.actual_close,
            actual_return=p.actual_return,
            abs_error=p.abs_error,
            pct_error=p.pct_error,
            direction_correct=p.direction_correct,
            inside_80_band=p.inside_80_band,
            inside_95_band=p.inside_95_band,
            resolved_at=p.resolved_at,
        )
        for p in pts
    ]
    return ForecastRunDetail(
        id=run.id,
        ticker=run.ticker,
        model_version_id=run.model_version_id,
        created_at=run.created_at,
        anchor_date=run.anchor_date,
        anchor_close_price=run.anchor_close_price,
        horizon_days=run.horizon_days,
        confidence_score=run.confidence_score,
        regime_status=run.regime_status,
        confidence_metadata=run.confidence_metadata or {},
        resolution_status=run.resolution_status,
        is_seeded_demo=run.is_seeded_demo,
        points=pts_detail,
    )


@router.post("/reconcile")
def manual_reconcile(req: ReconcileRequest, _rate_limit=Depends(rate_limit_reconcile)):
    counts = reconciliation_service.resolve_pending_forecasts(ticker=req.ticker)
    return counts
