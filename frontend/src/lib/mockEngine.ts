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

  const points: ForecastPointDetail[] = [];
  let predPrice = anchorClose;
  const [aYear, aMonth, aDay] = anchorDate.split("-").map(Number);
  let curD = new Date(aYear, aMonth - 1, aDay);

  let step = 1;

  while (step <= horizon) {
    curD.setDate(curD.getDate() + 1);
    const day = curD.getDay();
    if (day === 0 || day === 6) continue;

    const expectedReturnPct = Math.sin(step / 3) * 0.008 + 0.003 * step;
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

  return {
    id: generateUUID(),
    ticker: t,
    model_version_id: 1,
    created_at: new Date().toISOString(),
    anchor_date: anchorDate,
    anchor_close_price: anchorClose,
    horizon_days: horizon,
    confidence_score: 76.5,
    regime_status: "NORMAL",
    confidence_metadata: {
      composite_score: 76.5,
      directional_accuracy: 0.549,
      picp_80: 0.788,
      picp_95: 0.952,
      mpiw_80_atr: 3.04,
      regime_vol_z: 0.84,
      component_scores: {
        accuracy: 54.9,
        calibration: 78.8,
        tightness: 82.0,
        regime: 88.0,
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
  const nowStr = toLocalDateStr(new Date());
  return {
    id: 1,
    ticker: t,
    version_tag: "v20261108T180000Z",
    methodology_name: "XGBoostDirectMultiHorizon",
    trained_at: new Date().toISOString(),
    train_start_date: "2019-01-01",
    train_end_date: nowStr,
    horizon_days: 20,
    walk_forward_mae: 2.14,
    walk_forward_rmse: 0.031,
    directional_accuracy: 0.562,
    empirical_coverage_80: 0.795,
    empirical_coverage_95: 0.951,
    mpiw_80_atr: 0.068,
    notebook_hash: "a4f8d93e1b2c45d6e7f8a9b0c1d2e3f4",
    artifact_path: `./artifacts/${t}/bundle.joblib`,
    is_active: true,
  };
}

export function generateMockRetrainDiff(ticker: string): any {
  const t = ticker.toUpperCase();
  const now = new Date();
  const vTag = `v${now.toISOString().replace(/[^\d]/g, "").slice(0, 14)}Z`;
  return {
    job_id: `job-${Date.now()}`,
    ticker: t,
    retrained: true,
    activated: true,
    activation_reason:
      "Walk-forward validation achieved lower MAE and satisfied empirical coverage constraints (>0.65).",
    old: {
      version_tag: "v20261103T150000Z",
      walk_forward_mae: 2.14,
      directional_accuracy: 0.528,
      empirical_coverage_80: 0.771,
    },
    new: {
      version_tag: vTag,
      walk_forward_mae: 1.82,
      directional_accuracy: 0.564,
      empirical_coverage_80: 0.812,
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
