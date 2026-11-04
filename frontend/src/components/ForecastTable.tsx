import React from "react";
import { fmtDate, fmtPct, fmtPrice } from "../lib/fmt";
import type { ForecastPointDetail } from "../types";

interface ForecastTableProps {
  points: ForecastPointDetail[];
  ticker: string;
}

export const ForecastTable: React.FC<ForecastTableProps> = ({ points, ticker }) => {
  return (
    <div className="bg-clay-card rounded-2xl border border-clay-border p-5 shadow-clay-card mt-6">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-sand-200">
        <div>
          <h3 className="text-sm font-bold text-ink-primary font-mono tracking-tight">
            Price Projections by Timeframe
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Statistical forecasts and expected ranges for upcoming trading sessions.
          </p>
        </div>
        <span className="text-xs text-ink-muted font-mono">{points.length} Sessions Ahead</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-sand-200 text-[11px] font-mono text-ink-muted uppercase tracking-wider">
              <th className="py-2.5 px-3">Timeframe</th>
              <th className="py-2.5 px-3">Target Date</th>
              <th className="py-2.5 px-3">Expected Price</th>
              <th className="py-2.5 px-3">Likely Range (80% Probability)</th>
              <th className="py-2.5 px-3">Wider Safety Range (95%)</th>
              <th className="py-2.5 px-3 text-right">Expected Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100 text-xs font-mono">
            {points.map((p) => {
              const isPositive = p.predicted_return >= 0;
              return (
                <tr key={p.step_ahead} className="hover:bg-sand-50/60 transition-colors">
                  <td className="py-3 px-3 font-semibold text-terracotta-600">
                    {p.step_ahead} {p.step_ahead === 1 ? "Day" : "Days"} Ahead
                  </td>
                  <td className="py-3 px-3 text-ink-secondary">{fmtDate(p.target_trading_date)}</td>
                  <td className="py-3 px-3 font-semibold text-ink-primary">
                    {fmtPrice(p.predicted_close, ticker)}
                  </td>
                  <td className="py-3 px-3 text-ink-secondary">
                    <span className="text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded-md border border-terracotta-200 text-[11px]">
                      {fmtPrice(p.lower_80, ticker)} – {fmtPrice(p.upper_80, ticker)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-ink-secondary">
                    <span className="text-ink-muted bg-sand-100 px-2 py-0.5 rounded-md border border-sand-200 text-[11px]">
                      {fmtPrice(p.lower_95, ticker)} – {fmtPrice(p.upper_95, ticker)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                        isPositive
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      {fmtPct(p.predicted_return * 100, true)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-2 border-t border-sand-100 text-[11px] text-ink-muted">
        💡 <strong>How to read this:</strong> The <em>Expected Price</em> is the central forecast. The <em>Likely Range (80%)</em> indicates where the stock is statistically expected to land 8 out of 10 times under comparable market conditions.
      </div>
    </div>
  );
};
