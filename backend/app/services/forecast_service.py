from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import joblib
import pandas as pd
from fastapi import HTTPException
from sqlmodel import Session

from backend.app.config import settings
from backend.app.db import engine
from backend.app.ml_core.pipeline import predict
from backend.app.models.tables import ForecastPoint, ForecastRun
from backend.app.repositories.forecast_repo import forecast_repo
from backend.app.repositories.model_repo import model_repo
from backend.app.schemas.api import OHLCVBar
from backend.app.services.artifact_service import artifact_service
from backend.app.services.calendar_service import project_trading_dates
from backend.app.services.data_service import data_service
from backend.app.services.reconciliation_service import reconciliation_service
from backend.app.services.retrain_service import retrain_service

logger = logging.getLogger("forecast_service")


class ForecastService:
    def create_forecast(
        self,
        ticker: str,
        horizon: Optional[int] = None,
        as_of: Optional[date] = None,
        force_new: bool = False,
    ) -> tuple[ForecastRun, list[ForecastPoint], list[OHLCVBar]]:
        t = ticker.upper()
        h = horizon or settings.DEFAULT_HORIZON

        # Auto-reconcile first per section 6.4
        reconciliation_service.resolve_pending_forecasts(t)

        with Session(engine) as session:
            active_model = model_repo.get_active(session, t)

        if active_model is None:
            if t not in settings.SUPPORTED_TICKERS:
                raise ValueError(
                    f"Ticker '{t}' is not supported for automated model training. Supported tickers: {', '.join(settings.SUPPORTED_TICKERS)}"
                )
            train_horizon = min(max(h, settings.DEFAULT_HORIZON), settings.MAX_HORIZON)
            job_info = retrain_service.trigger_retrain(t, force=True, as_of=as_of, horizon=train_horizon)
            raise HTTPException(
                status_code=202,
                detail=f"No active model found for {t}. Automated training job '{job_info['job_id']}' initiated in background. Please try again shortly.",
            )

        # Ensure artifact is downloaded/cached locally from Supabase Storage
        local_artifact = artifact_service.ensure_local_artifact(
            t, active_model.version_tag, active_model.artifact_path
        )

        try:
            b_meta = joblib.load(local_artifact)
            if b_meta.get("horizon", 5) < h and t in settings.SUPPORTED_TICKERS:
                train_horizon = min(max(h, settings.DEFAULT_HORIZON), settings.MAX_HORIZON)
                retrain_service.trigger_retrain(t, force=True, as_of=as_of, horizon=train_horizon)
        except Exception as e:
            logger.debug(f"Could not check model metadata for horizon: {e}")

        # Fetch market data up to as_of
        start_date = (as_of or date.today()) - timedelta(days=settings.DEFAULT_TRAIN_YEARS * 365)
        ohlcv = data_service.fetch_ohlcv(t, start=start_date, end=as_of, auto_adjust=True)

        anchor_date = pd.Timestamp(ohlcv.index[-1]).date()

        # Idempotency check
        if not force_new:
            with Session(engine) as session:
                existing = forecast_repo.find_existing(
                    session,
                    ticker=t,
                    anchor_date=anchor_date,
                    model_version_id=active_model.id,
                    horizon=h,
                )
                if existing:
                    pts = forecast_repo.get_run_points(session, existing.id)
                    bars = self._build_history_bars(ohlcv)
                    return existing, pts, bars

        # Adaptive Conformal Inference (ACI): feed live 80% coverage if >= 20 resolved points
        live_ledger_picp: Optional[float] = None
        with Session(engine) as session:
            stats = forecast_repo.calculate_stats(session, ticker=t, window_days=30)
            if stats.get("resolved_count", 0) >= 20:
                live_ledger_picp = float(stats["coverage_80"])

        # Project trading dates
        trading_dates = project_trading_dates(t, anchor_date, h)

        # Predict via ML pipeline
        bundle = predict(
            ohlcv,
            t,
            str(local_artifact),
            trading_dates,
            live_ledger_picp=live_ledger_picp,
            requested_horizon=h,
        )

        # Backdate model leakage risk check
        metadata = bundle.confidence.breakdown.model_dump(mode="json")
        if as_of and active_model.train_end_date > as_of:
            metadata["backdate_model_leak_risk"] = True

        run = ForecastRun(
            id=uuid.uuid4(),
            ticker=t,
            model_version_id=active_model.id,
            created_at=datetime.now(timezone.utc),
            anchor_date=anchor_date,
            anchor_close_price=bundle.anchor_close,
            horizon_days=bundle.horizon,
            confidence_score=bundle.confidence.confidence_score,
            regime_status=bundle.confidence.regime_status,
            confidence_metadata=metadata,
            resolution_status="PENDING",
            is_seeded_demo=False,
        )

        points = []
        for p in bundle.points:
            pt = ForecastPoint(
                step_ahead=p.step_ahead,
                target_trading_date=p.target_trading_date,
                predicted_return=p.predicted_return,
                predicted_close=p.predicted_close,
                lower_80=p.lower_80,
                upper_80=p.upper_80,
                lower_95=p.lower_95,
                upper_95=p.upper_95,
            )
            points.append(pt)

        with Session(engine) as session:
            saved_run = forecast_repo.create_run(session, run, points)
            saved_pts = forecast_repo.get_run_points(session, saved_run.id)

        bars = self._build_history_bars(ohlcv)
        return saved_run, saved_pts, bars

    def _build_history_bars(self, ohlcv: pd.DataFrame, n_bars: int = 250) -> list[OHLCVBar]:
        tail = ohlcv.tail(n_bars)
        bars = []
        for idx, row in tail.iterrows():
            bars.append(
                OHLCVBar(
                    date=str(pd.Timestamp(idx).date()),
                    open=round(float(row["Open"]), 4),
                    high=round(float(row["High"]), 4),
                    low=round(float(row["Low"]), 4),
                    close=round(float(row["Close"]), 4),
                    volume=round(float(row["Volume"]), 2),
                )
            )
        return bars


forecast_service = ForecastService()
