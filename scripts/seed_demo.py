"""Seed realistic historical demo data for AAPL, SPY, and RELIANCE.NS.

Produces backdated forecasts leaving the 7-day-ago forecast PENDING
so that initial launch or first reconcile call resolves against real yfinance closes.
"""
from __future__ import annotations

import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from datetime import date, timedelta
import pandas as pd
from sqlmodel import Session

from backend.app.db import engine, init_db
from backend.app.models.tables import ForecastRun
from backend.app.repositories.forecast_repo import forecast_repo
from backend.app.repositories.model_repo import model_repo
from backend.app.services.data_service import data_service
from backend.app.services.forecast_service import forecast_service
from backend.app.services.retrain_service import retrain_service


def seed_demo_data() -> None:
    init_db()
    today = date.today()
    tickers = ["AAPL", "SPY", "RELIANCE.NS"]

    print(f"[seed] Starting demo seeding as of today={today}...")

    for ticker in tickers:
        print(f"\n[seed] Processing ticker {ticker}...")
        with Session(engine) as session:
            existing_seeded = [
                r for r in forecast_repo.list_runs(session, ticker=ticker, limit=100) if r.is_seeded_demo
            ]
            if existing_seeded:
                print(f"[seed] {ticker} already has {len(existing_seeded)} seeded demo runs. Skipping.")
                continue

        # 1. Fetch data to find valid past trading sessions
        try:
            ohlcv = data_service.fetch_ohlcv(
                ticker, start=today - timedelta(days=60), end=today, auto_adjust=True
            )
        except Exception as e:
            print(f"[seed] Failed to fetch data for {ticker}: {e}")
            continue

        session_dates = [pd.Timestamp(d).date() for d in ohlcv.index]
        if len(session_dates) < 15:
            print(f"[seed] Insufficient history for {ticker}. Skipping.")
            continue

        # Select trading dates closest to ~21d, ~14d, and ~7d ago
        target_21d = today - timedelta(days=21)
        target_14d = today - timedelta(days=14)
        target_7d = today - timedelta(days=7)

        d_21 = max([d for d in session_dates if d <= target_21d], default=session_dates[0])
        d_14 = max([d for d in session_dates if d <= target_14d], default=session_dates[len(session_dates) // 3])
        d_7 = max([d for d in session_dates if d <= target_7d], default=session_dates[len(session_dates) // 2])

        # (a) Train initial model using data up to d_21 (the earliest anchor date)
        # Guarantee: model training cutoff <= earliest anchor (d_21) so the model has zero lookahead leakage
        print(f"[seed] Training model for {ticker} with training end date <= {d_21}...")
        try:
            retrain_service.trigger_retrain(ticker, force=True, as_of=d_21, horizon=5, sync=True)
        except Exception as e:
            print(f"[seed] Model training failed for {ticker}: {e}")
            continue

        # (b) Create backdated forecast runs
        # Run 1: ~21 days ago
        try:
            run_21, _, _ = forecast_service.create_forecast(ticker, horizon=5, as_of=d_21, force_new=True)
            print(f"[seed] Created ghost run 1 (anchor={d_21}): run_id={run_21.id}")
        except Exception as e:
            print(f"[seed] Failed creating run at {d_21}: {e}")

        # Run 2: ~14 days ago
        try:
            run_14, _, _ = forecast_service.create_forecast(ticker, horizon=5, as_of=d_14, force_new=True)
            print(f"[seed] Created ghost run 2 (anchor={d_14}): run_id={run_14.id}")
        except Exception as e:
            print(f"[seed] Failed creating run at {d_14}: {e}")

        # Run 3: ~7 days ago (marked is_seeded_demo=True, left PENDING)
        try:
            run_7, points_7, _ = forecast_service.create_forecast(ticker, horizon=5, as_of=d_7, force_new=True)
            with Session(engine) as session:
                r = session.get(ForecastRun, run_7.id)
                if r:
                    r.is_seeded_demo = True
                    r.resolution_status = "PENDING"
                    session.add(r)
                    session.commit()
            print(f"[seed] Created pending demo run (anchor={d_7}): run_id={run_7.id} (status=PENDING, is_seeded_demo=True)")
        except Exception as e:
            print(f"[seed] Failed creating demo run at {d_7}: {e}")

    print("\n[seed] Demo seeding complete.")


if __name__ == "__main__":
    seed_demo_data()
