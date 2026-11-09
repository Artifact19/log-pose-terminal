import React, { useState } from "react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { fmtDate, fmtPct, fmtPrice, getMarketInfo } from "../lib/fmt";
import type { ForecastPointDetail } from "../types";

interface ForecastTableProps {
  points: ForecastPointDetail[];
  ticker: string;
}

export const ForecastTable: React.FC<ForecastTableProps> = ({ points, ticker }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const mkt = getMarketInfo(ticker);

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div
      data-tour="forecast-table"
      className="bg-beige-50 rounded-3xl border border-beige-300 p-5 sm:p-6 shadow-tactile-card mt-6 transition-all duration-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-beige-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink-primary font-sans tracking-tight">
              Price Projections by Timeframe
            </h3>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-beige-200 text-ink-secondary border border-beige-300">
              {points.length} Sessions Ahead &middot; {mkt.exchangeCode}
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Statistical forecasts and expected ranges for upcoming {mkt.exchangeName} ({mkt.timezone}) sessions.
          </p>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-beige-300 bg-beige-100 hover:bg-beige-200 text-ink-primary text-xs font-mono font-semibold transition cursor-pointer shadow-2xs"
          title={isExpanded ? "Collapse price projection table" : "Expand price projection table"}
        >
          {isExpanded ? (
            <>
              <span>Collapse Table</span>
              <ChevronUp className="w-3.5 h-3.5 text-terracotta-600" />
            </>
          ) : (
            <>
              <span>Expand Table</span>
              <ChevronDown className="w-3.5 h-3.5 text-terracotta-600" />
            </>
          )}
        </button>
      </div>

      {isExpanded ? (
        <>
          <div className="overflow-x-auto rounded-2xl bg-beige-100/60 border border-beige-200/90 shadow-tactile-well p-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-beige-200 text-[11px] font-sans font-bold text-ink-muted uppercase tracking-wider">
                  <th className="py-3 px-3.5">Timeframe</th>
                  <th className="py-3 px-3.5">Target Date</th>
                  <th className="py-3 px-3.5">Expected Price</th>
                  <th className="py-3 px-3.5">Likely Range (80% Probability)</th>
                  <th className="py-3 px-3.5">Wider Safety Range (95%)</th>
                  <th className="py-3 px-3.5 text-right">Expected Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige-200/60 text-xs font-mono">
                {points.map((p) => {
                  const isPositive = p.predicted_return >= 0;
                  return (
                    <tr key={p.step_ahead} className="hover:bg-white/70 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-terracotta-600 font-sans">
                        {p.step_ahead} {p.step_ahead === 1 ? "Day" : "Days"} Ahead
                      </td>
                      <td className="py-3 px-3.5 text-ink-secondary">{fmtDate(p.target_trading_date)}</td>
                      <td className="py-3 px-3.5 font-bold text-ink-primary text-sm">
                        {fmtPrice(p.predicted_close, ticker)}
                      </td>
                      <td className="py-3 px-3.5 text-ink-secondary">
                        <span className="text-terracotta-700 bg-terracotta-50/90 px-2.5 py-1 rounded-lg border border-terracotta-200/80 text-[11px] font-medium shadow-2xs inline-block">
                          {fmtPrice(p.lower_80, ticker)} – {fmtPrice(p.upper_80, ticker)}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-ink-secondary">
                        <span className="text-ink-muted bg-beige-200/70 px-2.5 py-1 rounded-lg border border-beige-300 text-[11px] font-medium shadow-2xs inline-block">
                          {fmtPrice(p.lower_95, ticker)} – {fmtPrice(p.upper_95, ticker)}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-[11px] shadow-2xs ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                              : "bg-red-50 text-red-800 border border-red-200/80"
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

          <div className="mt-3.5 pt-2.5 border-t border-beige-200/80 text-[11px] text-ink-muted font-sans">
            💡 <strong>How to read this:</strong> The <em>Expected Price</em> is the central forecast. The <em>Likely Range (80%)</em> indicates where the stock is statistically expected to land 8 out of 10 times under comparable market conditions.
          </div>
        </>
      ) : (
        <div
          onClick={() => setIsExpanded(true)}
          className="p-4 rounded-2xl bg-beige-100/70 border border-beige-200 hover:bg-beige-100 cursor-pointer transition flex items-center justify-between text-xs font-mono shadow-2xs"
        >
          <div className="flex items-center gap-2 text-ink-secondary">
            <Calendar className="w-4 h-4 text-terracotta-500 shrink-0" />
            <span>
              {points.length}-Day Target Horizon: Projected Close{" "}
              <strong className="text-ink-primary font-bold">
                {lastPoint ? fmtPrice(lastPoint.predicted_close, ticker) : "—"}
              </strong>{" "}
              {lastPoint && (
                <span
                  className={
                    lastPoint.predicted_return >= 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold"
                  }
                >
                  ({fmtPct(lastPoint.predicted_return * 100, true)})
                </span>
              )}
            </span>
          </div>
          <span className="text-[11px] font-sans text-terracotta-600 font-semibold hover:underline">
            Click to Expand {points.length} Sessions &rarr;
          </span>
        </div>
      )}
    </div>
  );
};
