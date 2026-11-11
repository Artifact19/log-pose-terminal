"""Thin ML orchestrator connecting notebook-exported classes to application services.
No ML math lives here; all methodology resides in exported_* modules.
"""
from __future__ import annotations

import importlib
import json
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd

from backend.app.ml_core.contracts import (
    ConfidenceReport,
    EvaluationSummary,
    ForecastBundle,
    ForecastPointOut,
)

ROOT = Path(__file__).resolve().parent.parent.parent.parent
ARTIFACT_DIR = ROOT / "artifacts"
MANIFEST_PATH = ROOT / "backend" / "app" / "ml_core" / "exported_manifest.json"


@dataclass
class MethodologyBundle:
    features_mod: Any
    model_mod: Any
    uncertainty_mod: Any
    methodology_name: str
    combined_hash: str


@dataclass
class TrainResult:
    version_tag: str
    evaluation_summary: EvaluationSummary
    artifact_path: str
    notebook_hash: str
    methodology_name: str


def load_methodology() -> MethodologyBundle:
    """Import exported modules dynamically and read manifest metadata."""
    feat_mod = importlib.import_module("backend.app.ml_core.exported_features")
    model_mod = importlib.import_module("backend.app.ml_core.exported_model")
    unc_mod = importlib.import_module("backend.app.ml_core.exported_uncertainty")

    methodology_name = getattr(
        model_mod, "METHODOLOGY_NAME", getattr(model_mod.ForecastModel, "methodology_name", lambda: "ForecastModel")()
    )

    combined_hash = "unknown"
    if MANIFEST_PATH.exists():
        try:
            m = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            combined_hash = m.get("combined_notebook_hash", "unknown")
        except Exception:
            pass

    return MethodologyBundle(
        features_mod=feat_mod,
        model_mod=model_mod,
        uncertainty_mod=unc_mod,
        methodology_name=methodology_name,
        combined_hash=combined_hash,
    )


def train(
    ohlcv: pd.DataFrame,
    ticker: str,
    horizon: int = 5,
    version_tag: Optional[str] = None,
    artifact_base_dir: Optional[Path] = None,
    progress_callback: Optional[Any] = None,
) -> TrainResult:
    """Run walk-forward evaluation, fit final model, calibrate intervals, and save bundle."""
    m = load_methodology()
    pipeline = m.features_mod.FeaturePipeline(horizon=horizon)
    frame = pipeline.build(ohlcv, with_targets=True)

    if len(frame.X) < 150:
        raise ValueError(f"Insufficient historical bars to train model for {ticker}: {len(frame.X)}")

    # Feature distribution stats for OOD detection
    feature_stats = {}
    for col in pipeline.feature_names:
        s = frame.X[col].astype(float)
        feature_stats[col] = {
            "mean": float(s.mean()),
            "std": float(max(1e-6, s.std())),
        }

    # Walk-forward evaluation and conformal calibration
    base_model = m.model_mod.ForecastModel(horizon=horizon)
    evaluator = m.uncertainty_mod.WalkForwardEvaluator(embargo=horizon, purge=horizon)
    oos_results, eval_summary, calibrator = evaluator.run(
        base_model, frame.X, frame.Y, progress_callback=progress_callback
    )

    # Fit final model on all labeled data
    final_model = m.model_mod.ForecastModel(horizon=horizon)
    final_model.fit(frame.X, frame.Y)

    # Generate version tag if not provided
    if not version_tag:
        version_tag = f"v{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}"

    base_dir = artifact_base_dir or ARTIFACT_DIR
    target_dir = base_dir / ticker.upper() / version_tag
    target_dir.mkdir(parents=True, exist_ok=True)
    bundle_path = target_dir / "bundle.joblib"

    artifact_bundle = {
        "model": final_model,
        "calibrator": calibrator,
        "feature_stats": feature_stats,
        "evaluation_summary": eval_summary,
        "feature_names": pipeline.feature_names,
        "horizon": horizon,
        "methodology_name": m.methodology_name,
        "combined_notebook_hash": m.combined_hash,
        "trained_at": datetime.utcnow().isoformat(),
    }
    joblib.dump(artifact_bundle, bundle_path)

    return TrainResult(
        version_tag=version_tag,
        evaluation_summary=eval_summary,
        artifact_path=str(bundle_path),
        notebook_hash=m.combined_hash,
        methodology_name=m.methodology_name,
    )


def predict(
    ohlcv: pd.DataFrame,
    ticker: str,
    artifact_path: str,
    projected_trading_dates: list[date],
    live_ledger_picp: Optional[float] = None,
    requested_horizon: Optional[int] = None,
) -> ForecastBundle:
    """Produce live multi-horizon forecasts with calibrated conformal cones and confidence."""
    m = load_methodology()
    bundle = joblib.load(artifact_path)

    model = bundle["model"]
    calibrator = bundle["calibrator"]
    feature_stats = bundle["feature_stats"]
    eval_summary: EvaluationSummary = bundle["evaluation_summary"]
    bundle_horizon: int = bundle["horizon"]
    horizon: int = min(requested_horizon, bundle_horizon) if requested_horizon else bundle_horizon

    pipeline = m.features_mod.FeaturePipeline(horizon=bundle_horizon)
    frame = pipeline.build(ohlcv, with_targets=False)

    if len(frame.X) == 0:
        raise ValueError(f"No valid feature rows for {ticker}")

    anchor_row = frame.X.iloc[-1:]
    anchor_close = float(ohlcv["Close"].iloc[-1])
    anchor_date = pd.Timestamp(ohlcv.index[-1]).date()

    # Point predictions & Quantiles in cumulative log-return space
    pred_returns = model.predict_point(anchor_row)[0]  # shape (H,)
    quantiles = model.predict_quantiles(anchor_row)
    q_lo = quantiles[0.10]
    q_hi = quantiles[0.90]

    # Conformal bands
    intervals = calibrator.intervals(np.array([pred_returns]), q_lo=q_lo, q_hi=q_hi)
    lo80 = intervals[0.80][0][0]
    hi80 = intervals[0.80][1][0]
    lo95 = intervals[0.95][0][0]
    hi95 = intervals[0.95][1][0]

    # Reconstruct prices: P_{t+h} = P_t * exp(R_{t,h})
    points: list[ForecastPointOut] = []
    live_80_widths = []

    for h in range(horizon):
        ret_pt = float(pred_returns[h])
        p_close = float(anchor_close * np.exp(ret_pt))
        p_lo80 = float(anchor_close * np.exp(lo80[h]))
        p_hi80 = float(anchor_close * np.exp(hi80[h]))
        p_lo95 = float(anchor_close * np.exp(lo95[h]))
        p_hi95 = float(anchor_close * np.exp(hi95[h]))

        live_80_widths.append((p_hi80 - p_lo80) / anchor_close)

        target_date = projected_trading_dates[h] if h < len(projected_trading_dates) else anchor_date

        points.append(
            ForecastPointOut(
                step_ahead=h + 1,
                target_trading_date=target_date,
                predicted_return=ret_pt,
                predicted_close=p_close,
                lower_80=p_lo80,
                upper_80=p_hi80,
                lower_95=p_lo95,
                upper_95=p_hi95,
            )
        )

    # Current ATR(14) %
    current_atr = float(anchor_row["atr_14_pct"].iloc[0]) if "atr_14_pct" in anchor_row else 0.02
    current_feat_series = anchor_row.iloc[0]

    confidence_report: ConfidenceReport = m.uncertainty_mod.build_confidence_report(
        summary=eval_summary,
        current_feature_row=current_feat_series,
        feature_stats=feature_stats,
        current_atr_pct=current_atr,
        live_80_widths=live_80_widths,
        live_ledger_picp=live_ledger_picp,
    )

    return ForecastBundle(
        ticker=ticker.upper(),
        anchor_date=anchor_date,
        anchor_close=anchor_close,
        horizon=horizon,
        points=points,
        confidence=confidence_report,
        methodology_name=bundle.get("methodology_name", m.methodology_name),
    )

