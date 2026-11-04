"""AUTO-GENERATED from 02_model_architecture.ipynb by scripts/sync_notebooks.py. DO NOT EDIT.
Source notebook sha256: 4bfb48741110e89a4622b37f76425319467538b4bc0fa896d32ed0b353f85e76
Edit the notebook, then run: python scripts/sync_notebooks.py
"""
# ruff: noqa
# --- 02_model_architecture.ipynb :: cell 1 ---
from __future__ import annotations
from typing import Any
import numpy as np
import pandas as pd
import joblib
from xgboost import XGBRegressor
from backend.app.ml_core.contracts import BaseForecasterContract

METHODOLOGY_NAME = "XGBoostDirectMultiHorizon"


class ForecastModel(BaseForecasterContract):
    def __init__(
        self,
        horizon: int = 5,
        n_estimators: int = 400,
        max_depth: int = 3,
        learning_rate: float = 0.03,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        min_child_weight: float = 10.0,
        reg_lambda: float = 5.0,
        tree_method: str = "hist",
        random_state: int = 42,
        n_jobs: int = -1
    ):
        self.horizon = horizon
        self.quantiles = (0.10, 0.50, 0.90)
        self.params = dict(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=subsample,
            colsample_bytree=colsample_bytree,
            min_child_weight=min_child_weight,
            reg_lambda=reg_lambda,
            tree_method=tree_method,
            random_state=random_state,
            n_jobs=n_jobs
        )
        self.point_models: list[XGBRegressor] = []
        self.quantile_models: dict[float, list[XGBRegressor]] = {q: [] for q in self.quantiles}
        self.is_fitted = False

    def clone_unfitted(self) -> "ForecastModel":
        return ForecastModel(horizon=self.horizon, **self.params)

    @classmethod
    def methodology_name(cls) -> str:
        return METHODOLOGY_NAME

    def fit(self, X: pd.DataFrame, Y: pd.DataFrame) -> "ForecastModel":
        X_mat = X.values if isinstance(X, pd.DataFrame) else X
        Y_mat = Y.values if isinstance(Y, pd.DataFrame) else Y

        self.point_models = []
        self.quantile_models = {q: [] for q in self.quantiles}

        for h in range(self.horizon):
            y_h = Y_mat[:, h]
            # Point model
            m_pt = XGBRegressor(objective="reg:squarederror", **self.params)
            m_pt.fit(X_mat, y_h)
            self.point_models.append(m_pt)

            # Quantile models
            for q in self.quantiles:
                m_q = XGBRegressor(objective="reg:quantileerror", quantile_alpha=q, **self.params)
                m_q.fit(X_mat, y_h)
                self.quantile_models[q].append(m_q)

        self.is_fitted = True
        return self

    def predict_point(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted.")
        X_mat = X.values if isinstance(X, pd.DataFrame) else X
        preds = [self.point_models[h].predict(X_mat) for h in range(self.horizon)]
        return np.column_stack(preds)

    def predict_quantiles(self, X: pd.DataFrame) -> dict[float, np.ndarray]:
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted.")
        X_mat = X.values if isinstance(X, pd.DataFrame) else X
        n = X_mat.shape[0]

        raw_q = {}
        for q in self.quantiles:
            q_preds = [self.quantile_models[q][h].predict(X_mat) for h in range(self.horizon)]
            raw_q[q] = np.column_stack(q_preds)  # (n, H)

        # Enforce non-crossing: for each row and horizon, sort (q10, q50, q90)
        q_stack = np.stack([raw_q[0.10], raw_q[0.50], raw_q[0.90]], axis=2)  # (n, H, 3)
        q_sorted = np.sort(q_stack, axis=2)

        return {
            0.10: q_sorted[:, :, 0],
            0.50: q_sorted[:, :, 1],
            0.90: q_sorted[:, :, 2]
        }

    def save(self, path: str) -> None:
        state = {
            "horizon": self.horizon,
            "params": self.params,
            "point_models": self.point_models,
            "quantile_models": self.quantile_models,
            "is_fitted": self.is_fitted
        }
        joblib.dump(state, path)

    @classmethod
    def load(cls, path: str) -> "ForecastModel":
        state = joblib.load(path)
        inst = cls(horizon=state["horizon"], **state["params"])
        inst.point_models = state["point_models"]
        inst.quantile_models = state["quantile_models"]
        inst.is_fitted = state["is_fitted"]
        return inst


class NaivePersistenceBaseline(BaseForecasterContract):
    # Predicts zero log-return for all horizons
    def __init__(self, horizon: int = 5):
        self.horizon = horizon

    def clone_unfitted(self) -> "NaivePersistenceBaseline":
        return NaivePersistenceBaseline(horizon=self.horizon)

    def fit(self, X: pd.DataFrame, Y: pd.DataFrame) -> "NaivePersistenceBaseline":
        return self

    def predict_point(self, X: pd.DataFrame) -> np.ndarray:
        n = len(X)
        return np.zeros((n, self.horizon))

    def predict_quantiles(self, X: pd.DataFrame) -> dict[float, np.ndarray]:
        n = len(X)
        return {
            0.10: np.full((n, self.horizon), -0.02),
            0.50: np.zeros((n, self.horizon)),
            0.90: np.full((n, self.horizon), 0.02)
        }

    def save(self, path: str) -> None:
        joblib.dump({"horizon": self.horizon}, path)

    @classmethod
    def load(cls, path: str) -> "NaivePersistenceBaseline":
        state = joblib.load(path)
        return cls(horizon=state["horizon"])
