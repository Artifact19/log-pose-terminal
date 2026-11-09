import type {
  ForecastPointDetail,
  ForecastRunDetail,
  MarketBarsResponse,
  ModelVersion,
  HealthResponse,
  OHLCVBar,
} from "../types";

const BASE_PRICES: Record<string, number> = {
  AAPL: 228.5,
  NVDA: 138.25,
  MSFT: 412.0,
  SPY: 574.8,
  "RELIANCE.NS": 2740.0,
  "TCS.NS": 4125.0,
};

function getBasePrice(ticker: string): number {
  return BASE_PRICES[ticker.toUpperCase()] || 150.0;
}

export function generateMockBars(ticker: string, count: number = 250): MarketBarsResponse {
  const bars: OHLCVBar[] = [];
  const base = getBasePrice(ticker);
  let current = base * 0.85;

  const now = new Date();
  const dates: Date[] = [];
  let cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Count backwards from current date to gather the exact count of trading days leading up to today
  while (dates.length < count) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(new Date(cur));
    }
    cur.setDate(cur.getDate() - 1);
  }

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const changePct = Math.sin(i / 10) * 0.015 + (Math.random() - 0.48) * 0.02;
    const open = current;
    current = current * (1 + changePct);
    const high = Math.max(open, current) * (1 + Math.random() * 0.008);
    const low = Math.min(open, current) * (1 - Math.random() * 0.008);
    const close = current;
    const volume = Math.round(15000000 + Math.random() * 10000000);

    const dStr = d.toISOString().split("T")[0];
    bars.push({
      date: dStr,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }

  const lastBarDate = bars.length > 0 ? bars[bars.length - 1].date : now.toISOString().split("T")[0];

  return {
    ticker: ticker.toUpperCase(),
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
  const anchorDate = asOf || (lastBar ? lastBar.date : new Date().toISOString().split("T")[0]);

  const points: ForecastPointDetail[] = [];
  let predPrice = anchorClose;
  const anchorD = new Date(anchorDate);

  let step = 1;
  let curD = new Date(anchorD.getFullYear(), anchorD.getMonth(), anchorD.getDate());

  while (step <= horizon) {
    curD.setDate(curD.getDate() + 1);
    const day = curD.getDay();
    if (day === 0 || day === 6) continue;

    const expectedReturnPct = Math.sin(step / 3) * 0.008 + 0.003 * step;
    predPrice = anchorClose * (1 + expectedReturnPct);

    const band80HalfWidth = predPrice * (0.012 * Math.sqrt(step));
    const band95HalfWidth = predPrice * (0.022 * Math.sqrt(step));

    const dateStr = curD.toISOString().split("T")[0];

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
    id: `run-${t}-${Date.now()}`,
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
  const nowStr = new Date().toISOString().split("T")[0];
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
