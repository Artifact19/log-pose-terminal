"""End-to-end audit verification script per Section 10 Phase 6 of ANTIGRAVITY_SPEC.md.

Executes all 8 verification steps and prints a comprehensive PASS/FAIL table.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import json
from datetime import date, timedelta
from sqlmodel import Session, select
import pandas as pd

from backend.app.db import engine, init_db
from backend.app.models.tables import ForecastPoint, ForecastRun, ModelVersion
from backend.app.repositories.forecast_repo import forecast_repo
from backend.app.repositories.model_repo import model_repo
from backend.app.services.data_service import data_service
from backend.app.services.forecast_service import forecast_service
from backend.app.services.reconciliation_service import reconciliation_service
from backend.app.services.retrain_service import retrain_service
from scripts.sync_notebooks import check, sync


def run_verification() -> bool:
    init_db()
    results: list[tuple[str, bool, str]] = []
    print("=" * 70)
    print("LOG POSE TERMINAL END-TO-END VERIFICATION")
    print("=" * 70)

    # 1. Sync Check
    print("\n[Step 1] Verifying notebook exports sync...")
    step1_pass = check()
    results.append(("1. Notebook Exports Sync Check", step1_pass, "Exports match notebook cells"))
    print(f" -> {'PASS' if step1_pass else 'FAIL'}")

    # 2. Pick AAPL and ensure trained model exists
    print("\n[Step 2] Model retrieval / calibration for AAPL...")
    ticker = "AAPL"
    today = date.today()
    try:
        with Session(engine) as session:
            active_m = model_repo.get_active(session, ticker)
        if not active_m:
            retrain_res = retrain_service.trigger_retrain(ticker, force=True, horizon=5)
            with Session(engine) as session:
                active_m = model_repo.get_active(session, ticker)
        step2_pass = active_m is not None and Path(active_m.artifact_path).exists()
        results.append(("2. Active Model Available & Valid", step2_pass, f"Version: {active_m.version_tag}"))
    except Exception as e:
        step2_pass = False
        results.append(("2. Active Model Available & Valid", False, str(e)))
    print(f" -> {'PASS' if step2_pass else 'FAIL'}")

    # 3. Create backdated forecast at ~10 days ago
    print("\n[Step 3] Creating backdated forecast...")
    try:
        ohlcv = data_service.fetch_ohlcv(ticker, start=today - timedelta(days=60), auto_adjust=True)
        session_dates = [pd.Timestamp(d).date() for d in ohlcv.index]
        target_as_of = today - timedelta(days=10)
        as_of = max([d for d in session_dates if d <= target_as_of], default=session_dates[-6])

        run, points, _ = forecast_service.create_forecast(ticker, horizon=5, as_of=as_of, force_new=True)
        step3_pass = (
            run is not None
            and len(points) == 5
            and run.resolution_status in ("PENDING", "PARTIALLY_RESOLVED", "RESOLVED")
        )
        results.append(("3. Backdated Forecast Creation", step3_pass, f"Run ID: {run.id}, anchor={run.anchor_date}"))
    except Exception as e:
        step3_pass = False
        run = None
        results.append(("3. Backdated Forecast Creation", False, str(e)))
    print(f" -> {'PASS' if step3_pass else 'FAIL'}")

    # 4. Reconciliation against real yfinance closes
    print("\n[Step 4] Running live reconciliation against realized closes...")
    try:
        rec_res = reconciliation_service.resolve_pending_forecasts(ticker=ticker, today=today)
        with Session(engine) as session:
            refreshed_pts = forecast_repo.get_run_points(session, run.id)
            refreshed_run = forecast_repo.get_run(session, run.id)

        resolved_pts = [p for p in refreshed_pts if p.actual_close is not None]
        # At least some points should have elapsed since anchor was ~10 days ago
        step4_pass = (
            len(resolved_pts) > 0
            and refreshed_run.resolution_status in ("PARTIALLY_RESOLVED", "RESOLVED")
            and all(p.abs_error is not None for p in resolved_pts)
            and all(p.direction_correct is not None for p in resolved_pts)
        )

        # Idempotency check: second run resolves 0 new points
        rec_res2 = reconciliation_service.resolve_pending_forecasts(ticker=ticker, today=today)
        idempotent = rec_res2["resolved_points"] == 0
        step4_pass = step4_pass and idempotent

        results.append((
            "4. Reconciliation & Idempotency",
            step4_pass,
            f"{len(resolved_pts)}/5 resolved, status={refreshed_run.resolution_status}, 2nd run={rec_res2['resolved_points']} new",
        ))
    except Exception as e:
        step4_pass = False
        results.append(("4. Reconciliation & Idempotency", False, str(e)))
    print(f" -> {'PASS' if step4_pass else 'FAIL'}")

    # 5. Live ledger metrics
    print("\n[Step 5] Checking live ledger scorecard metrics...")
    try:
        with Session(engine) as session:
            stats = forecast_repo.calculate_stats(session, ticker=ticker, window_days=60)
        step5_pass = stats["resolved_count"] > 0
        results.append((
            "5. Live Ledger Scorecard Stats",
            step5_pass,
            f"MAE: {stats['mae_pct']:.2f}%, Hit: {stats['directional_accuracy']*100:.1f}%, Cov80: {stats['coverage_80']*100:.1f}%, N={stats['resolved_count']}",
        ))
    except Exception as e:
        step5_pass = False
        results.append(("5. Live Ledger Scorecard Stats", False, str(e)))
    print(f" -> {'PASS' if step5_pass else 'FAIL'}")

    # 6. Retraining & Lineage preservation
    print("\n[Step 6] Triggering model retrain and verifying lineage preservation...")
    try:
        with Session(engine) as session:
            m_before = model_repo.get_active(session, ticker)
            runs_before = forecast_repo.list_runs(session, ticker=ticker)

        retrain_diff = retrain_service.trigger_retrain(ticker, force=True, horizon=5)

        with Session(engine) as session:
            m_after = model_repo.get_active(session, ticker)
            all_m = model_repo.list_for_ticker(session, ticker)
            # Verify old run's model_version_id is preserved
            run_check = forecast_repo.get_run(session, run.id)

        old_art_exists = Path(m_before.artifact_path).exists() if m_before else True
        new_art_exists = Path(m_after.artifact_path).exists() if m_after else False

        step6_pass = (
            retrain_diff.get("retrained") is True
            and m_after.version_tag != m_before.version_tag
            and old_art_exists
            and new_art_exists
            and run_check.model_version_id == run.model_version_id
        )
        results.append((
            "6. Retraining & Lineage Immutability",
            step6_pass,
            f"New tag: {m_after.version_tag}, old artifact preserved, lineage intact",
        ))
    except Exception as e:
        step6_pass = False
        results.append(("6. Retraining & Lineage Immutability", False, str(e)))
    print(f" -> {'PASS' if step6_pass else 'FAIL'}")

    # 7. Methodology change detection simulation
    print("\n[Step 7] Simulating methodology change detection...")
    try:
        nb_path = ROOT / "notebooks" / "02_model_architecture.ipynb"
        nb_text = nb_path.read_text(encoding="utf-8")
        # Temporarily add a harmless comment in the export cell
        modified_text = nb_text.replace(
            "n_estimators: int = 400", "n_estimators: int = 401"
        )
        nb_path.write_text(modified_text, encoding="utf-8")
        sync()

        # Check that trigger_retrain detects the methodology change
        should_retrain, reason = retrain_service._check_need_to_retrain(ticker, m_after)
        detected = should_retrain and "Methodology changed" in reason

        # Revert notebook modification
        nb_path.write_text(nb_text, encoding="utf-8")
        sync()

        step7_pass = detected
        results.append(("7. Methodology Drift Detection", step7_pass, f"Detected: {reason}"))
    except Exception as e:
        step7_pass = False
        results.append(("7. Methodology Drift Detection", False, str(e)))
    print(f" -> {'PASS' if step7_pass else 'FAIL'}")

    # 8. Summary Table
    print("\n" + "=" * 70)
    print("VERIFICATION RESULTS SUMMARY TABLE")
    print("=" * 70)
    all_passed = True
    for name, passed, detail in results:
        status_str = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False
        print(f"[{status_str:4s}] {name:38s} | {detail}")
    print("=" * 70)
    print(f"OVERALL STATUS: {'ALL CHECKS PASSED (100%)' if all_passed else 'SOME CHECKS FAILED'}")
    print("=" * 70 + "\n")

    return all_passed


if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)

