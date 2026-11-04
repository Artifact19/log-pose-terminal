"""AUTO-GENERATED from 01_feature_engineering.ipynb by scripts/sync_notebooks.py. DO NOT EDIT.
Source notebook sha256: b4aa86106d3451e6d3f63c8e344c78f6c6da72855268f95e44589f9793ba220d
Edit the notebook, then run: python scripts/sync_notebooks.py
"""
# ruff: noqa
# --- 01_feature_engineering.ipynb :: cell 1 ---
from __future__ import annotations
from typing import Optional
import numpy as np
import pandas as pd
from backend.app.ml_core.contracts import FeatureFrame


class FeaturePipeline:
    feature_names: list[str]

    def __init__(self, horizon: int = 5, warmup: int = 80):
        self.horizon = horizon
        self.warmup = warmup
        self.feature_names = [
            "ret_1d", "ret_3d", "ret_5d", "ret_10d", "ret_20d",
            "mom_5d", "mom_20d",
            "vol_parkinson_20d", "vol_yz_20d",
            "rsi_14", "macd_hist", "bb_width", "vol_z20",
            "vol_ratio_5_20", "vol_ratio_20_60",
            "atr_14_pct",
            "dow_sin", "dow_cos"
        ]

    def compute_features(self, df: pd.DataFrame) -> pd.DataFrame:
        c = df["Close"].astype(float)
        o = df["Open"].astype(float)
        h = df["High"].astype(float)
        l = df["Low"].astype(float)
        v = df["Volume"].astype(float)

        feats = pd.DataFrame(index=df.index)

        # Log returns (t vs t-k)
        feats["ret_1d"] = np.log(c / c.shift(1))
        feats["ret_3d"] = np.log(c / c.shift(3))
        feats["ret_5d"] = np.log(c / c.shift(5))
        feats["ret_10d"] = np.log(c / c.shift(10))
        feats["ret_20d"] = np.log(c / c.shift(20))

        # Momentum
        feats["mom_5d"] = feats["ret_1d"].rolling(5).mean()
        feats["mom_20d"] = feats["ret_1d"].rolling(20).mean()

        # Parkinson Volatility (20d)
        log_hl = np.log(h / l) ** 2
        feats["vol_parkinson_20d"] = np.sqrt(log_hl.rolling(20).mean() / (4.0 * np.log(2.0)))

        # Yang-Zhang Volatility (20d)
        n = 20
        k = 0.34 / (1.34 + (n + 1.0) / (n - 1.0))
        o_cprev = np.log(o / c.shift(1))
        c_o = np.log(c / o)
        rs = np.log(h / c) * np.log(h / o) + np.log(l / c) * np.log(l / o)

        var_o = (o_cprev - o_cprev.rolling(n).mean()) ** 2
        sigma_o2 = var_o.rolling(n).sum() / (n - 1.0)

        var_c = (c_o - c_o.rolling(n).mean()) ** 2
        sigma_c2 = var_c.rolling(n).sum() / (n - 1.0)

        sigma_rs2 = rs.rolling(n).mean()

        yz_var = sigma_o2 + k * sigma_c2 + (1.0 - k) * sigma_rs2
        feats["vol_yz_20d"] = np.sqrt(np.maximum(0.0, yz_var))

        # RSI 14 (Wilder's smoothing via ewm(alpha=1/14, adjust=False))
        delta = c.diff()
        gain = delta.clip(lower=0.0)
        loss = -delta.clip(upper=0.0)
        avg_gain = gain.ewm(alpha=1.0 / 14.0, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / 14.0, adjust=False).mean()
        rs_val = avg_gain / (avg_loss + 1e-12)
        feats["rsi_14"] = (100.0 - (100.0 / (1.0 + rs_val))) / 100.0

        # MACD histogram / Close
        ema12 = c.ewm(span=12, adjust=False).mean()
        ema26 = c.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        feats["macd_hist"] = (macd_line - signal_line) / (c + 1e-12)

        # Bollinger Band width (20d, 2 std)
        bb_mid = c.rolling(20).mean()
        bb_std = c.rolling(20).std()
        feats["bb_width"] = (4.0 * bb_std) / (bb_mid + 1e-12)

        # Volume z-score 20d
        ln_vol = np.log1p(v)
        vol_mean = ln_vol.rolling(20).mean()
        vol_std = ln_vol.rolling(20).std()
        feats["vol_z20"] = (ln_vol - vol_mean) / (vol_std + 1e-12)

        # Regime ratios
        rvol_5 = feats["ret_1d"].rolling(5).std()
        rvol_20 = feats["ret_1d"].rolling(20).std()
        rvol_60 = feats["ret_1d"].rolling(60).std()
        feats["vol_ratio_5_20"] = rvol_5 / (rvol_20 + 1e-12)
        feats["vol_ratio_20_60"] = rvol_20 / (rvol_60 + 1e-12)

        # Wilder ATR(14) / Close
        tr1 = h - l
        tr2 = (h - c.shift(1)).abs()
        tr3 = (l - c.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr_14 = tr.ewm(alpha=1.0 / 14.0, adjust=False).mean()
        feats["atr_14_pct"] = atr_14 / (c + 1e-12)

        # Calendar cyclic day of week
        idx = pd.to_datetime(df.index)
        dow = idx.day_of_week if hasattr(idx, "day_of_week") else idx.dayofweek
        feats["dow_sin"] = np.sin(2.0 * np.pi * dow / 5.0)
        feats["dow_cos"] = np.cos(2.0 * np.pi * dow / 5.0)

        return feats[self.feature_names]

    def build(self, ohlcv: pd.DataFrame, with_targets: bool = True) -> FeatureFrame:
        df = ohlcv.sort_index().copy()
        X = self.compute_features(df)

        if not with_targets:
            # Live inference mode: return valid rows (especially the last anchor row)
            return FeatureFrame(X=X.dropna(), Y=None, feature_names=self.feature_names)

        # Build multi-horizon cumulative log-return targets: y_h = ln(C_{t+h} / C_t)
        c = df["Close"].astype(float)
        Y_cols = {}
        for h in range(1, self.horizon + 1):
            Y_cols[f"y_{h}"] = np.log(c.shift(-h) / c)
        Y = pd.DataFrame(Y_cols, index=df.index)

        # Drop any row where either X or Y contains NaN
        valid_mask = (~X.isna().any(axis=1)) & (~Y.isna().any(axis=1))
        # Ensure warmup buffer is respected
        if len(valid_mask) > self.warmup:
            valid_mask.iloc[:self.warmup] = False

        return FeatureFrame(X=X[valid_mask], Y=Y[valid_mask], feature_names=self.feature_names)

    def assert_no_lookahead(self, ohlcv: pd.DataFrame, n_checks: int = 25, seed: int = 0) -> None:
        rng = np.random.RandomState(seed)
        df = ohlcv.sort_index().copy()
        n = len(df)
        if n < self.warmup + 30:
            return

        full_X = self.compute_features(df)

        # 1. Truncation test: computing on [:k+1] gives exact same features at row k
        valid_indices = range(self.warmup + 10, n - self.horizon - 1)
        check_points = rng.choice(list(valid_indices), size=min(n_checks, len(valid_indices)), replace=False)

        for k in check_points:
            trunc_df = df.iloc[:k + 1].copy()
            trunc_X = self.compute_features(trunc_df)
            val_full = full_X.iloc[k].values
            val_trunc = trunc_X.iloc[-1].values
            diff = np.abs(val_full - val_trunc)
            assert np.all((diff < 1e-7) | (np.isnan(val_full) & np.isnan(val_trunc))), (
                f"Truncation test failed at row {k}: max diff={np.nanmax(diff)}"
            )

        # 2. Poison test: altering future rows (k+1..) does not alter features at row k
        for k in check_points[:5]:
            poisoned_df = df.copy()
            poisoned_df.iloc[k + 1:, poisoned_df.columns.get_loc("Close")] = 999999.0
            poisoned_df.iloc[k + 1:, poisoned_df.columns.get_loc("High")] = 999999.0
            poison_X = self.compute_features(poisoned_df)
            val_orig = full_X.iloc[k].values
            val_poison = poison_X.iloc[k].values
            diff = np.abs(val_orig - val_poison)
            assert np.all((diff < 1e-7) | (np.isnan(val_orig) & np.isnan(val_poison))), (
                f"Poison test failed at row {k}: future altered features at {k}!"
            )

        # 3. Target test: y_h at row t equals ln(C[t+h] / C[t])
        frame = self.build(df, with_targets=True)
        c = df["Close"].loc[frame.X.index]
        for h in range(1, self.horizon + 1):
            target_series = frame.Y[f"y_{h}"]
            future_c = df["Close"].shift(-h).loc[frame.X.index]
            expected_ret = np.log(future_c / c)
            np.testing.assert_allclose(target_series.values, expected_ret.values, rtol=1e-5, atol=1e-5)
