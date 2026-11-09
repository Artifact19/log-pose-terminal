import type {
  ForecastPointDetail,
  ForecastRunDetail,
  MarketBarsResponse,
  ModelVersion,
  HealthResponse,
  OHLCVBar,
} from "../types";

const BASE_PRICES: Record<string, number> = {
  AAPL: 342.37,
  NVDA: 186.64,
  MSFT: 530.61,
  SPY: 735.29,
  "RELIANCE.NS": 1324.4,
  "TCS.NS": 2475.4,
};

export function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function pseudoRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getBasePrice(ticker: string): number {
  return BASE_PRICES[ticker.toUpperCase()] || 150.0;
}

export function generateMockBars(ticker: string, count: number = 250): MarketBarsResponse {
  const t = ticker.toUpperCase();
  const targetClose = getBasePrice(t);
  const rng = pseudoRandom(stringToSeed(`${t}_bars_stable`));

  const isIndian = t.includes(".NS") || t.includes(".BO");
  const now = new Date();
  const dates: Date[] = [];
  let cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // In New York (ET), market closes at 4:00 PM (16:00).
  // If viewing on Monday before regular session closes, the last official close is Friday Nov 6.
  const nowET = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  if (!isIndian && nowET.getHours() < 16 && cur.getDay() === 1) {
    cur.setDate(cur.getDate() - 3);
  }

  // Count backwards from current date to gather the exact count of trading days leading up to the last session
  while (dates.length < count) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(new Date(cur));
    }
    cur.setDate(cur.getDate() - 1);
  }

  // Work backward from targetClose so historical closes connect seamlessly to targetClose
  const closes: number[] = [targetClose];
  for (let i = 1; i < count; i++) {
    const dailyReturn = (rng() - 0.495) * 0.022 + Math.sin(i / 14) * 0.007;
    const prevClose = closes[0] / (1 + dailyReturn);
    closes.unshift(Number(prevClose.toFixed(2)));
  }

  const bars: OHLCVBar[] = [];
  for (let i = 0; i < count; i++) {
    const close = closes[i];
    const prevClose = i > 0 ? closes[i - 1] : close * 0.995;
    const open = Number((prevClose * (1 + (rng() - 0.5) * 0.006)).toFixed(2));
    const high = Number((Math.max(open, close) * (1 + rng() * 0.007)).toFixed(2));
    const low = Number((Math.min(open, close) * (1 - rng() * 0.007)).toFixed(2));
    const volume = Math.round(15000000 + rng() * 10000000);
    const dStr = toLocalDateStr(dates[i]);

    bars.push({
      date: dStr,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  const lastBarDate = bars.length > 0 ? bars[bars.length - 1].date : toLocalDateStr(now);

  return {
    ticker: t,
    bars,
    last_bar_date: lastBarDate,
    is_stale: false,
  };
}

const TICKER_MODEL_SPECS: Record<string, any> = {
  AAPL: {
    version_tag: "v20261103T152419Z",
    walk_forward_mae: 2.27,
    walk_forward_rmse: 0.032,
    directional_accuracy: 0.549,
    empirical_coverage_80: 0.788,
    empirical_coverage_95: 0.952,
    mpiw_80_atr: 0.066,
    notebook_hash: "396a56746d11cddf5f108309e80d6594",
  },
  NVDA: {
    version_tag: "v20261104T103543Z",
    walk_forward_mae: 6.08,
    walk_forward_rmse: 0.078,
    directional_accuracy: 0.558,
    empirical_coverage_80: 0.789,
    empirical_coverage_95: 0.937,
    mpiw_80_atr: 0.177,
    notebook_hash: "4f8a9b1c2d3e5f6a7b8c9d0e1f2a3b4c",
  },
  MSFT: {
    version_tag: "v20261103T153210Z",
    walk_forward_mae: 1.96,
    walk_forward_rmse: 0.027,
    directional_accuracy: 0.534,
    empirical_coverage_80: 0.801,
    empirical_coverage_95: 0.949,
    mpiw_80_atr: 0.058,
    notebook_hash: "7b2c4d6e8f0a1b3c5e7a9b1d3f5a7c9e",
  },
  SPY: {
    version_tag: "v20261103T151456Z",
    walk_forward_mae: 1.23,
    walk_forward_rmse: 0.018,
    directional_accuracy: 0.490,
    empirical_coverage_80: 0.799,
    empirical_coverage_95: 0.955,
    mpiw_80_atr: 0.034,
    notebook_hash: "1c3e5a7b9d2f4e6a8b0c2d4e6f8a0b2d",
  },
  "RELIANCE.NS": {
    version_tag: "v20261103T151813Z",
    walk_forward_mae: 1.84,
    walk_forward_rmse: 0.025,
    directional_accuracy: 0.489,
    empirical_coverage_80: 0.798,
    empirical_coverage_95: 0.948,
    mpiw_80_atr: 0.055,
    notebook_hash: "9e1f3a5b7c8d2e4f0a1b3c5d7e9f1a3b",
  },
  "TCS.NS": {
    version_tag: "v20261103T152945Z",
    walk_forward_mae: 1.62,
    walk_forward_rmse: 0.022,
    directional_accuracy: 0.518,
    empirical_coverage_80: 0.804,
    empirical_coverage_95: 0.952,
    mpiw_80_atr: 0.048,
    notebook_hash: "2a4c6e8f0b1d3f5a7c9e1b3d5f7a9c1e",
  },
};

export function generateMockForecast(
  ticker: string,
  horizon: number = 5,
  asOf?: string
): ForecastRunDetail {
  const t = ticker.toUpperCase();
  const barsData = generateMockBars(t, 250);
  const lastBar = barsData.bars[barsData.bars.length - 1];
  const anchorClose = lastBar ? lastBar.close : getBasePrice(t);
  const anchorDate = asOf || (lastBar ? lastBar.date : toLocalDateStr(new Date()));

  const spec = TICKER_MODEL_SPECS[t] || {
    version_tag: "v20261103T152419Z",
    walk_forward_mae: 2.27,
    walk_forward_rmse: 0.032,
    directional_accuracy: 0.549,
    empirical_coverage_80: 0.788,
    empirical_coverage_95: 0.952,
    mpiw_80_atr: 0.066,
    notebook_hash: "396a56746d11cddf5f108309e80d6594",
  };

  const isSubBaseline = spec.directional_accuracy < 0.50;

  const points: ForecastPointDetail[] = [];
  let predPrice = anchorClose;
  const [aYear, aMonth, aDay] = anchorDate.split("-").map(Number);
  let curD = new Date(aYear, aMonth - 1, aDay);

  let step = 1;

  while (step <= horizon) {
    curD.setDate(curD.getDate() + 1);
    const day = curD.getDay();
    if (day === 0 || day === 6) continue;

    // Quant Gating: If walk-forward directional accuracy < 50%, gate directional drift to zero (driftless Martingale cone)
    const expectedReturnPct = isSubBaseline
      ? 0
      : Math.sin(step / 3) * 0.008 + 0.003 * step;
    predPrice = anchorClose * (1 + expectedReturnPct);

    const band80HalfWidth = predPrice * (0.012 * Math.sqrt(step));
    const band95HalfWidth = predPrice * (0.022 * Math.sqrt(step));

    const dateStr = toLocalDateStr(curD);

    points.push({
      step_ahead: step,
      target_trading_date: dateStr,
      predicted_return: expectedReturnPct,
      predicted_close: Number(predPrice.toFixed(2)),
      lower_80: Number((predPrice - band80HalfWidth).toFixed(2)),
      upper_80: Number((predPrice + band80HalfWidth).toFixed(2)),
      lower_95: Number((predPrice - band95HalfWidth).toFixed(2)),
      upper_95: Number((predPrice + band95HalfWidth).toFixed(2)),
    });

    step++;
  }

  // Component breakdown scores dynamically derived from authentic ticker specs
  const accuracyScore = isSubBaseline
    ? Math.round(spec.directional_accuracy * 80) // Penalized score below 50% baseline
    : Math.round(spec.directional_accuracy * 100);
  const calibrationScore = Math.round(spec.empirical_coverage_80 * 100);
  const tightnessScore = 78.0;
  const regimeScore = 85.0;

  const compositeScore = Number(
    (
      accuracyScore * 0.3 +
      calibrationScore * 0.3 +
      tightnessScore * 0.2 +
      regimeScore * 0.2
    ).toFixed(1)
  );

  return {
    id: generateUUID(),
    ticker: t,
    model_version_id: 1,
    created_at: new Date().toISOString(),
    anchor_date: anchorDate,
    anchor_close_price: anchorClose,
    horizon_days: horizon,
    confidence_score: compositeScore,
    regime_status: "NORMAL",
    confidence_metadata: {
      composite_score: compositeScore,
      directional_accuracy: spec.directional_accuracy,
      picp_80: spec.empirical_coverage_80,
      picp_95: spec.empirical_coverage_95,
      mpiw_80_atr: 3.04,
      regime_vol_z: 0.84,
      component_scores: {
        accuracy: accuracyScore,
        calibration: calibrationScore,
        tightness: tightnessScore,
        regime: regimeScore,
      },
      weights: {
        accuracy: 0.3,
        calibration: 0.3,
        tightness: 0.2,
        regime: 0.2,
      },
    },
    resolution_status: "PENDING",
    is_seeded_demo: true,
    points,
    history_bars: barsData.bars,
  };
}

export function generateMockActiveModel(ticker: string): ModelVersion {
  const t = ticker.toUpperCase();
  const spec = TICKER_MODEL_SPECS[t] || {
    version_tag: "v20261108T180000Z",
    walk_forward_mae: 2.14,
    walk_forward_rmse: 0.031,
    directional_accuracy: 0.528,
    empirical_coverage_80: 0.795,
    empirical_coverage_95: 0.951,
    mpiw_80_atr: 0.068,
    notebook_hash: "a4f8d93e1b2c45d6e7f8a9b0c1d2e3f4",
  };

  const nowStr = toLocalDateStr(new Date());
  return {
    id: 1,
    ticker: t,
    version_tag: spec.version_tag,
    methodology_name: "XGBoostDirectMultiHorizon",
    trained_at: new Date().toISOString(),
    train_start_date: "2019-01-01",
    train_end_date: nowStr,
    horizon_days: 20,
    walk_forward_mae: spec.walk_forward_mae,
    walk_forward_rmse: spec.walk_forward_rmse,
    directional_accuracy: spec.directional_accuracy,
    empirical_coverage_80: spec.empirical_coverage_80,
    empirical_coverage_95: spec.empirical_coverage_95,
    mpiw_80_atr: spec.mpiw_80_atr,
    notebook_hash: spec.notebook_hash,
    artifact_path: `./artifacts/${t}/bundle.joblib`,
    is_active: true,
  };
}

export function generateMockRetrainDiff(ticker: string): any {
  const t = ticker.toUpperCase();
  const spec = TICKER_MODEL_SPECS[t] || {
    version_tag: "v20261103T150000Z",
    walk_forward_mae: 2.14,
    directional_accuracy: 0.528,
    empirical_coverage_80: 0.771,
  };
  const now = new Date();
  const vTag = `v${now.toISOString().replace(/[^\d]/g, "").slice(0, 14)}Z`;
  const improvedMae = Number((spec.walk_forward_mae * 0.91).toFixed(2));
  const improvedAcc = Number(Math.min(0.62, spec.directional_accuracy + 0.024).toFixed(3));
  const improvedCov = Number(Math.min(0.825, spec.empirical_coverage_80 + 0.015).toFixed(3));

  return {
    job_id: `job-${Date.now()}`,
    ticker: t,
    retrained: true,
    activated: true,
    activation_reason:
      `Walk-forward validation achieved lower MAE (${improvedMae}% vs ${spec.walk_forward_mae}%) and satisfied empirical coverage constraints (>0.65).`,
    old: {
      version_tag: spec.version_tag,
      walk_forward_mae: spec.walk_forward_mae,
      directional_accuracy: spec.directional_accuracy,
      empirical_coverage_80: spec.empirical_coverage_80,
    },
    new: {
      version_tag: vTag,
      walk_forward_mae: improvedMae,
      directional_accuracy: improvedAcc,
      empirical_coverage_80: improvedCov,
    },
  };
}

export function generateMockHealth(): HealthResponse {
  return {
    status: "ok",
    db_backend: "sqlite",
    ml_exports_in_sync: true,
    methodology_name: "XGBoostDirectMultiHorizon",
    disclaimer:
      "Log Pose Terminal is for research and forward-testing purposes only. Not financial advice.",
  };
}
