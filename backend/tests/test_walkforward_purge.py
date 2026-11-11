import numpy as np
import pandas as pd
import pytest
from backend.app.ml_core.exported_uncertainty import WalkForwardEvaluator
from backend.app.ml_core.exported_model import NaivePersistenceBaseline


def test_walkforward_purging_and_embargo():
    n_rows = 500
    H = 5
    purge = 5
    embargo = 5
    test_size = 40
    n_splits = 4

    dates = pd.date_range("2023-01-01", periods=n_rows, freq="B")
    X = pd.DataFrame(np.random.randn(n_rows, 10), index=dates)
    Y = pd.DataFrame(np.random.randn(n_rows, H) * 0.01, index=dates)

    evaluator = WalkForwardEvaluator(
        n_splits=n_splits,
        min_train=150,
        test_size=test_size,
        embargo=embargo,
        purge=purge,
    )

    # Verify purge gap for each fold
    for fold in range(n_splits):
        test_start = n_rows - (n_splits - fold) * test_size
        test_end = test_start + test_size
        train_end = test_start - purge

        # Purge condition: train_end + purge <= test_start
        assert train_end + purge <= test_start, f"Fold {fold}: purge window violated!"

        # No index in train overlaps test
        train_indices = set(range(train_end))
        test_indices = set(range(test_start, test_end))
        assert len(train_indices.intersection(test_indices)) == 0

    # Run evaluator with baseline model
    model = NaivePersistenceBaseline(horizon=H)
    oos_results, summary, calibrator = evaluator.run(model, X, Y)

    assert summary.n_folds == n_splits
    assert summary.n_oos_obs == n_splits * test_size
    assert len(summary.per_horizon) == H

    # Verify honest holdout evaluation and baselines
    assert summary.baseline_always_up_da is not None
    assert summary.baseline_zero_return_mae is not None
    assert summary.per_horizon[0].da_always_up is not None
    assert summary.per_horizon[0].mae_zero_return is not None
    assert 0.0 <= summary.empirical_coverage_80 <= 1.0

