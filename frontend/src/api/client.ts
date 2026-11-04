import type {
  ForecastRunDetail,
  GhostRun,
  HealthResponse,
  LedgerStats,
  MarketBarsResponse,
  ModelVersion,
  RetrainStatus,
} from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function getAuthHeader(): Promise<Record<string, string>> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return { Authorization: `Bearer ${session.access_token}` };
      }
    } catch {}
  }
  const mock = localStorage.getItem("logpose_mock_user");
  if (mock) {
    try {
      const u = JSON.parse(mock);
      // Format a mock Bearer JWT header carrying email claim
      const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payloadB64 = btoa(JSON.stringify({ sub: u.id, email: u.email, role: "authenticated" }));
      return { Authorization: `Bearer ${headerB64}.${payloadB64}.mocksignature` };
    } catch {}
  }
  return {};
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const authHeaders = await getAuthHeader();

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorDetail = `Request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {}
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<HealthResponse>("/health"),

  getMarketBars: (ticker: string, days: number = 250) =>
    request<MarketBarsResponse>(`/market/${encodeURIComponent(ticker)}/bars?days=${days}`),

  createForecast: (ticker: string, horizon?: number, asOf?: string, forceNew?: boolean) =>
    request<ForecastRunDetail>("/forecast", {
      method: "POST",
      body: JSON.stringify({
        ticker,
        horizon,
        as_of: asOf || undefined,
        force_new: forceNew || false,
      }),
    }),

  getForecast: (runId: string) => request<ForecastRunDetail>(`/forecast/${runId}`),

  getLedgerRuns: (ticker?: string, status?: string, limit: number = 50, offset: number = 0) => {
    const params = new URLSearchParams();
    if (ticker) params.append("ticker", ticker);
    if (status) params.append("status", status);
    params.append("limit", String(limit));
    params.append("offset", String(offset));
    return request<ForecastRunDetail[]>(`/ledger?${params.toString()}`);
  },

  getLedgerRun: (runId: string) => request<ForecastRunDetail>(`/ledger/${runId}`),

  getGhostRuns: (ticker: string, n: number = 10) =>
    request<GhostRun[]>(`/ledger/ghosts?ticker=${encodeURIComponent(ticker)}&n=${n}`),

  getLedgerStats: (ticker?: string, windowDays: number = 30) => {
    const params = new URLSearchParams();
    if (ticker) params.append("ticker", ticker);
    params.append("window", String(windowDays));
    return request<LedgerStats>(`/ledger/stats?${params.toString()}`);
  },

  triggerReconcile: (ticker?: string) =>
    request<{ resolved_points: number; affected_runs: number }>("/reconcile", {
      method: "POST",
      body: JSON.stringify({ ticker }),
    }),

  getModels: (ticker: string) => request<ModelVersion[]>(`/models?ticker=${encodeURIComponent(ticker)}`),

  getActiveModel: (ticker: string) =>
    request<ModelVersion>(`/models/active?ticker=${encodeURIComponent(ticker)}`),

  triggerRetrain: (ticker: string, force: boolean = false) =>
    request<{ job_id: string; retrained: boolean; [key: string]: any }>("/retrain", {
      method: "POST",
      body: JSON.stringify({ ticker, force }),
    }),

  getRetrainStatus: (jobId: string) => request<RetrainStatus>(`/retrain/status/${jobId}`),

  adminSyncCheck: () => request<{ in_sync: boolean; message: string }>("/admin/sync-check", { method: "POST" }),
};

