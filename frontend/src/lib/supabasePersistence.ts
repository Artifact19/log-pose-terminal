import { supabase, isSupabaseConfigured } from "./supabase";
import type { ForecastRunDetail } from "../types";

export async function saveForecastToSupabase(run: ForecastRunDetail): Promise<void> {
  // Also save to localStorage for instant client cache
  try {
    const key = `logpose_saved_run_${run.ticker.toUpperCase()}`;
    localStorage.setItem(key, JSON.stringify(run));
    const allKey = "logpose_all_saved_runs";
    const existing = JSON.parse(localStorage.getItem(allKey) || "[]");
    const filtered = existing.filter((r: ForecastRunDetail) => r.id !== run.id);
    localStorage.setItem(allKey, JSON.stringify([run, ...filtered].slice(0, 50)));
  } catch {}

  if (!isSupabaseConfigured || !supabase) return;

  try {
    const { error: runErr } = await supabase.from("forecast_run").upsert({
      id: run.id,
      ticker: run.ticker.toUpperCase(),
      anchor_date: run.anchor_date,
      anchor_close_price: run.anchor_close_price,
      horizon_days: run.horizon_days,
      confidence_score: run.confidence_score,
      regime_status: run.regime_status,
      confidence_metadata: run.confidence_metadata || {},
      resolution_status: run.resolution_status || "PENDING",
      is_seeded_demo: false,
    });

    if (runErr) {
      console.warn("[Supabase] Failed to save forecast_run:", runErr.message);
      return;
    }

    if (run.points && run.points.length > 0) {
      const pointsToInsert = run.points.map((p) => ({
        forecast_run_id: run.id,
        step_ahead: p.step_ahead,
        target_trading_date: p.target_trading_date,
        predicted_return: p.predicted_return,
        predicted_close: p.predicted_close,
        lower_80: p.lower_80,
        upper_80: p.upper_80,
        lower_95: p.lower_95,
        upper_95: p.upper_95,
        actual_close: p.actual_close ?? null,
        actual_return: p.actual_return ?? null,
        abs_error: p.abs_error ?? null,
        pct_error: p.pct_error ?? null,
        direction_correct: p.direction_correct ?? null,
        inside_80_band: p.inside_80_band ?? null,
        inside_95_band: p.inside_95_band ?? null,
      }));

      const { error: pointErr } = await supabase
        .from("forecast_point")
        .upsert(pointsToInsert, { onConflict: "forecast_run_id,step_ahead" });

      if (pointErr) {
        console.warn("[Supabase] Failed to save forecast_points:", pointErr.message);
      }
    }
  } catch (err) {
    console.warn("[Supabase] Upsert exception:", err);
  }
}

export async function fetchLedgerRunsFromSupabase(ticker?: string): Promise<ForecastRunDetail[] | null> {
  // Check Supabase first
  if (isSupabaseConfigured && supabase) {
    try {
      let q = supabase
        .from("forecast_run")
        .select("*, forecast_point(*)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (ticker) {
        q = q.eq("ticker", ticker.toUpperCase());
      }

      const { data, error } = await q;

      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({
          id: r.id,
          ticker: r.ticker,
          model_version_id: r.model_version_id || 1,
          created_at: r.created_at,
          anchor_date: r.anchor_date,
          anchor_close_price: r.anchor_close_price,
          horizon_days: r.horizon_days,
          confidence_score: r.confidence_score,
          regime_status: r.regime_status,
          confidence_metadata: r.confidence_metadata || {},
          resolution_status: r.resolution_status,
          is_seeded_demo: Boolean(r.is_seeded_demo),
          points: (r.forecast_point || [])
            .sort((a: any, b: any) => a.step_ahead - b.step_ahead)
            .map((p: any) => ({
              step_ahead: p.step_ahead,
              target_trading_date: p.target_trading_date,
              predicted_return: p.predicted_return,
              predicted_close: p.predicted_close,
              lower_80: p.lower_80,
              upper_80: p.upper_80,
              lower_95: p.lower_95,
              upper_95: p.upper_95,
              actual_close: p.actual_close,
              actual_return: p.actual_return,
              abs_error: p.abs_error,
              pct_error: p.pct_error,
              direction_correct: p.direction_correct,
              inside_80_band: p.inside_80_band,
              inside_95_band: p.inside_95_band,
              resolved_at: p.resolved_at,
            })),
        }));
      }
    } catch (err) {
      console.warn("[Supabase] Query exception:", err);
    }
  }

  // Fallback to localStorage cache (with automatic stale run cleanup)
  try {
    const isObsolete = (run: any) => !run?.anchor_date || run.anchor_date < "2026-11-01";

    if (ticker) {
      const key = `logpose_saved_run_${ticker.toUpperCase()}`;
      const single = localStorage.getItem(key);
      if (single) {
        const parsed = JSON.parse(single);
        if (isObsolete(parsed)) {
          localStorage.removeItem(key);
        } else {
          return [parsed];
        }
      }
    }
    const all = localStorage.getItem("logpose_all_saved_runs");
    if (all) {
      const parsed = JSON.parse(all);
      const valid = parsed.filter((r: ForecastRunDetail) => !isObsolete(r));
      if (valid.length !== parsed.length) {
        localStorage.setItem("logpose_all_saved_runs", JSON.stringify(valid));
      }
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

