import numpy as np
import pytest
from backend.app.ml_core.exported_uncertainty import (
    ConformalCalibrator,
    picp,
    weighted_quantile,
    recency_weights,
)


def test_weighted_quantile():
    values = np.array([10.0, 20.0, 30.0, 40.0])
    weights = np.array([0.1, 0.2, 0.3, 0.4])
    # cumsum weights: 0.1, 0.3, 0.6, 1.0
    assert weighted_quantile(values, weights, 0.05) == 10.0
    assert weighted_quantile(values, weights, 0.25) == 20.0
    assert weighted_quantile(values, weights, 0.55) == 30.0
    assert weighted_quantile(values, weights, 0.90) == 40.0


def test_conformal_coverage_and_nesting():
    rng = np.random.RandomState(42)
    n = 1000
    H = 5

    # Heteroscedastic noise
    sigma = rng.uniform(0.01, 0.04, size=(n, 1))
    noise = rng.normal(0, sigma, size=(n, H))
    y_true = noise
    y_point = np.zeros((n, H))
    q_lo = -1.28 * sigma * np.ones((n, H))
    q_hi = 1.28 * sigma * np.ones((n, H))

    # Split calibration / evaluation
    n_cal = 700
    calibrator = ConformalCalibrator(horizon=H, interval_method="cqr")
    calibrator.fit(
        y_true[:n_cal],
        y_point[:n_cal],
        q_lo[:n_cal],
        q_hi[:n_cal],
    )

    test_intervals = calibrator.intervals(
        y_point[n_cal:],
        q_lo[n_cal:],
        q_hi[n_cal:],
    )

    lo80, hi80 = test_intervals[0.80]
    lo95, hi95 = test_intervals[0.95]

    # Nesting condition: 95% band must always contain 80% band
    assert np.all(lo95 <= lo80)
    assert np.all(hi95 >= hi80)

    # Coverage verification on held-out tail
    y_test = y_true[n_cal:]
    for h in range(H):
        cov80 = picp(y_test[:, h], lo80[:, h], hi80[:, h])
        cov95 = picp(y_test[:, h], lo95[:, h], hi95[:, h])
        assert 0.74 <= cov80 <= 0.88, f"Horizon {h}: empirical 80% coverage {cov80:.3f} outside [0.74, 0.88]"
        assert 0.90 <= cov95 <= 0.99, f"Horizon {h}: empirical 95% coverage {cov95:.3f} outside [0.90, 0.99]"

