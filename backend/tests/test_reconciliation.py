import uuid
from datetime import date, datetime
import numpy as np
import pandas as pd
import pytest
from backend.app.models.tables import ForecastPoint, ForecastRun
from backend.app.services.reconciliation_service import resolve_run


def make_test_run(horizon: int = 5) -> tuple[ForecastRun, list[ForecastPoint]]:
    anchor = date(2024, 6, 3)
    anchor_close = 100.0

    run = ForecastRun(
        id=uuid.uuid4(),
        ticker="AAPL",
        model_version_id=1,
        anchor_date=anchor,
        anchor_close_price=anchor_close,
        horizon_days=horizon,
        confidence_score=75.0,
        regime_status="NORMAL",
        confidence_metadata={},
        resolution_status="PENDING",
    )

    points = []
    # Steps 1..H projected to sequential days
    for h in range(1, horizon + 1):
        target = date(2024, 6, 3 + h)
        pred_ret = 0.01 * h
        p = ForecastPoint(
            forecast_run_id=run.id,
            step_ahead=h,
            target_trading_date=target,
            predicted_return=pred_ret,
            predicted_close=anchor_close * np.exp(pred_ret),
            lower_80=anchor_close * np.exp(pred_ret - 0.02),
            upper_80=anchor_close * np.exp(pred_ret + 0.02),
            lower_95=anchor_close * np.exp(pred_ret - 0.04),
            upper_95=anchor_close * np.exp(pred_ret + 0.04),
        )
        points.append(p)

    return run, points


def test_reconciliation_partial_and_full():
    run, points = make_test_run(horizon=5)

    # Observed close prices for 3 sessions after anchor (June 4, 5, 6)
    obs_dates = pd.date_range("2024-06-03", "2024-06-06", freq="D")
    obs_series = pd.Series([100.0, 101.0, 102.5, 99.0], index=obs_dates)

    # Resolve up to June 5 (only steps 1 and 2 elapsed)
    newly = resolve_run(run, points, obs_series, today=date(2024, 6, 5))
    assert newly == 2
    assert run.resolution_status == "PARTIALLY_RESOLVED"
    assert points[0].actual_close == 101.0
    assert points[0].direction_correct is True
    assert points[0].inside_80_band is True

    # Idempotency test: resolving again on same day resolves 0 new points
    newly_again = resolve_run(run, points, obs_series, today=date(2024, 6, 5))
    assert newly_again == 0
    assert run.resolution_status == "PARTIALLY_RESOLVED"

    # Add remaining sessions up to June 8
    full_dates = pd.date_range("2024-06-03", "2024-06-08", freq="D")
    full_series = pd.Series([100.0, 101.0, 102.5, 99.0, 103.0, 104.0], index=full_dates)

    newly_full = resolve_run(run, points, full_series, today=date(2024, 6, 8))
    assert newly_full == 3
    assert run.resolution_status == "RESOLVED"
    assert all(p.actual_close is not None for p in points)
    assert all(p.direction_correct is not None for p in points)

