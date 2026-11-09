import React from "react";
import { CheckCircle, Target, ShieldCheck, Database } from "lucide-react";
import type { LedgerStats } from "../types";

interface StatsStripProps {
  stats?: LedgerStats;
}

export const StatsStrip: React.FC<StatsStripProps> = ({ stats }) => {
  const cov80 = stats ? stats.coverage_80 * 100 : 80;
  const isCovHealthy = cov80 >= 70 && cov80 <= 90;

  return (
    <div data-tour="ledger-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* 1. Average Forecast Error */}
      <div
        className="bg-beige-50 rounded-3xl border border-beige-300 p-4 sm:p-5 shadow-tactile-card flex items-center gap-3.5 transition-transform hover:-translate-y-0.5"
        title="Average percentage difference between forecast prices and actual closing prices (Benchmark: ~2.65% Naive Persistence)"
      >
        <div className="w-11 h-11 rounded-2xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center border border-terracotta-200/80 shadow-tactile-btn shrink-0">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
            Average Error (MAE)
          </div>
          <div className="text-xl font-extrabold font-mono text-ink-primary mt-0.5">
            {stats ? `${stats.mae_pct.toFixed(2)}%` : "—"}
          </div>
          <div className="text-[10px] text-ink-muted">vs 2.65% Persistence Baseline</div>
        </div>
      </div>

      {/* 2. Directional Accuracy */}
      <div
        className="bg-beige-50 rounded-3xl border border-beige-300 p-4 sm:p-5 shadow-tactile-card flex items-center gap-3.5 transition-transform hover:-translate-y-0.5"
        title="Percentage of forecasts that correctly anticipated whether the stock moved up or down (Benchmark: 50.0% Random Walk)"
      >
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/80 shadow-tactile-btn shrink-0">
          <CheckCircle className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
            Trend Accuracy
          </div>
          <div className="text-xl font-extrabold font-mono text-ink-primary mt-0.5 flex items-baseline gap-1.5">
            <span>{stats ? `${(stats.directional_accuracy * 100).toFixed(1)}%` : "—"}</span>
            {stats && stats.directional_accuracy > 0.5 && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md">
                +{((stats.directional_accuracy - 0.5) * 100).toFixed(1)}% Edge
              </span>
            )}
          </div>
          <div className="text-[10px] text-ink-muted">vs 50.0% Random Walk Baseline</div>
        </div>
      </div>

      {/* 3. Range Coverage */}
      <div
        className="bg-beige-50 rounded-3xl border border-beige-300 p-4 sm:p-5 shadow-tactile-card flex items-center gap-3.5 transition-transform hover:-translate-y-0.5"
        title="Percentage of actual stock closes that landed within the predicted 80% price range (Target: 80% Conformal Calibration)"
      >
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-tactile-btn shrink-0 ${
            isCovHealthy
              ? "bg-emerald-50 text-emerald-600 border-emerald-200/80"
              : "bg-amber-50 text-amber-600 border-amber-200/80"
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
            Within 80% Range
          </div>
          <div
            className={`text-xl font-extrabold font-mono mt-0.5 ${
              isCovHealthy ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {stats ? `${cov80.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-ink-muted">Target: ~80% Calibrated Target</div>
        </div>
      </div>

      {/* 4. Verified Predictions Count */}
      <div
        className="bg-beige-50 rounded-3xl border border-beige-300 p-4 sm:p-5 shadow-tactile-card flex items-center gap-3.5 transition-transform hover:-translate-y-0.5"
        title="Total individual forecast points settled against official market closing prices"
      >
        <div className="w-11 h-11 rounded-2xl bg-beige-200 text-ink-secondary flex items-center justify-center border border-beige-300 shadow-tactile-btn shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
            Verified Predictions
          </div>
          <div className="text-xl font-extrabold font-mono text-ink-primary mt-0.5">
            {stats ? `${stats.resolved_count} points` : "0 points"}
          </div>
          <div className="text-[10px] text-ink-muted">Audited against actual closes</div>
        </div>
      </div>
    </div>
  );
};
