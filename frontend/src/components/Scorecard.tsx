import React from "react";
import { Check, X, Clock, ExternalLink } from "lucide-react";
import { fmtDate, fmtPct, fmtPrice } from "../lib/fmt";
import type { ForecastRunDetail } from "../types";

interface ScorecardProps {
  run: ForecastRunDetail;
  onViewOnChart?: (run: ForecastRunDetail) => void;
}

export const Scorecard: React.FC<ScorecardProps> = ({ run, onViewOnChart }) => {
  const points = run.points || [];

  return (
    <div className="bg-[#FAF6F0] rounded-2xl border border-beige-300/80 p-5 mt-3 shadow-tactile-well animate-in fade-in">
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-beige-300">
        <div>
          <span className="text-xs font-bold text-ink-primary font-mono tracking-tight">
            Performance Verification: {run.ticker}
          </span>
          <span className="text-[11px] text-ink-muted ml-2 font-mono">
            Forecast Made: {fmtDate(run.anchor_date)} (Base Price: ${run.anchor_close_price.toFixed(2)})
          </span>
        </div>

        {onViewOnChart && (
          <button
            onClick={() => onViewOnChart(run)}
            className="tactile-pill flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-medium text-terracotta-700 hover:text-terracotta-800 transition-all cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-terracotta-500" />
            Inspect on Chart
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl bg-beige-50/60 border border-beige-200/80 shadow-inner p-1">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-beige-300/80 text-[10px] text-ink-muted uppercase tracking-wider">
              <th className="py-2.5 px-3">Timeframe</th>
              <th className="py-2.5 px-3">Target Date</th>
              <th className="py-2.5 px-3">Forecast Price</th>
              <th className="py-2.5 px-3">Expected Range (80%)</th>
              <th className="py-2.5 px-3">Actual Market Close</th>
              <th className="py-2.5 px-3">Difference %</th>
              <th className="py-2.5 px-3">Trend Direction</th>
              <th className="py-2.5 px-3">Inside Range</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-beige-200">
            {points.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-xs text-ink-muted font-mono">
                  No timeframe projection points recorded for this run.
                </td>
              </tr>
            ) : (
              points.map((p) => {
                const isResolved = p.actual_close !== null && p.actual_close !== undefined;
                return (
                  <tr key={p.step_ahead} className="hover:bg-beige-100/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-terracotta-600">
                      {p.step_ahead} {p.step_ahead === 1 ? "Day" : "Days"} Ahead
                    </td>
                    <td className="py-2.5 px-3 text-ink-secondary">{fmtDate(p.target_trading_date)}</td>
                    <td className="py-2.5 px-3 font-semibold text-ink-primary">
                      {fmtPrice(p.predicted_close, run.ticker)}
                    </td>
                    <td className="py-2.5 px-3 text-ink-muted">
                      {fmtPrice(p.lower_80, run.ticker)} – {fmtPrice(p.upper_80, run.ticker)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-ink-primary">
                      {isResolved ? fmtPrice(p.actual_close, run.ticker) : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      {isResolved && p.pct_error !== null && p.pct_error !== undefined ? (
                        <span className={p.pct_error > 0 ? "text-terracotta-600 font-semibold" : "text-emerald-700 font-semibold"}>
                          {fmtPct(p.pct_error, true)}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {isResolved ? (
                        p.direction_correct ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                            <Check className="w-3 h-3 text-emerald-600" /> CORRECT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-800 border border-red-200 shadow-xs">
                            <X className="w-3 h-3 text-red-600" /> INCORRECT
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
                          <Clock className="w-3 h-3" /> AWAITING CLOSE
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {isResolved ? (
                        p.inside_80_band ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                            IN RANGE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-800 border border-red-200 shadow-xs">
                            OUT OF RANGE
                          </span>
                        )
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
