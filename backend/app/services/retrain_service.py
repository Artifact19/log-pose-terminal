from __future__ import annotations

import logging
import threading
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

import pandas as pd
from sqlmodel import Session

from backend.app.config import settings
from backend.app.db import engine
from backend.app.ml_core.manifest import check_sync
from backend.app.ml_core.pipeline import ROOT, train
from backend.app.models.tables import ModelVersion
from backend.app.repositories.forecast_repo import forecast_repo
from backend.app.repositories.model_repo import model_repo
from backend.app.repositories.retrain_repo import retrain_repo
from backend.app.services.artifact_service import artifact_service
from backend.app.services.data_service import data_service

logger = logging.getLogger("retrain_service")

_jobs_lock = threading.Lock()
_ticker_locks: dict[str, threading.Lock] = {}


def get_job_status(job_id: str) -> Optional[dict[str, Any]]:
    with Session(engine) as session:
        job = retrain_repo.get_job(session, job_id)
        if not job:
            return None
        return {
            "job_id": job.id,
            "ticker": job.ticker,
            "stage": job.stage,
            "progress_fold": job.progress_fold,
            "total_folds": job.total_folds,
            "diff": job.diff,
            "error": job.error,
        }


class RetrainService:
    def trigger_retrain(
        self,
        ticker: str,
        force: bool = False,
        as_of: Optional[date] = None,
        horizon: Optional[int] = None,
        sync: bool = False,
    ) -> dict[str, Any]:
        t = ticker.upper()
        # Train only the horizon actually needed (default 5, max MAX_HORIZON)
        h = min(max(horizon or settings.DEFAULT_HORIZON, 1), settings.MAX_HORIZON)
        job_id = str(uuid.uuid4())

        with _jobs_lock:
            if t not in _ticker_locks:
                _ticker_locks[t] = threading.Lock()
            ticker_lock = _ticker_locks[t]

        # Check if already running
        acquired = ticker_lock.acquire(blocking=False)
        if not acquired:
            raise RuntimeError(f"Retraining already in progress for {t}")

        # Check need to retrain if not forcing
        with Session(engine) as session:
            active = model_repo.get_active(session, t)

        if not force and active is not None:
            should_retrain, reason = self._check_need_to_retrain(t, active)
            if not should_retrain:
                ticker_lock.release()
                return {
                    "job_id": job_id,
                    "ticker": t,
                    "retrained": False,
                    "stage": "DONE",
                    "reason": reason,
                    "active_version": active.version_tag,
                }

        # Initialize job in database
        with Session(engine) as session:
            retrain_repo.create_job(session, job_id=job_id, ticker=t, total_folds=8)

        if sync:
            try:
                diff = self._execute_retrain(job_id, t, h, force, as_of)
                return diff
            finally:
                ticker_lock.release()
        else:
            # Run in background daemon thread
            t_thread = threading.Thread(
                target=self._run_job_worker,
                args=(job_id, t, h, force, as_of, ticker_lock),
                daemon=True,
            )
            t_thread.start()
            return {
                "job_id": job_id,
                "ticker": t,
                "stage": "PENDING",
                "retrained": False,
                "message": f"Retraining job {job_id} initiated in background for {t}.",
            }

    def _run_job_worker(
        self,
        job_id: str,
        ticker: str,
        horizon: int,
        force: bool,
        as_of: Optional[date],
        ticker_lock: threading.Lock,
    ):
        try:
            self._execute_retrain(job_id, ticker, horizon, force, as_of)
        except Exception as e:
            logger.error(f"Retrain background job {job_id} failed: {e}", exc_info=True)
            with Session(engine) as session:
                retrain_repo.update_job(session, job_id=job_id, stage="FAILED", error=str(e))
        finally:
            ticker_lock.release()

    def _check_need_to_retrain(
        self, ticker: str, active: ModelVersion
    ) -> tuple[bool, str]:
        # 1. Methodology changed
        in_sync, _ = check_sync(ROOT)
        from backend.app.ml_core.pipeline import load_methodology

        m = load_methodology()
        if m.combined_hash != active.notebook_hash:
            return True, f"Methodology changed (hash {m.combined_hash[:8]} vs {active.notebook_hash[:8]})"

        # 2. Check degradation
        with Session(engine) as session:
            stats = forecast_repo.calculate_stats(
                session, ticker=ticker, window_days=settings.RETRAIN_LOOKBACK_DAYS
            )
        if stats["resolved_count"] >= 10 and stats["coverage_80"] < settings.RETRAIN_COVERAGE_FLOOR:
            return True, f"Coverage degradation: {stats['coverage_80']:.2f} < floor {settings.RETRAIN_COVERAGE_FLOOR}"
        if stats["resolved_count"] >= 20 and stats["directional_accuracy"] < 0.45:
            return True, f"Hit rate degradation: {stats['directional_accuracy']:.2f} < 0.45"

        # 3. New trading bars
        try:
            recent = data_service.fetch_ohlcv(
                ticker, start=active.train_end_date, auto_adjust=True
            )
            latest_session = pd.Timestamp(recent.index[-1]).date()
            if latest_session > active.train_end_date:
                return True, f"New bars available: latest={latest_session} > train_end={active.train_end_date}"
        except Exception as e:
            logger.debug(f"Could not check new trading bars: {e}")

        return False, "Model is up-to-date and performing within parameters"

    def _execute_retrain(
        self,
        job_id: str,
        ticker: str,
        horizon: int,
        force: bool,
        as_of: Optional[date] = None,
    ) -> dict[str, Any]:
        with Session(engine) as session:
            retrain_repo.update_job(session, job_id=job_id, stage="FETCHING_DATA")

        start_date = date.today() - timedelta(days=settings.DEFAULT_TRAIN_YEARS * 365)
        end_date = as_of or date.today()

        ohlcv = data_service.fetch_ohlcv(
            ticker, start=start_date, end=end_date, auto_adjust=True
        )

        with Session(engine) as session:
            retrain_repo.update_job(
                session,
                job_id=job_id,
                stage="TRAINING_WALKFORWARD",
                progress_fold=0,
                total_folds=8,
            )

        def fold_callback(current_fold: int, total_folds: int):
            with Session(engine) as s:
                retrain_repo.update_job(
                    s,
                    job_id=job_id,
                    stage="TRAINING_WALKFORWARD",
                    progress_fold=current_fold,
                    total_folds=total_folds,
                )

        train_res = train(
            ohlcv,
            ticker,
            horizon=horizon,
            progress_callback=fold_callback,
        )

        # Upload model artifact to Supabase Storage if configured
        storage_key = artifact_service.upload_artifact(
            ticker=ticker,
            version_tag=train_res.version_tag,
            local_path=train_res.artifact_path,
        )

        with Session(engine) as session:
            retrain_repo.update_job(session, job_id=job_id, stage="ACTIVATING")
            active_before = model_repo.get_active(session, ticker)

            # Insert new ModelVersion
            sumry = train_res.evaluation_summary
            new_model = ModelVersion(
                ticker=ticker.upper(),
                version_tag=train_res.version_tag,
                methodology_name=train_res.methodology_name,
                train_start_date=sumry.train_start_date,
                train_end_date=sumry.train_end_date,
                horizon_days=horizon,
                walk_forward_mae=sumry.walk_forward_mae,
                walk_forward_rmse=sumry.walk_forward_rmse,
                directional_accuracy=sumry.directional_accuracy,
                empirical_coverage_80=sumry.empirical_coverage_80,
                empirical_coverage_95=sumry.empirical_coverage_95,
                mpiw_80_atr=sumry.mpiw_80_atr,
                artifact_path=storage_key,
                notebook_hash=train_res.notebook_hash,
                metrics_json=sumry.model_dump(mode="json"),
                is_active=False,
            )
            saved_model = model_repo.create(session, new_model)

            # Activation decision
            activation_threshold = float(getattr(settings, "RETRAIN_ACTIVATION_COVERAGE", 0.70))
            if force or active_before is None:
                should_activate = True
                activation_reason = "Forced activation" if force else "Initial model activation"
            else:
                coverage_ok = sumry.empirical_coverage_80 >= activation_threshold
                mae_ok = sumry.walk_forward_mae <= active_before.walk_forward_mae * 1.10
                if coverage_ok and mae_ok:
                    should_activate = True
                    activation_reason = "Gating passed: 80% coverage and MAE within tolerance"
                else:
                    should_activate = False
                    activation_reason = (
                        f"Gating failed: cov80={sumry.empirical_coverage_80:.2f} (req >= {activation_threshold:.2f}), "
                        f"mae={sumry.walk_forward_mae:.2f} vs prev {active_before.walk_forward_mae:.2f}"
                    )

            if should_activate:
                model_repo.activate(session, saved_model.id, ticker)

            old_metrics = (
                {
                    "walk_forward_mae": active_before.walk_forward_mae,
                    "walk_forward_rmse": active_before.walk_forward_rmse,
                    "directional_accuracy": active_before.directional_accuracy,
                    "empirical_coverage_80": active_before.empirical_coverage_80,
                    "mpiw_80_atr": active_before.mpiw_80_atr,
                }
                if active_before
                else None
            )

            new_metrics = {
                "walk_forward_mae": sumry.walk_forward_mae,
                "walk_forward_rmse": sumry.walk_forward_rmse,
                "directional_accuracy": sumry.directional_accuracy,
                "empirical_coverage_80": sumry.empirical_coverage_80,
                "mpiw_80_atr": sumry.mpiw_80_atr,
            }

            delta = {}
            if old_metrics:
                for k, v in new_metrics.items():
                    if v is not None and old_metrics.get(k) is not None:
                        delta[k] = round(v - old_metrics[k], 4)

            diff = {
                "retrained": True,
                "job_id": job_id,
                "ticker": ticker,
                "activated": should_activate,
                "activation_reason": activation_reason,
                "new_version_tag": train_res.version_tag,
                "old": old_metrics,
                "new": new_metrics,
                "delta": delta,
            }

            retrain_repo.update_job(session, job_id=job_id, stage="DONE", diff=diff)
            return diff


retrain_service = RetrainService()
