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
  saveRetrainedModel,
  getStoredModels,
} from "../lib/modelPersistence";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export interface BackendState {
  isWakingUp: boolean;
  isDemoMode: boolean;
}

type BackendStateListener = (state: BackendState) => void;
const backendListeners = new Set<BackendStateListener>();

let _isWakingUp = false;
let _isDemoMode = false;

function setBackendState(waking: boolean, demo: boolean) {
  if (_isWakingUp !== waking || _isDemoMode !== demo) {
    _isWakingUp = waking;
    _isDemoMode = demo;
    backendListeners.forEach((fn) => fn({ isWakingUp: _isWakingUp, isDemoMode: _isDemoMode }));
  }
}

export function subscribeBackendState(listener: BackendStateListener) {
  backendListeners.add(listener);
  listener({ isWakingUp: _isWakingUp, isDemoMode: _isDemoMode });
  return () => {
    backendListeners.delete(listener);
  };
}

export function getBackendState(): BackendState {
  return { isWakingUp: _isWakingUp, isDemoMode: _isDemoMode };
}

export async function wakeUpServer(): Promise<boolean> {
  setBackendState(true, _isDemoMode);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for Render free cold start

  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      setBackendState(false, false);
      return true;
    }
  } catch {
    clearTimeout(timeoutId);
  }
  setBackendState(false, true);
  return false;
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
  return {};
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

async function request<T>(
  endpoint: string,
  options?: RequestOptions,
  fallbackGenerator?: () => T
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const authHeaders = await getAuthHeader();

  const timeoutMs = options?.timeoutMs ?? 12000; // 12s default for light GETs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        setBackendState(false, true);
        return fallbackGenerator();
      }
    }

    if (res.status === 202) {
      setBackendState(false, false);
      let msg = "Model is currently training in the background. Please try again in ~30s.";
      try {
        const body = await res.json();
        if (body.detail) msg = body.detail;
      } catch {}
      throw new Error(msg);
    }

    if (!res.ok) {
      let errorDetail = `Request failed (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {}

      // If server returned 400 or 403 or 422, this is a real backend response, not a failure to reach server
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 409 || res.status === 422) {
        setBackendState(false, false);
        throw new Error(errorDetail);
      }

      if (fallbackGenerator) {
        console.warn(`[Log Pose] API error (${errorDetail}). Using local engine fallback.`);
        setBackendState(false, true);
        return fallbackGenerator();
      }
      throw new Error(errorDetail);
    }

    setBackendState(false, false);
    return (await res.json()) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    // If aborted or network error, use fallback if available
    if (fallbackGenerator) {
      console.warn(`[Log Pose] Network error (${err.message}). Using local engine fallback.`);
      setBackendState(false, true);
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
    // 120s timeout for ML forecasting pipeline
    const run = await request<ForecastRunDetail>(
      "/forecast",
      {
        method: "POST",
        timeoutMs: 120000,
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

    // Only cache in localStorage for local display; do NOT write mock forecasts to Supabase ledger
    if (run) {
      try {
        localStorage.setItem(`logpose_saved_run_${ticker.toUpperCase()}`, JSON.stringify(run));
        const all = JSON.parse(localStorage.getItem("logpose_all_saved_runs") || "[]");
        const filtered = all.filter((r: ForecastRunDetail) => r.id !== run.id);
        localStorage.setItem("logpose_all_saved_runs", JSON.stringify([run, ...filtered].slice(0, 50)));
      } catch {}
    }
    return run;
  },

  getForecast: (runId: string) =>
    request<ForecastRunDetail>(
      `/forecast/${runId}`,
      undefined,
      () => generateMockForecast("AAPL", 5)
    ),

  getLedgerRuns: async (
    ticker?: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ) => {
    const params = new URLSearchParams();
    if (ticker) params.append("ticker", ticker);
    if (status && status !== "ALL") params.append("status", status);
    params.append("limit", String(limit));
    params.append("offset", String(offset));

    return request<ForecastRunDetail[]>(
      `/ledger?${params.toString()}`,
      undefined,
      () => {
        try {
          const cached = localStorage.getItem("logpose_all_saved_runs");
          if (cached) {
            const list: ForecastRunDetail[] = JSON.parse(cached);
            let filtered = ticker ? list.filter((r) => r.ticker === ticker.toUpperCase()) : list;
            if (status && status !== "ALL") {
              filtered = filtered.filter((r) => r.resolution_status === status);
            }
            if (filtered.length > 0) return filtered;
          }
        } catch {}
        return [];
      }
    );
  },

  getLedgerRun: (runId: string) =>
    request<ForecastRunDetail>(
      `/ledger/${runId}`,
      undefined,
      () => generateMockForecast("AAPL", 5)
    ),

  getGhostRuns: async (ticker: string, n: number = 10) => {
    return request<GhostRun[]>(
      `/ledger/ghosts?ticker=${encodeURIComponent(ticker)}&n=${n}`,
      undefined,
      () => []
    );
  },

  getLedgerStats: async (ticker?: string, windowDays: number = 30) => {
    const params = new URLSearchParams();
    if (ticker) params.append("ticker", ticker);
    params.append("window", String(windowDays));

    return request<LedgerStats>(
      `/ledger/stats?${params.toString()}`,
      undefined,
      () => ({
        ticker,
        window_days: windowDays,
        resolved_count: 0,
        mae_pct: 0,
        directional_accuracy: 0,
        coverage_80: 0,
        coverage_95: 0,
      })
    );
  },

  triggerReconcile: async (ticker?: string) => {
    return request<{ resolved_points: number; affected_runs: number }>(
      "/reconcile",
      {
        method: "POST",
        body: JSON.stringify({ ticker }),
      },
      () => ({ resolved_points: 0, affected_runs: 0 })
    );
  },

  getModels: async (ticker: string) => {
    return request<ModelVersion[]>(
      `/models?ticker=${encodeURIComponent(ticker)}`,
      undefined,
      () => getStoredModels(ticker)
    );
  },

  getActiveModel: async (ticker: string) => {
    return request<ModelVersion>(
      `/models/active?ticker=${encodeURIComponent(ticker)}`,
      undefined,
      () => {
        const all = getStoredModels(ticker);
        return all.find((x) => x.is_active) || all[0];
      }
    );
  },

  triggerRetrain: async (ticker: string, force: boolean = false) => {
    const diff = await request<{ job_id: string; retrained: boolean; [key: string]: any }>(
      "/retrain",
      {
        method: "POST",
        timeoutMs: 120000, // 120s timeout for retrain
        body: JSON.stringify({ ticker, force }),
      },
      () => generateMockRetrainDiff(ticker)
    );
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

  // Sentiment routing: always calls the Vercel serverless function at relative path /api/sentiment?ticker=...
  getSentiment: async (ticker: string): Promise<SentimentResponse> => {
    try {
      const res = await fetch(`/api/sentiment?ticker=${encodeURIComponent(ticker)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.articles) && data.articles.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn("[Log Pose] Error fetching sentiment from Vercel function, falling back to mock:", e);
    }
    return generateMockSentiment(ticker);
  },
};
