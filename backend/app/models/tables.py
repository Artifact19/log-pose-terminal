from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Column, Index, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

JSONType = JSON().with_variant(JSONB(), "postgresql")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ModelVersion(SQLModel, table=True):
    __tablename__ = "model_version"
    __table_args__ = (UniqueConstraint("ticker", "version_tag"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    version_tag: str
    methodology_name: str
    trained_at: datetime = Field(default_factory=utc_now)
    train_start_date: date
    train_end_date: date
    horizon_days: int = 5
    walk_forward_mae: float
    walk_forward_rmse: float
    directional_accuracy: float
    empirical_coverage_80: float
    empirical_coverage_95: Optional[float] = None
    mpiw_80_atr: Optional[float] = None
    artifact_path: str
    notebook_hash: str
    metrics_json: Optional[dict] = Field(default=None, sa_column=Column(JSONType))
    is_active: bool = Field(default=False, index=True)


class ForecastRun(SQLModel, table=True):
    __tablename__ = "forecast_run"
    __table_args__ = (Index("ix_run_ticker_created", "ticker", "created_at"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ticker: str = Field(index=True)
    model_version_id: int = Field(foreign_key="model_version.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    anchor_date: date = Field(index=True)
    anchor_close_price: float
    horizon_days: int
    confidence_score: float
    regime_status: str
    confidence_metadata: dict = Field(default_factory=dict, sa_column=Column(JSONType))
    resolution_status: str = Field(default="PENDING", index=True)
    is_seeded_demo: bool = False


class ForecastPoint(SQLModel, table=True):
    __tablename__ = "forecast_point"
    __table_args__ = (
        UniqueConstraint("forecast_run_id", "step_ahead"),
        Index("ix_point_unresolved", "actual_close", "target_trading_date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    forecast_run_id: uuid.UUID = Field(foreign_key="forecast_run.id", index=True)
    step_ahead: int
    target_trading_date: date
    predicted_return: float
    predicted_close: float
    lower_80: float
    upper_80: float
    lower_95: float
    upper_95: float
    actual_close: Optional[float] = None
    actual_return: Optional[float] = None
    abs_error: Optional[float] = None
    pct_error: Optional[float] = None
    direction_correct: Optional[bool] = None
    inside_80_band: Optional[bool] = None
    inside_95_band: Optional[bool] = None
    resolved_at: Optional[datetime] = None
