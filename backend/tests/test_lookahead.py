import numpy as np
import pandas as pd
import pytest
from backend.app.ml_core.exported_features import FeaturePipeline


def make_synthetic_ohlcv(n: int = 250, seed: int = 42) -> pd.DataFrame:
    rng = np.random.RandomState(seed)
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    returns = rng.normal(0.0005, 0.015, size=n)
    close = 100.0 * np.exp(np.cumsum(returns))
    high = close * (1.0 + rng.uniform(0.002, 0.015, size=n))
    low = close * (1.0 - rng.uniform(0.002, 0.015, size=n))
    open_p = low + rng.uniform(0.1, 0.9, size=n) * (high - low)
    volume = rng.uniform(1e6, 5e6, size=n)

    return pd.DataFrame(
        {
            "Open": open_p,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": volume,
        },
        index=dates,
    )


def test_no_lookahead_synthetic():
    df = make_synthetic_ohlcv(300)
    pipeline = FeaturePipeline(horizon=5)
    pipeline.assert_no_lookahead(df, n_checks=20)


def test_future_spike_does_not_alter_past():
    """Poison test: altering future row k+1 with a 10x spike must not change row k features."""
    df = make_synthetic_ohlcv(200)
    pipeline = FeaturePipeline(horizon=5)

    base_features = pipeline.compute_features(df)

    k = 120
    poisoned = df.copy()
    poisoned.iloc[k + 1 :, poisoned.columns.get_loc("Close")] *= 10.0
    poisoned.iloc[k + 1 :, poisoned.columns.get_loc("High")] *= 10.0
    poison_features = pipeline.compute_features(poisoned)

    # Everything up to row k must be completely identical
    np.testing.assert_allclose(
        base_features.iloc[: k + 1].values,
        poison_features.iloc[: k + 1].values,
        rtol=1e-6,
        atol=1e-6,
        equal_nan=True,
    )

