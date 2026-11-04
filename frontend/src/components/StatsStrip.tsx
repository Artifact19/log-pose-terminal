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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* 1. Average Forecast Error */}
      <div
        className="bg-clay-card rounded-2xl border border-clay-border p-4 shadow-clay-card flex items-center gap-3.5"
        title="Average percentage difference between forecast prices and actual closing prices"
      >
        <div className="w-10 h-10 rounded-xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center border border-terracotta-200 shrink-0">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-ink-muted">
            Average Error (MAE)
          </div>
          <div className="text-xl font-bold font-mono text-ink-primary">
            {stats ? `${stats.mae_pct.toFixed(2)}%` : "—"}
          </div>
          <div className="text-[10px] text-ink-muted">Target: lower is better</div>
        </div>
      </div>

      {/* 2. Directional Accuracy */}
      <div
        className="bg-clay-card rounded-2xl border border-clay-border p-4 shadow-clay-card flex items-center gap-3.5"
        title="Percentage of forecasts that correctly anticipated whether the stock moved up or down"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
          <CheckCircle className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-ink-muted">
            Trend Accuracy
          </div>
          <div className="text-xl font-bold font-mono text-ink-primary">
            {stats ? `${(stats.directional_accuracy * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-ink-muted">Up/down direction hit rate</div>
        </div>
      </div>

      {/* 3. Range Coverage */}
      <div
        className="bg-clay-card rounded-2xl border border-clay-border p-4 shadow-clay-card flex items-center gap-3.5"
        title="Percentage of actual stock closes that landed within the predicted 80% price range"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
            isCovHealthy
              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
              : "bg-amber-50 text-amber-600 border-amber-200"
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-ink-muted">
            Within 80% Expected Range
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              isCovHealthy ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {stats ? `${cov80.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-ink-muted">Target: ~80% calibration</div>
        </div>
      </div>

      {/* 4. Verified Predictions Count */}
      <div
        className="bg-clay-card rounded-2xl border border-clay-border p-4 shadow-clay-card flex items-center gap-3.5"
        title="Total individual forecast points settled against official market closing prices"
      >
        <div className="w-10 h-10 rounded-xl bg-sand-100 text-ink-secondary flex items-center justify-center border border-sand-200 shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-ink-muted">
            Verified Predictions
          </div>
          <div className="text-xl font-bold font-mono text-ink-primary">
            {stats ? `${stats.resolved_count} points` : "0 points"}
          </div>
          <div className="text-[10px] text-ink-muted">Audited against actual closes</div>
        </div>
      </div>
    </div>
  );
};
