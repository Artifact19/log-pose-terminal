from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd
from sqlmodel import Session

from backend.app.db import engine
from backend.app.models.tables import ForecastPoint, ForecastRun
from backend.app.repositories.forecast_repo import forecast_repo
from backend.app.services.calendar_service import realized_sessions_after
from backend.app.services.data_service import data_service


def resolve_run(
    run: ForecastRun,
    points: list[ForecastPoint],
    observed_close: pd.Series,
    today: date,
) -> int:
    """Observed_close: close series indexed by tz-naive session date. Returns #newly resolved."""
    sessions = realized_sessions_after(run.anchor_date, observed_close.index)
    newly = 0
    for p in sorted(points, key=lambda p: p.step_ahead):
        if p.actual_close is not None:
            continue
        if p.step_ahead > len(sessions):
            continue  # session hasn't happened yet
        sess = sessions[p.step_ahead - 1]
        if sess > today:
            continue
        ts_sess = pd.Timestamp(sess)
        if ts_sess not in observed_close.index:
            continue

        actual = float(observed_close.loc[ts_sess])

        # Date realignment check
        if p.target_trading_date != sess:
            if run.confidence_metadata is None:
                run.confidence_metadata = {}
            run.confidence_metadata.setdefault("date_realignments", []).append(
                {
                    "step": p.step_ahead,
                    "projected": str(p.target_trading_date),
                    "observed": str(sess),
                }
            )
            p.target_trading_date = sess

        # Calculate error and metrics
        ar = float(np.log(actual / run.anchor_close_price))
        p.actual_close = actual
        p.actual_return = ar
        p.abs_error = abs(actual - p.predicted_close)
        p.pct_error = (p.predicted_close - actual) / actual * 100.0

        if ar == 0.0:
            p.direction_correct = bool(p.predicted_return == 0.0)
        else:
            p.direction_correct = bool(np.sign(p.predicted_return) == np.sign(ar))

        p.inside_80_band = bool(p.lower_80 <= actual <= p.upper_80)
        p.inside_95_band = bool(p.lower_95 <= actual <= p.upper_95)
        p.resolved_at = datetime.now(timezone.utc)
        newly += 1

    n_res = sum(1 for p in points if p.actual_close is not None)
    run.resolution_status = (
        "RESOLVED"
        if n_res == run.horizon_days
        else "PARTIALLY_RESOLVED"
        if n_res > 0
        else "PENDING"
    )
    return newly


class ReconciliationService:
    def resolve_pending_forecasts(
        self, ticker: Optional[str] = None, today: Optional[date] = None
    ) -> dict[str, int]:
        target_today = today or date.today()
        total_newly = 0
        affected_runs = 0

        with Session(engine) as session:
            grouped = forecast_repo.get_unresolved_points_grouped(
                session, ticker=ticker, today=target_today
            )
            if not grouped:
                return {"resolved_points": 0, "affected_runs": 0}

            for t_symbol, run_tuples in grouped.items():
                min_anchor = min(r.anchor_date for r, _ in run_tuples)
                start_fetch = min_anchor - timedelta(days=7)
                end_fetch = target_today + timedelta(days=1)

                try:
                    ohlcv = data_service.fetch_ohlcv(
                        t_symbol, start=start_fetch, end=end_fetch, auto_adjust=True
                    )
                except Exception as exc:
                    logger.warning(
                        f"Failed to fetch market data to reconcile {t_symbol}: {exc}"
                    )
                    continue

                observed_close = ohlcv["Close"]

                for run, points in run_tuples:
                    newly = resolve_run(run, points, observed_close, target_today)
                    if newly > 0:
                        total_newly += newly
                        affected_runs += 1
                        session.add(run)
                        for p in points:
                            session.add(p)

            session.commit()

        return {"resolved_points": total_newly, "affected_runs": affected_runs}


reconciliation_service = ReconciliationService()
