import type { ForecastRunDetail, LedgerStats } from "../types";

/**
 * Saves forecast to local display cache only.
 * Frontend does NOT write forecast_run / forecast_point directly to Supabase.
 * The backend API owns the ledger database and table insertions.
 */
export async function saveForecastToSupabase(run: ForecastRunDetail): Promise<void> {
  if (!run || run.is_seeded_demo) {
    // Simulated demo forecasts must NOT be written to shared ledger
    return;
  }
  try {
    const key = `logpose_saved_run_${run.ticker.toUpperCase()}`;
    localStorage.setItem(key, JSON.stringify(run));
    const allKey = "logpose_all_saved_runs";
    const existing = JSON.parse(localStorage.getItem(allKey) || "[]");
    const filtered = existing.filter((r: ForecastRunDetail) => r.id !== run.id);
    localStorage.setItem(allKey, JSON.stringify([run, ...filtered].slice(0, 50)));
  } catch {}
}

/**
 * Reads ledger runs from short-lived display cache when backend is unreachable.
 */
export async function fetchLedgerRunsFromSupabase(ticker?: string): Promise<ForecastRunDetail[] | null> {
  try {
    const isObsolete = (run: any) =>
      !run?.anchor_date ||
      run.anchor_date < "2026-11-01" ||
      (run.ticker === "AAPL" && run.anchor_close_price < 300) ||
      (run.ticker === "SPY" && run.anchor_close_price < 650) ||
      (run.ticker === "MSFT" && run.anchor_close_price < 450);

    if (ticker) {
      const key = `logpose_saved_run_${ticker.toUpperCase()}`;
      const single = localStorage.getItem(key);
      if (single) {
        const parsed = JSON.parse(single);
        if (!isObsolete(parsed)) {
          return [parsed];
        }
      }
    }
    const all = localStorage.getItem("logpose_all_saved_runs");
    if (all) {
      const parsed = JSON.parse(all);
      const valid = parsed.filter((r: ForecastRunDetail) => !isObsolete(r));
      if (ticker) {
        const filtered = valid.filter((r: ForecastRunDetail) => r.ticker === ticker.toUpperCase());
        if (filtered.length > 0) return filtered;
      } else if (valid.length > 0) {
        return valid;
      }
    }
  } catch {}
  return null;
}

/**
 * Browser-side synthetic reconciliation against mock bars has been deleted.
 * Settlement must only use real closes, executed on the backend via POST /api/reconcile.
 */
export async function reconcilePendingRuns(
  _ticker?: string
): Promise<{ resolved_points: number; affected_runs: number }> {
  return { resolved_points: 0, affected_runs: 0 };
}

/**
 * Calculates live ledger stats from resolved points.
 * If no resolved points exist, returns zero metrics instead of hardcoded fake data.
 */
export async function calculateLiveLedgerStats(
  ticker?: string,
  windowDays: number = 30
): Promise<LedgerStats> {
  const runs = (await fetchLedgerRunsFromSupabase(ticker)) || [];
  const resolvedPoints = runs.flatMap((r) =>
    (r.points || []).filter(
      (p) => p.actual_close !== null && p.actual_close !== undefined
    )
  );

  if (resolvedPoints.length === 0) {
    return {
      ticker,
      window_days: windowDays,
      resolved_count: 0,
      mae_pct: 0,
      directional_accuracy: 0,
      coverage_80: 0,
      coverage_95: 0,
    };
  }

  const n = resolvedPoints.length;
  const maePct =
    resolvedPoints.reduce((acc, p) => acc + Math.abs(p.pct_error || 0), 0) / n;
  const dirCorrectCount = resolvedPoints.filter((p) => p.direction_correct).length;
  const in80Count = resolvedPoints.filter((p) => p.inside_80_band).length;
  const in95Count = resolvedPoints.filter((p) => p.inside_95_band).length;

  return {
    ticker,
    window_days: windowDays,
    resolved_count: n,
    mae_pct: Number(maePct.toFixed(2)),
    directional_accuracy: Number((dirCorrectCount / n).toFixed(4)),
    coverage_80: Number((in80Count / n).toFixed(4)),
    coverage_95: Number((in95Count / n).toFixed(4)),
  };
}
