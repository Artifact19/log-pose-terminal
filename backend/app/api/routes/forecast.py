import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session
from backend.app.db import get_session
from backend.app.repositories.forecast_repo import forecast_repo
from backend.app.schemas.api import ForecastPointDetail, ForecastRequest, ForecastRunDetail
from backend.app.services.forecast_service import forecast_service

router = APIRouter()


@router.post("/forecast", response_model=ForecastRunDetail)
def create_forecast(req: ForecastRequest):
    try:
        run, points, bars = forecast_service.create_forecast(
            ticker=req.ticker,
            horizon=req.horizon,
            as_of=req.as_of,
            force_new=bool(req.force_new),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {e}")

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
        for p in points
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
        history_bars=bars,
    )


@router.get("/forecast/{run_id}", response_model=ForecastRunDetail)
def get_forecast(run_id: uuid.UUID, session: Session = Depends(get_session)):
    run = forecast_repo.get_run(session, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Forecast run not found")
    points = forecast_repo.get_run_points(session, run.id)

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
        for p in points
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

