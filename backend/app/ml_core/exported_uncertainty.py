"""AUTO-GENERATED from 03_uncertainty_and_evaluation.ipynb by scripts/sync_notebooks.py. DO NOT EDIT.
Source notebook sha256: 981e457d363f3305db3b14d34d2be4f4635106b3ad9a408571abdd355a8e5871
Edit the notebook, then run: python scripts/sync_notebooks.py
"""
# ruff: noqa
# --- 03_uncertainty_and_evaluation.ipynb :: cell 1 ---
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Optional, Any
import numpy as np
import pandas as pd
from backend.app.ml_core.contracts import (
    ConfidenceBreakdown, ConfidenceReport, EvaluationSummary, HorizonMetrics, RegimeStatus
)

def weighted_quantile(values: np.ndarray, weights: np.ndarray, level: float) -> float:
    order = np.argsort(values)
    v, w = values[order], weights[order]
    cw = np.cumsum(w) / w.sum()
    idx = np.searchsorted(cw, min(level, 1.0), side="left")
    return float(v[min(idx, len(v) - 1)])

def recency_weights(n: int, half_life: int = 252) -> np.ndarray:
    lam = 0.5 ** (1.0 / half_life)
    w = lam ** (n - 1 - np.arange(n))
    return w / w.sum()

def picp(y: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> float:
    return float(np.mean((y >= lo) & (y <= hi)))

def mpiw(lo: np.ndarray, hi: np.ndarray) -> float:
    return float(np.mean(hi - lo))


@dataclass
class ConformalCalibrator:
    horizon: int
    half_life: int = 252
    interval_method: str = "cqr"            # "cqr" | "adaptive_abs"
    alphas: tuple = (0.20, 0.05)
    gamma: float = 0.01
    # fitted state, per horizon index 0..H-1
    abs_q: dict = field(default_factory=dict)    # {(h, alpha): q̂}
    cqr_q: dict = field(default_factory=dict)    # {(h, alpha): Q̂}  (only alpha=0.20 meaningful)
    alpha_t: dict = field(default_factory=dict)  # ACI state {h: alpha_t}
    n_cal: int = 0

    def fit(self, y_true: np.ndarray, y_point: np.ndarray, q_lo: Optional[np.ndarray] = None, q_hi: Optional[np.ndarray] = None):
        # All arrays shape (n, H), OOS, time-ordered. q_lo/q_hi are the 10%/90% quantile preds.
        n = y_true.shape[0]
        self.n_cal = n
        w = recency_weights(n, self.half_life)
        for h in range(self.horizon):
            scores = np.abs(y_true[:, h] - y_point[:, h])
            for a in self.alphas:
                level = min(1.0, (1.0 - a) * (1.0 + 1.0 / n))
                self.abs_q[(h, a)] = weighted_quantile(scores, w, level)
            if q_lo is not None and q_hi is not None:
                E = np.maximum(q_lo[:, h] - y_true[:, h], y_true[:, h] - q_hi[:, h])
                level = min(1.0, 0.80 * (1.0 + 1.0 / n))
                self.cqr_q[(h, 0.20)] = weighted_quantile(E, w, level)
            self.alpha_t[h] = 0.20
        return self

    def intervals(self, y_point: np.ndarray, q_lo: Optional[np.ndarray] = None, q_hi: Optional[np.ndarray] = None) -> dict[float, tuple[np.ndarray, np.ndarray]]:
        # Return dict {0.80: (lo, hi), 0.95: (lo, hi)}, each (n, H) in return space.
        out = {}
        for a, key in zip(self.alphas, (0.80, 0.95)):
            lo = np.zeros_like(y_point)
            hi = np.zeros_like(y_point)
            for h in range(self.horizon):
                if key == 0.80 and self.interval_method == "cqr" and q_lo is not None and (h, 0.20) in self.cqr_q:
                    Q = self.cqr_q[(h, 0.20)]
                    lo[:, h] = q_lo[:, h] - Q
                    hi[:, h] = q_hi[:, h] + Q
                else:
                    q = self.abs_q.get((h, a), 0.05)
                    lo[:, h] = y_point[:, h] - q
                    hi[:, h] = y_point[:, h] + q
            out[key] = (lo, hi)

        # guarantee nesting: 95% band contains 80% band
        lo80, hi80 = out[0.80]
        lo95, hi95 = out[0.95]
        out[0.95] = (np.minimum(lo95, lo80), np.maximum(hi95, hi80))
        return out

    def update_online(self, h: int, covered: bool) -> None:
        target = 0.20
        err = 0.0 if covered else 1.0
        cur = self.alpha_t.get(h, target)
        self.alpha_t[h] = float(np.clip(cur + self.gamma * (target - err), 0.01, 0.5))


@dataclass
class OOSResults:
    y_true: np.ndarray
    y_point: np.ndarray
    q_lo: np.ndarray
    q_hi: np.ndarray
    dates: list[date]
    fold_ids: np.ndarray


class WalkForwardEvaluator:
    def __init__(
        self,
        n_splits: int = 8,
        min_train: int = 756,
        test_size: int = 63,
        embargo: int = 5,
        purge: int = 5
    ):
        self.n_splits = n_splits
        self.min_train = min_train
        self.test_size = test_size
        self.embargo = embargo
        self.purge = purge

    def run(self, model: Any, X: pd.DataFrame, Y: pd.DataFrame) -> tuple[OOSResults, EvaluationSummary, ConformalCalibrator]:
        n_rows = len(X)
        H = Y.shape[1]
        req_len = self.min_train + self.n_splits * self.test_size + self.purge + self.embargo

        # If data is shorter than default, scale down splits/min_train adaptively
        actual_splits = self.n_splits
        actual_min_train = self.min_train
        actual_test_size = self.test_size

        if n_rows < req_len:
            actual_test_size = max(20, (n_rows - 200) // (self.n_splits + 1))
            actual_min_train = max(150, n_rows - actual_splits * actual_test_size - self.purge - self.embargo)

        oos_y_true = []
        oos_y_point = []
        oos_q_lo = []
        oos_q_hi = []
        oos_dates = []
        oos_folds = []

        total_folds_run = 0
        for fold in range(actual_splits):
            test_start = n_rows - (actual_splits - fold) * actual_test_size
            test_end = test_start + actual_test_size
            train_end = test_start - self.purge

            if train_end <= actual_min_train:
                continue

            X_tr, Y_tr = X.iloc[:train_end], Y.iloc[:train_end]
            X_te, Y_te = X.iloc[test_start:test_end], Y.iloc[test_start:test_end]

            fold_model = model.clone_unfitted()
            fold_model.fit(X_tr, Y_tr)

            pt_preds = fold_model.predict_point(X_te)
            q_preds = fold_model.predict_quantiles(X_te)

            oos_y_true.append(Y_te.values)
            oos_y_point.append(pt_preds)
            oos_q_lo.append(q_preds[0.10])
            oos_q_hi.append(q_preds[0.90])
            oos_dates.extend([pd.Timestamp(d).date() for d in X_te.index])
            oos_folds.append(np.full(len(X_te), fold))
            total_folds_run += 1

        if total_folds_run == 0:
            raise RuntimeError(f"Not enough data to run walk-forward validation: n_rows={n_rows}")

        y_true_all = np.vstack(oos_y_true)
        y_point_all = np.vstack(oos_y_point)
        q_lo_all = np.vstack(oos_q_lo)
        q_hi_all = np.vstack(oos_q_hi)
        fold_ids_all = np.concatenate(oos_folds)

        oos_results = OOSResults(
            y_true=y_true_all,
            y_point=y_point_all,
            q_lo=q_lo_all,
            q_hi=q_hi_all,
            dates=oos_dates,
            fold_ids=fold_ids_all
        )

        calibrator = ConformalCalibrator(horizon=H, interval_method="cqr")
        calibrator.fit(y_true_all, y_point_all, q_lo_all, q_hi_all)

        intervals = calibrator.intervals(y_point_all, q_lo_all, q_hi_all)
        lo80, hi80 = intervals[0.80]
        lo95, hi95 = intervals[0.95]

        # Calculate metrics
        per_horizon = []
        for h in range(H):
            mae_r = float(np.mean(np.abs(y_true_all[:, h] - y_point_all[:, h])))
            rmse_r = float(np.sqrt(np.mean((y_true_all[:, h] - y_point_all[:, h]) ** 2)))
            # Price % MAE: |exp(r_hat - r) - 1|
            mae_pct = float(np.mean(np.abs(np.exp(y_point_all[:, h] - y_true_all[:, h]) - 1.0)) * 100.0)
            da = float(np.mean(np.sign(y_point_all[:, h]) == np.sign(y_true_all[:, h])))
            p80 = picp(y_true_all[:, h], lo80[:, h], hi80[:, h])
            p95 = picp(y_true_all[:, h], lo95[:, h], hi95[:, h])
            m80 = mpiw(lo80[:, h], hi80[:, h])

            per_horizon.append(HorizonMetrics(
                horizon=h + 1,
                mae_return=mae_r,
                rmse_return=rmse_r,
                mae_price_pct=mae_pct,
                directional_accuracy=da,
                picp_80=p80,
                picp_95=p95,
                mpiw_80=m80
            ))

        wf_mae = float(np.mean([m.mae_price_pct for m in per_horizon]))
        wf_rmse = float(np.mean([m.rmse_return for m in per_horizon]))
        wf_da = float(np.mean([m.directional_accuracy for m in per_horizon]))
        wf_p80 = float(np.mean([m.picp_80 for m in per_horizon]))
        wf_p95 = float(np.mean([m.picp_95 for m in per_horizon]))
        wf_mpiw = float(np.mean([m.mpiw_80 for m in per_horizon]))

        # Annualized Sharpe of sign(pred_1d) * realized 1d return
        s1 = np.sign(y_point_all[:, 0])
        r1 = y_true_all[:, 0]
        strat_ret = s1 * r1
        std_strat = np.std(strat_ret)
        sharpe = float(np.sqrt(252) * np.mean(strat_ret) / (std_strat + 1e-9)) if std_strat > 0 else 0.0

        summary = EvaluationSummary(
            n_folds=total_folds_run,
            n_oos_obs=len(y_true_all),
            walk_forward_mae=wf_mae,
            walk_forward_rmse=wf_rmse,
            directional_accuracy=wf_da,
            empirical_coverage_80=wf_p80,
            empirical_coverage_95=wf_p95,
            mpiw_80_atr=wf_mpiw,
            sharpe_directional=sharpe,
            per_horizon=per_horizon,
            train_start_date=pd.Timestamp(X.index[0]).date(),
            train_end_date=pd.Timestamp(X.index[-1]).date()
        )

        return oos_results, summary, calibrator


def build_confidence_report(
    summary: EvaluationSummary,
    current_feature_row: pd.Series,
    feature_stats: dict[str, dict[str, float]],
    current_atr_pct: float,
    live_80_widths: list[float],
    live_ledger_picp: Optional[float] = None
) -> ConfidenceReport:
    # Build transparent 0-100 score + regime status
    da = summary.directional_accuracy
    S_acc = float(np.clip((da - 0.50) / 0.10, 0.0, 1.0) * 100.0)

    # 2. Calibration score: 80% coverage target
    picp_80 = summary.empirical_coverage_80
    if live_ledger_picp is not None:
        picp_80 = 0.70 * picp_80 + 0.30 * live_ledger_picp
    S_cal = float(np.clip(1.0 - abs(picp_80 - 0.80) / 0.15, 0.0, 1.0) * 100.0)

    # 3. Tightness score
    mean_width = float(np.mean(live_80_widths)) if live_80_widths else 0.03
    mpiw_80_atr = mean_width / max(1e-4, current_atr_pct)
    S_tight = float(np.clip(1.0 - (mpiw_80_atr - 1.5) / 4.5, 0.0, 1.0) * 100.0)

    # 4. Regime score
    yz_vol = float(current_feature_row.get("vol_yz_20d", 0.015))
    yz_stats = feature_stats.get("vol_yz_20d", {"mean": 0.015, "std": 0.005})
    z_vol = (yz_vol - yz_stats["mean"]) / max(1e-6, yz_stats["std"])
    S_reg = float(np.clip(1.0 - max(0.0, abs(z_vol) - 1.0) / 2.0, 0.0, 1.0) * 100.0)

    # OOD check across all features
    ood_features = []
    max_abs_z = 0.0
    for feat, val in current_feature_row.items():
        if feat in feature_stats:
            mu = feature_stats[feat]["mean"]
            sig = feature_stats[feat]["std"]
            z = abs(val - mu) / max(1e-6, sig)
            if z > max_abs_z:
                max_abs_z = z
            if z > 4.0:
                ood_features.append(str(feat))

    # OOD penalty multiplier
    if max_abs_z <= 3.0:
        penalty_m = 1.0
    elif max_abs_z >= 6.0:
        penalty_m = 0.5
    else:
        penalty_m = 1.0 - 0.5 * ((max_abs_z - 3.0) / 3.0)

    comp_scores = {
        "accuracy": S_acc,
        "calibration": S_cal,
        "tightness": S_tight,
        "regime": S_reg
    }
    weights = {
        "accuracy": 0.30,
        "calibration": 0.30,
        "tightness": 0.20,
        "regime": 0.20
    }
    raw_composite = (0.30 * S_acc + 0.30 * S_cal + 0.20 * S_tight + 0.20 * S_reg)
    final_score = round(float(np.clip(raw_composite * penalty_m, 0.0, 100.0)), 1)

    # Regime status
    vol_ratio_5_20 = float(current_feature_row.get("vol_ratio_5_20", 1.0))
    if max_abs_z > 5.0 or len(ood_features) >= 3:
        regime_status: RegimeStatus = "OOD_WARNING"
    elif z_vol > 1.5 or vol_ratio_5_20 > 1.6:
        regime_status = "ELEVATED_VOL"
    else:
        regime_status = "NORMAL"

    breakdown = ConfidenceBreakdown(
        directional_accuracy=float(da),
        picp_80=float(summary.empirical_coverage_80),
        picp_95=float(summary.empirical_coverage_95),
        mpiw_80_atr=float(mpiw_80_atr),
        regime_vol_z=float(z_vol),
        ood_max_abs_z=float(max_abs_z),
        ood_features=ood_features,
        component_scores=comp_scores,
        weights=weights
    )

    return ConfidenceReport(
        confidence_score=final_score,
        regime_status=regime_status,
        breakdown=breakdown
    )
