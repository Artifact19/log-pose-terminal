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

export function getBasePrice(ticker: string): number {
  return BASE_PRICES[ticker.toUpperCase()] || 150.0;
}

/**
 * Returns the YYYY-MM-DD date string of the most recent completed trading session
 * in the ticker's home exchange timezone:
 * - Indian stocks (.NS / .BO -> Asia/Kolkata): session closes at 15:30 IST
 * - US/other stocks (America/New_York): session closes at 16:00 ET
 */
export function getLastClosedMarketDate(ticker: string): string {
  const t = ticker.toUpperCase();
  const isIndian = t.endsWith(".NS") || t.endsWith(".BO");
  const tz = isIndian ? "Asia/Kolkata" : "America/New_York";
  const closeHourDec = isIndian ? 15.5 : 16.0;

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  const year = parseInt(getPart("year"), 10);
  const month = parseInt(getPart("month"), 10);
  const day = parseInt(getPart("day"), 10);
  const hour = parseInt(getPart("hour"), 10) % 24;
  const minute = parseInt(getPart("minute"), 10);

  const cur = new Date(year, month - 1, day);
  const timeDec = hour + minute / 60;

  // If today is a weekday in the exchange's timezone, but the regular session hasn't closed yet,
  // the last completed daily close is the previous trading session.
  const dow = cur.getDay();
  if (dow !== 0 && dow !== 6 && timeDec < closeHourDec) {
    cur.setDate(cur.getDate() - 1);
  }

  // Roll back past weekends
  while (cur.getDay() === 0 || cur.getDay() === 6) {
    cur.setDate(cur.getDate() - 1);
  }

  return toLocalDateStr(cur);
}

/**
 * Deterministic daily return for a specific (ticker, dateStr) session after 2026-11-09.
 */
export function getSessionDailyReturn(ticker: string, dateStr: string): number {
  const t = ticker.toUpperCase();
  const rng = pseudoRandom(stringToSeed(`${t}_session_close_${dateStr}`));
  // Realistic daily return between -0.7% and +1.1% with slight positive drift
  return (rng() - 0.42) * 0.016;
}

export function generateMockBars(ticker: string, count: number = 250): MarketBarsResponse {
  const t = ticker.toUpperCase();
  const basePriceNov9 = getBasePrice(t);
  const rng = pseudoRandom(stringToSeed(`${t}_bars_stable`));

  const lastClosedStr = getLastClosedMarketDate(t);
  const [lYear, lMonth, lDay] = lastClosedStr.split("-").map(Number);
  let cur = new Date(lYear, lMonth - 1, lDay);

  const dates: Date[] = [];
  // Count backwards from lastClosedStr to gather the exact count of trading days
  while (dates.length < count) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(new Date(cur));
    }
    cur.setDate(cur.getDate() - 1);
  }

  const dateStrs = dates.map((d) => toLocalDateStr(d));
  const refDateStr = "2026-11-09";
  let refIdx = dateStrs.indexOf(refDateStr);
  if (refIdx === -1) {
    refIdx = dateStrs.length - 1;
  }

  const closes: number[] = new Array(count);
  closes[refIdx] = basePriceNov9;

  // Work backward from 2026-11-09 so historical closes up to Nov 9 remain 100% identical
  for (let i = refIdx - 1; i >= 0; i--) {
    const stepBack = refIdx - i;
    const dailyReturn = (rng() - 0.495) * 0.022 + Math.sin(stepBack / 14) * 0.007;
    const prevClose = closes[i + 1] / (1 + dailyReturn);
    closes[i] = Number(prevClose.toFixed(2));
  }

  // Work forward from 2026-11-09 for any completed trading sessions after Nov 9 (e.g., Nov 10+)
  for (let i = refIdx + 1; i < count; i++) {
    const dRet = getSessionDailyReturn(t, dateStrs[i]);
    closes[i] = Number((closes[i - 1] * (1 + dRet)).toFixed(2));
  }

  const bars: OHLCVBar[] = [];
  for (let i = 0; i < count; i++) {
    const close = closes[i];
    const prevClose = i > 0 ? closes[i - 1] : close * 0.995;
    const open = Number((prevClose * (1 + (rng() - 0.5) * 0.006)).toFixed(2));
    const high = Number((Math.max(open, close) * (1 + rng() * 0.007)).toFixed(2));
    const low = Number((Math.min(open, close) * (1 - rng() * 0.007)).toFixed(2));
    const volume = Math.round(15000000 + rng() * 10000000);
    const dStr = dateStrs[i];

    bars.push({
      date: dStr,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  const lastBarDate = bars.length > 0 ? bars[bars.length - 1].date : lastClosedStr;

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
  asOf?: string,
  sentimentScore?: number
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

  // Use provided sentimentScore or sample from fallback sentiment if sub-baseline
  const effectiveSentiment =
    sentimentScore !== undefined
      ? sentimentScore
      : isSubBaseline
      ? (t === "RELIANCE.NS" ? 0.38 : 0.20)
      : 0;

  const points: ForecastPointDetail[] = [];
  let predPrice = anchorClose;
  const [aYear, aMonth, aDay] = anchorDate.split("-").map(Number);
  let curD = new Date(aYear, aMonth - 1, aDay);

  let step = 1;

  while (step <= horizon) {
    curD.setDate(curD.getDate() + 1);
    const day = curD.getDay();
    if (day === 0 || day === 6) continue;

    // Quant Gating (Option A): If walk-forward directional accuracy < 50%,
    // calibrate directional drift using high-conviction NLP sentiment tilt rather than arbitrary momentum noise
    let expectedReturnPct = 0;
    if (isSubBaseline) {
      if (Math.abs(effectiveSentiment) >= 0.12) {
        // Calibrated NLP sentiment tilt up to +/- 1.2%
        expectedReturnPct = Number(
          (effectiveSentiment * 0.015 * Math.sqrt(step / horizon)).toFixed(4)
        );
      } else {
        expectedReturnPct = 0; // Pure driftless Martingale fallback
      }
    } else {
      expectedReturnPct = Math.sin(step / 3) * 0.008 + 0.003 * step;
    }

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
    ? Math.min(85, Math.round(spec.directional_accuracy * 80 + Math.max(0, effectiveSentiment) * 25))
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
      nlp_sentiment_score: effectiveSentiment,
      nlp_drift_tilt: Number((effectiveSentiment * 1.5).toFixed(2)),
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
  const vTag = `sim-${now.toISOString().replace(/[^\d]/g, "").slice(0, 14)}Z`;

  return {
    job_id: `sim-job-${Date.now()}`,
    ticker: t,
    retrained: false,
    activated: false,
    is_simulated: true,
    activation_reason:
      "Simulated demo mode: backend unreachable. No real model retrained or evaluated.",
    old: {
      version_tag: spec.version_tag,
      walk_forward_mae: spec.walk_forward_mae,
      directional_accuracy: spec.directional_accuracy,
      empirical_coverage_80: spec.empirical_coverage_80,
    },
    new: {
      version_tag: vTag,
      walk_forward_mae: spec.walk_forward_mae,
      directional_accuracy: spec.directional_accuracy,
      empirical_coverage_80: spec.empirical_coverage_80,
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

export function generateMockSentiment(ticker: string) {
  const t = ticker.toUpperCase();
  const now = new Date();

  if (t === "RELIANCE.NS") {
    return {
      ticker: t,
      score: 0.38,
      label: "BULLISH" as const,
      drift_tilt_pct: 0.57,
      articles_analyzed: 5,
      news_velocity: "NORMAL" as const,
      volume_24h: 4,
      bullish_count: 3,
      bearish_count: 1,
      neutral_count: 1,
      articles: [
        {
          title: "Reliance Industries stock outlook bullish on strong O2C earnings, steady Jio growth",
          publisher: "Moneycontrol",
          published_at: "2 hours ago",
          sentiment: "BULLISH" as const,
          score: 0.72,
          link: "https://www.google.com/search?q=Reliance+Industries+stock+outlook+bullish+Moneycontrol",
        },
        {
          title: "Reliance Industries shares jump following Q2 refining margins and retail expansion",
          publisher: "Livemint",
          published_at: "4 hours ago",
          sentiment: "BULLISH" as const,
          score: 0.65,
          link: "https://www.google.com/search?q=Reliance+Industries+shares+jump+Livemint",
        },
        {
          title: "Why is Reliance Industries stock surging today? Analysts weigh in",
          publisher: "Investing.com India",
          published_at: "6 hours ago",
          sentiment: "BULLISH" as const,
          score: 0.54,
          link: "https://www.google.com/search?q=Why+is+Reliance+Industries+stock+surging+today+Investing.com",
        },
        {
          title: "Reliance may face competitive friction in consumer retail goods: Analyst review",
          publisher: "Business Standard",
          published_at: "8 hours ago",
          sentiment: "BEARISH" as const,
          score: -0.35,
          link: "https://www.google.com/search?q=Reliance+Britannia+biscuits+Business+Standard",
        },
        {
          title: "Reliance Industries Share Price - Live NSE Chart & Technical Assessment",
          publisher: "Upstox",
          published_at: "12 hours ago",
          sentiment: "NEUTRAL" as const,
          score: 0.05,
          link: "https://www.google.com/search?q=Reliance+Industries+Share+Price+Upstox",
        },
      ],
      as_of: now.toISOString(),
    };
  }

  if (t === "NVDA") {
    return {
      ticker: t,
      score: 0.45,
      label: "STRONGLY BULLISH" as const,
      drift_tilt_pct: 0.68,
      articles_analyzed: 5,
      news_velocity: "HIGH" as const,
      volume_24h: 5,
      bullish_count: 4,
      bearish_count: 0,
      neutral_count: 1,
      articles: [
        {
          title: "Nvidia AI Chip Demand Remains Relentless Heading Into Next Quarter",
          publisher: "Bloomberg",
          published_at: "1 hour ago",
          sentiment: "BULLISH" as const,
          score: 0.82,
          link: "https://finance.yahoo.com/quote/NVDA/news",
        },
        {
          title: "What Is Jensen Huang Worth to Nvidia? Analysts Outline Trillion-Dollar Moat",
          publisher: "Yahoo Finance",
          published_at: "3 hours ago",
          sentiment: "BULLISH" as const,
          score: 0.75,
          link: "https://finance.yahoo.com/quote/NVDA/news",
        },
        {
          title: "Semiconductor ETF Inflows Reach Record High on Nvidia Blackwell Momentum",
          publisher: "Reuters",
          published_at: "5 hours ago",
          sentiment: "BULLISH" as const,
          score: 0.68,
          link: "https://finance.yahoo.com/quote/NVDA/news",
        },
        {
          title: "Tech Giants Reaffirm Hyperscale Cloud AI Capex Expansion for 2026",
          publisher: "Wall Street Journal",
          published_at: "7 hours ago",
          sentiment: "BULLISH" as const,
          score: 0.58,
          link: "https://finance.yahoo.com/quote/NVDA/news",
        },
        {
          title: "Nvidia Option Straddles Price in 7% Swing Around Upcoming Catalyst",
          publisher: "MarketWatch",
          published_at: "10 hours ago",
          sentiment: "NEUTRAL" as const,
          score: 0.02,
          link: "https://finance.yahoo.com/quote/NVDA/news",
        },
      ],
      as_of: now.toISOString(),
    };
  }

  return {
    ticker: t,
    score: 0.22,
    label: "BULLISH" as const,
    drift_tilt_pct: 0.33,
    articles_analyzed: 4,
    news_velocity: "NORMAL" as const,
    volume_24h: 3,
    bullish_count: 2,
    bearish_count: 1,
    neutral_count: 1,
    articles: [
      {
        title: `${t} Reports Steady Institutional Inflows as Market Sentiment Holds Resilient`,
        publisher: "Financial Times",
        published_at: "2 hours ago",
        sentiment: "BULLISH" as const,
        score: 0.58,
        link: `https://www.google.com/search?q=${encodeURIComponent(t + " stock news Financial Times")}`,
      },
      {
        title: `Analysts Reiterate Overweight Outlook on ${t} Ahead of Sector Catalysts`,
        publisher: "Morningstar",
        published_at: "5 hours ago",
        sentiment: "BULLISH" as const,
        score: 0.48,
        link: `https://www.google.com/search?q=${encodeURIComponent(t + " stock target price Morningstar")}`,
      },
      {
        title: `Macro Volatility and Bond Yield Shifts Spark Brief Rotation Across Large-Caps`,
        publisher: "Reuters",
        published_at: "8 hours ago",
        sentiment: "BEARISH" as const,
        score: -0.32,
        link: `https://www.google.com/search?q=${encodeURIComponent(t + " stock market Reuters")}`,
      },
      {
        title: `${t} Volume Profiling and Technical Support Verification`,
        publisher: "Investing.com",
        published_at: "12 hours ago",
        sentiment: "NEUTRAL" as const,
        score: 0.0,
        link: `https://www.google.com/search?q=${encodeURIComponent(t + " stock technicals Investing.com")}`,
      },
    ],
    as_of: now.toISOString(),
  };
}
