from __future__ import annotations

from typing import Optional
from sqlmodel import Session, select
from backend.app.models.tables import ModelVersion


class ModelRepository:
    def get_active(self, session: Session, ticker: str) -> Optional[ModelVersion]:
        statement = (
            select(ModelVersion)
            .where(ModelVersion.ticker == ticker.upper(), ModelVersion.is_active == True)  # noqa: E712
            .order_by(ModelVersion.trained_at.desc())
        )
        return session.exec(statement).first()

    def get_by_id(self, session: Session, model_id: int) -> Optional[ModelVersion]:
        return session.get(ModelVersion, model_id)

    def list_for_ticker(self, session: Session, ticker: str) -> list[ModelVersion]:
        statement = (
            select(ModelVersion)
            .where(ModelVersion.ticker == ticker.upper())
            .order_by(ModelVersion.trained_at.desc())
        )
        return list(session.exec(statement).all())

    def create(self, session: Session, model_version: ModelVersion) -> ModelVersion:
        session.add(model_version)
        session.commit()
        session.refresh(model_version)
        return model_version

    def activate(self, session: Session, model_version_id: int, ticker: str) -> Optional[ModelVersion]:
        """Ensure at most one active model per ticker."""
        all_models = self.list_for_ticker(session, ticker)
        target = None
        for m in all_models:
            if m.id == model_version_id:
                m.is_active = True
                target = m
            else:
                m.is_active = False
            session.add(m)
        session.commit()
        if target:
            session.refresh(target)
        return target


model_repo = ModelRepository()

