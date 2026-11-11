from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select

from backend.app.models.tables import RetrainJob


class RetrainRepo:
    def create_job(
        self, session: Session, job_id: str, ticker: str, total_folds: int = 8
    ) -> RetrainJob:
        job = RetrainJob(
            id=job_id,
            ticker=ticker.upper(),
            stage="PENDING",
            progress_fold=0,
            total_folds=total_folds,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        return job

    def update_job(
        self,
        session: Session,
        job_id: str,
        stage: str,
        progress_fold: Optional[int] = None,
        total_folds: Optional[int] = None,
        diff: Optional[dict] = None,
        error: Optional[str] = None,
    ) -> Optional[RetrainJob]:
        job = session.get(RetrainJob, job_id)
        if not job:
            return None
        job.stage = stage
        if progress_fold is not None:
            job.progress_fold = progress_fold
        if total_folds is not None:
            job.total_folds = total_folds
        if diff is not None:
            job.diff = diff
        if error is not None:
            job.error = error
        job.updated_at = datetime.now(timezone.utc)
        session.add(job)
        session.commit()
        session.refresh(job)
        return job

    def get_job(self, session: Session, job_id: str) -> Optional[RetrainJob]:
        return session.get(RetrainJob, job_id)

    def get_active_job_for_ticker(
        self, session: Session, ticker: str
    ) -> Optional[RetrainJob]:
        stmt = (
            select(RetrainJob)
            .where(RetrainJob.ticker == ticker.upper())
            .where(RetrainJob.stage.in_(["PENDING", "FETCHING_DATA", "TRAINING_WALKFORWARD", "ACTIVATING"]))
            .order_by(RetrainJob.created_at.desc())
        )
        return session.exec(stmt).first()


retrain_repo = RetrainRepo()
