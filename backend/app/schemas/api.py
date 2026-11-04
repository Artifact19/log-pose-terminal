from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    ticker: str = Field(..., pattern=r"^[A-Za-z0-9.\-^=]{1,15}$")
    horizon: Optional[int] = Field(default=None, ge=1, le=20)
    as_of: Optional[date] = None
    force_new: Optional[bool] = False


class RetrainRequest(BaseModel):
    ticker: str = Field(..., pattern=r"^[A-Za-z0-9.\-^=]{1,15}$")
    force: Optional[bool] = False


class ReconcileRequest(BaseModel):
    ticker: Optional[str] = None


class OHLCVBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class MarketBarsResponse(BaseModel):
    ticker: str
    bars: list[OHLCVBar]
    last_bar_date: Optional[str] = None
    is_stale: bool = False


class HealthResponse(BaseModel):
    status: str
    db_backend: str
    ml_exports_in_sync: bool
    methodology_name: str
    disclaimer: str


class LedgerStatsResponse(BaseModel):
    ticker: Optional[str]
    window_days: int
    resolved_count: int
    mae_pct: float
    directional_accuracy: float
    coverage_80: float
    coverage_95: float


class ForecastPointDetail(BaseModel):
    id: Optional[int]
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


class ForecastRunDetail(BaseModel):
    id: uuid.UUID
    ticker: str
    model_version_id: int
    created_at: datetime
    anchor_date: date
    anchor_close_price: float
    horizon_days: int
    confidence_score: float
    regime_status: str
    confidence_metadata: dict
    resolution_status: str
    is_seeded_demo: bool
    points: list[ForecastPointDetail] = []
    history_bars: Optional[list[OHLCVBar]] = None


class GhostRunPoint(BaseModel):
    step_ahead: int
    target_trading_date: date
    predicted_close: float
    lower_80: float
    upper_80: float
    actual_close: Optional[float] = None
    inside_80_band: Optional[bool] = None


class GhostRun(BaseModel):
    run_id: uuid.UUID
    anchor_date: date
    anchor_close_price: float
    points: list[GhostRunPoint]


class RetrainStatusResponse(BaseModel):
    job_id: str
    ticker: str
    stage: str
    progress_fold: Optional[int] = None
    total_folds: Optional[int] = None
    diff: Optional[dict] = None
    error: Optional[str] = None

