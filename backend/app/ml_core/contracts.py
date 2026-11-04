"""Stable I/O contract between notebook-exported ML code and the FastAPI service.
Changing this file is a breaking change. Notebooks must return these types."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from typing import Any, Literal, Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field

RegimeStatus = Literal["NORMAL", "ELEVATED_VOL", "OOD_WARNING"]


class ConfidenceBreakdown(BaseModel):
    model_config = ConfigDict(extra="forbid")
    directional_accuracy: float = Field(ge=0, le=1)          # walk-forward OOS
    picp_80: float = Field(ge=0, le=1)                        # empirical coverage of 80% band
    picp_95: float = Field(ge=0, le=1)
    mpiw_80_atr: float = Field(ge=0)                          # mean 80% width / ATR (as fraction of price)
    regime_vol_z: float                                       # current realized vol z-score vs history
    ood_max_abs_z: float = Field(ge=0)                        # max |z| across features, current row
    ood_features: list[str] = []                              # features with |z| > threshold
    component_scores: dict[str, float]                        # each 0-100: accuracy, calibration, tightness, regime
    weights: dict[str, float]


class ConfidenceReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confidence_score: float = Field(ge=0, le=100)
    regime_status: RegimeStatus
    breakdown: ConfidenceBreakdown


class ForecastPointOut(BaseModel):
    step_ahead: int
    target_trading_date: date
    predicted_return: float          # cumulative log-return from anchor
    predicted_close: float
    lower_80: float
    upper_80: float
    lower_95: float
    upper_95: float


class ForecastBundle(BaseModel):
    """Returned by the notebook pipeline for one live forecast."""
    model_config = ConfigDict(extra="forbid")
    ticker: str
    anchor_date: date
    anchor_close: float
    horizon: int
    points: list[ForecastPointOut]
    confidence: ConfidenceReport
    methodology_name: str


class HorizonMetrics(BaseModel):
    horizon: int
    mae_return: float
    rmse_return: float
    mae_price_pct: float
    directional_accuracy: float
    picp_80: float
    picp_95: float
    mpiw_80: float


class EvaluationSummary(BaseModel):
    """Returned by WalkForwardEvaluator + ConformalCalibrator after (re)training."""
    model_config = ConfigDict(extra="forbid")
    n_folds: int
    n_oos_obs: int
    walk_forward_mae: float          # price-% MAE averaged over horizons
    walk_forward_rmse: float
    directional_accuracy: float
    empirical_coverage_80: float
    empirical_coverage_95: float
    mpiw_80_atr: float
    sharpe_directional: float        # annualized Sharpe of sign(pred_1d) * realized 1d return
    per_horizon: list[HorizonMetrics]
    train_start_date: date
    train_end_date: date


class FeatureFrame(BaseModel):
    """Light wrapper; actual data is a DataFrame. Not serialized by FastAPI."""
    model_config = ConfigDict(arbitrary_types_allowed=True)
    X: Any            # pd.DataFrame (index = date, columns = feature_names)
    Y: Optional[Any]  # pd.DataFrame (columns y_1..y_H) or None for live inference
    feature_names: list[str]


class BaseForecasterContract(ABC):
    """Every ForecastModel in 02_model_architecture.ipynb MUST subclass this.
    Swapping XGBoost -> LightGBM/CatBoost/Ridge/PyTorch only requires a new subclass."""

    horizon: int
    quantiles: tuple[float, ...] = (0.10, 0.50, 0.90)

    @abstractmethod
    def fit(self, X: pd.DataFrame, Y: pd.DataFrame) -> "BaseForecasterContract":
        """X: (n, p) features. Y: (n, H) columns y_1..y_H cumulative log-returns."""

    @abstractmethod
    def predict_point(self, X: pd.DataFrame) -> np.ndarray:
        """Returns (n, H) point forecasts of cumulative log-returns."""

    @abstractmethod
    def predict_quantiles(self, X: pd.DataFrame) -> dict[float, np.ndarray]:
        """Returns {q: (n, H)} for each q in self.quantiles."""

    @abstractmethod
    def save(self, path: str) -> None: ...

    @classmethod
    @abstractmethod
    def load(cls, path: str) -> "BaseForecasterContract": ...

    @classmethod
    def methodology_name(cls) -> str:
        return cls.__name__

    def clone_unfitted(self) -> "BaseForecasterContract":
        """Fresh unfitted copy with identical hyperparameters (used per walk-forward fold)."""
        raise NotImplementedError

