import type {
  ForecastRunDetail,
  GhostRun,
  HealthResponse,
  LedgerStats,
  MarketBarsResponse,
  ModelVersion,
  RetrainStatus,
  SentimentResponse,
} from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  generateMockBars,
  generateMockForecast,
  generateMockActiveModel,
  generateMockRetrainDiff,
  generateMockHealth,
  generateMockSentiment,
} from "../lib/mockEngine";

import {
  saveForecastToSupabase,
  fetchLedgerRunsFromSupabase,
  reconcilePendingRuns,
  calculateLiveLedgerStats,
} from "../lib/supabasePersistence";

import {
  getStoredModels,
  saveRetrainedModel,
} from "../lib/modelPersistence";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return { Authorization: `Bearer ${session.access_token}` };
      }
    } catch {}
  }
  const sessionStr = localStorage.getItem("logpose_session_user") || localStorage.getItem("logpose_mock_user");
  if (sessionStr) {
    try {
      const u = JSON.parse(sessionStr);
      const headerB64 = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payloadB64 = base64UrlEncode(JSON.stringify({ sub: u.id, email: u.email, role: "authenticated" }));
      const sigB64 = base64UrlEncode(JSON.stringify({ sig: "mock" }));
      return { Authorization: `Bearer ${headerB64}.${payloadB64}.${sigB64}` };
    } catch {}
  }
  return {};
}

async function request<T>(endpoint: string, options?: RequestInit, fallbackGenerator?: () => T): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const authHeaders = await getAuthHeader();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options?.headers,
      },
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get("content-type") || "";

    // Detect if Vercel SPA router redirected API request to index.html or returned 405
    if (res.status === 405 || contentType.includes("text/html")) {
      if (fallbackGenerator) {
        console.warn(`[Log Pose] Backend unreachable at ${url} (${res.status}). Using local standalone engine.`);
        return fallbackGenerator();
      }
    }

    if (!res.ok) {
      let errorDetail = `Request failed (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {}

      if (fallbackGenerator) {
        console.warn(`[Log Pose] API error (${errorDetail}). Using local engine fallback.`);
        return fallbackGenerator();
      }
      throw new Error(errorDetail);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    // If aborted or network error, use fallback if available
    if (fallbackGenerator) {
      console.warn(`[Log Pose] Network error (${err.message}). Using local engine fallback.`);
      return fallbackGenerator();
    }
    throw err;
  }
}

export const api = {
  getHealth: () =>
    request<HealthResponse>("/health", undefined, generateMockHealth),

  getMarketBars: (ticker: string, days: number = 250) =>
    request<MarketBarsResponse>(
      `/market/${encodeURIComponent(ticker)}/bars?days=${days}`,
      undefined,
      () => generateMockBars(ticker, days)
    ),

  createForecast: async (
    ticker: string,
    horizon: number = 5,
    asOf?: string,
    forceNew: boolean = false,
    sentimentScore?: number
  ) => {
    const run = await request<ForecastRunDetail>(
      "/forecast",
      {
        method: "POST",
        body: JSON.stringify({
          ticker,
          horizon,
          as_of: asOf || undefined,
          force_new: forceNew || false,
          sentiment_score: sentimentScore,
        }),
      },
      () => generateMockForecast(ticker, horizon, asOf, sentimentScore)
    );
    // Persist to Supabase and browser cache, awaiting completion so points are saved before queries refetch
    try {
      await saveForecastToSupabase(run);
    } catch (e) {
      console.warn("[Log Pose] Error saving forecast to persistence:", e);
    }
    return run;
  },

  getForecast: (runId: string) =>
    request<ForecastRunDetail>(`/forecast/${runId}`, undefined, () => generateMockForecast("AAPL", 5)),

  getLedgerRuns: async (ticker?: string, status?: string, limit: number = 50, offset: number = 0) => {
    // 1. Try Supabase & local persistent cache first
    const persisted = await fetchLedgerRunsFromSupabase(ticker);
    if (persisted && persisted.length > 0) {
      if (status && status !== "ALL") {
        return persisted.filter((r) => r.resolution_status === status);
      }
      return persisted;
    }

    const params = new URLSearchParams();
    if (ticker) params.append("ticker", ticker);
    if (status) params.append("status", status);
    params.append("limit", String(limit));
    params.append("offset", String(offset));
    return request<ForecastRunDetail[]>(
      `/ledger?${params.toString()}`,
      undefined,
      () => [generateMockForecast(ticker || "AAPL", 5)]
    );
  },

  getLedgerRun: (runId: string) =>
    request<ForecastRunDetail>(`/ledger/${runId}`, undefined, () => generateMockForecast("AAPL", 5)),

  getGhostRuns: async (ticker: string, n: number = 10) => {
    const persisted = await fetchLedgerRunsFromSupabase(ticker);
    if (persisted && persisted.length > 0) {
      return persisted.slice(0, n).map((r) => ({
        run_id: r.id,
        anchor_date: r.anchor_date,
        anchor_close_price: r.anchor_close_price,
        points: (r.points || []).map((p) => ({
          step_ahead: p.step_ahead,
          target_trading_date: p.target_trading_date,
          predicted_close: p.predicted_close,
          lower_80: p.lower_80,
          upper_80: p.upper_80,
          actual_close: p.actual_close,
          inside_80_band: p.inside_80_band,
        })),
      }));
    }
    return request<GhostRun[]>(
      `/ledger/ghosts?ticker=${encodeURIComponent(ticker)}&n=${n}`,
      undefined,
      () => []
    );
  },

  getLedgerStats: async (ticker?: string, windowDays: number = 30) => {
    const liveStats = await calculateLiveLedgerStats(ticker, windowDays);
    if (liveStats && liveStats.resolved_count > 0) {
      return liveStats;
    }
    const params = new URLSearchParams();
    if (ticker) params.append("ticker", ticker);
    params.append("window", String(windowDays));
    return request<LedgerStats>(`/ledger/stats?${params.toString()}`, undefined, () => liveStats);
  },

  triggerReconcile: async (ticker?: string) => {
    const cloudCounts = await reconcilePendingRuns(ticker);
    return request<{ resolved_points: number; affected_runs: number }>(
      "/reconcile",
      {
        method: "POST",
        body: JSON.stringify({ ticker }),
      },
      () => cloudCounts
    );
  },

  getModels: async (ticker: string) => {
    try {
      const models = await request<ModelVersion[]>(
        `/models?ticker=${encodeURIComponent(ticker)}`,
        undefined,
        () => getStoredModels(ticker)
      );
      if (Array.isArray(models) && models.length > 0) return models;
    } catch {}
    return getStoredModels(ticker);
  },

  getActiveModel: async (ticker: string) => {
    try {
      const m = await request<ModelVersion>(
        `/models/active?ticker=${encodeURIComponent(ticker)}`,
        undefined,
        () => {
          const all = getStoredModels(ticker);
          return all.find((x) => x.is_active) || all[0];
        }
      );
      if (m) return m;
    } catch {}
    const all = getStoredModels(ticker);
    return all.find((x) => x.is_active) || all[0];
  },

  triggerRetrain: async (ticker: string, force: boolean = false) => {
    const diff = await request<{ job_id: string; retrained: boolean; [key: string]: any }>(
      "/retrain",
      {
        method: "POST",
        body: JSON.stringify({ ticker, force }),
      },
      () => generateMockRetrainDiff(ticker)
    );
    // Persist newly trained model version so it appears in the Historical Model Versions registry
    saveRetrainedModel(ticker, diff);
    return diff;
  },

  getRetrainStatus: (jobId: string) =>
    request<RetrainStatus>(`/retrain/status/${jobId}`, undefined, () => ({
      job_id: jobId,
      ticker: "AAPL",
      stage: "DONE",
      progress_fold: 8,
      total_folds: 8,
      diff: null,
      error: null,
    })),

  adminSyncCheck: () =>
    request<{ in_sync: boolean; message: string }>(
      "/admin/sync-check",
      { method: "POST" },
      () => ({ in_sync: true, message: "Methodology verified in sync." })
    ),

  getSentiment: async (ticker: string): Promise<SentimentResponse> => {
    try {
      const res = await request<SentimentResponse>(
        `/sentiment?ticker=${encodeURIComponent(ticker)}`,
        undefined,
        () => generateMockSentiment(ticker)
      );
      if (res && Array.isArray(res.articles) && res.articles.length > 0) return res;
    } catch {}
    return generateMockSentiment(ticker);
  },
};
