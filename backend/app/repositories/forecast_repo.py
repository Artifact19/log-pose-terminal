from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional
import numpy as np
from sqlmodel import Session, select
from backend.app.models.tables import ForecastPoint, ForecastRun


class ForecastRepository:
    def create_run(
        self, session: Session, run: ForecastRun, points: list[ForecastPoint]
    ) -> ForecastRun:
        session.add(run)
        session.flush()
        for p in points:
            p.forecast_run_id = run.id
            session.add(p)
        session.commit()
        session.refresh(run)
        return run

    def get_run(self, session: Session, run_id: uuid.UUID) -> Optional[ForecastRun]:
        return session.get(ForecastRun, run_id)

    def get_run_points(self, session: Session, run_id: uuid.UUID) -> list[ForecastPoint]:
        statement = (
            select(ForecastPoint)
            .where(ForecastPoint.forecast_run_id == run_id)
            .order_by(ForecastPoint.step_ahead.asc())
        )
        return list(session.exec(statement).all())

    def find_existing(
        self,
        session: Session,
        ticker: str,
        anchor_date: date,
        model_version_id: int,
        horizon: int,
    ) -> Optional[ForecastRun]:
        statement = select(ForecastRun).where(
            ForecastRun.ticker == ticker.upper(),
            ForecastRun.anchor_date == anchor_date,
            ForecastRun.model_version_id == model_version_id,
            ForecastRun.horizon_days == horizon,
        )
        return session.exec(statement).first()

    def list_runs(
        self,
        session: Session,
        ticker: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ForecastRun]:
        statement = select(ForecastRun)
        if ticker:
            statement = statement.where(ForecastRun.ticker == ticker.upper())
        if status:
            statement = statement.where(ForecastRun.resolution_status == status.upper())
        statement = statement.order_by(ForecastRun.created_at.desc()).offset(offset).limit(limit)
        return list(session.exec(statement).all())

    def get_ghost_runs(
        self, session: Session, ticker: str, limit: int = 10
    ) -> list[ForecastRun]:
        statement = (
            select(ForecastRun)
            .where(ForecastRun.ticker == ticker.upper())
            .order_by(ForecastRun.created_at.desc())
            .limit(limit)
        )
        return list(session.exec(statement).all())

    def get_unresolved_points_grouped(
        self, session: Session, ticker: Optional[str] = None, today: Optional[date] = None
    ) -> dict[str, list[tuple[ForecastRun, list[ForecastPoint]]]]:
        """Find runs with pending points whose target_trading_date <= today."""
        target_today = today or date.today()
        statement = (
            select(ForecastPoint)
            .where(
                ForecastPoint.actual_close == None,  # noqa: E711
                ForecastPoint.target_trading_date <= target_today,
            )
        )
        points = list(session.exec(statement).all())
        if not points:
            return {}

        run_ids = {p.forecast_run_id for p in points}
        runs = [session.get(ForecastRun, rid) for rid in run_ids]
        valid_runs = [r for r in runs if r is not None]
        if ticker:
            valid_runs = [r for r in valid_runs if r.ticker == ticker.upper()]

        grouped: dict[str, list[tuple[ForecastRun, list[ForecastPoint]]]] = {}
        for r in valid_runs:
            all_pts = self.get_run_points(session, r.id)
            grouped.setdefault(r.ticker, []).append((r, all_pts))

        return grouped

    def calculate_stats(
        self, session: Session, ticker: Optional[str] = None, window_days: int = 30
    ) -> dict:
        from sqlalchemy import or_

        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=window_days)
        cutoff_d = cutoff_dt.date()
        statement = select(ForecastPoint).join(ForecastRun).where(
            ForecastPoint.actual_close != None,  # noqa: E711
            or_(
                ForecastPoint.resolved_at >= cutoff_dt,
                (ForecastPoint.resolved_at == None) & (ForecastPoint.target_trading_date >= cutoff_d),
            ),
        )
        if ticker:
            statement = statement.where(ForecastRun.ticker == ticker.upper())

        points = list(session.exec(statement).all())
        n = len(points)
        if n == 0:
            return {
                "ticker": ticker,
                "window_days": window_days,
                "resolved_count": 0,
                "mae_pct": 0.0,
                "directional_accuracy": 0.0,
                "coverage_80": 0.0,
                "coverage_95": 0.0,
            }

        pct_errors = [abs(p.pct_error) for p in points if p.pct_error is not None]
        hits = [1.0 if p.direction_correct else 0.0 for p in points if p.direction_correct is not None]
        cov80 = [1.0 if p.inside_80_band else 0.0 for p in points if p.inside_80_band is not None]
        cov95 = [1.0 if p.inside_95_band else 0.0 for p in points if p.inside_95_band is not None]

        return {
            "ticker": ticker,
            "window_days": window_days,
            "resolved_count": n,
            "mae_pct": float(np.mean(pct_errors)) if pct_errors else 0.0,
            "directional_accuracy": float(np.mean(hits)) if hits else 0.0,
            "coverage_80": float(np.mean(cov80)) if cov80 else 0.0,
            "coverage_95": float(np.mean(cov95)) if cov95 else 0.0,
        }


forecast_repo = ForecastRepository()
