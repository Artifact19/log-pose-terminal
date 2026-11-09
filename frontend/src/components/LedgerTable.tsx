import React, { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Filter } from "lucide-react";
import { fmtDate, fmtPrice } from "../lib/fmt";
import { Scorecard } from "./Scorecard";
import type { ForecastRunDetail } from "../types";

interface LedgerTableProps {
  runs: ForecastRunDetail[];
  onReconcile: () => void;
  isReconciling: boolean;
  onViewOnChart?: (run: ForecastRunDetail) => void;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  runs,
  onReconcile,
  isReconciling,
  onViewOnChart,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tickerFilter, setTickerFilter] = useState<string>("");

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredRuns = runs.filter((r) => {
    if (statusFilter !== "ALL" && r.resolution_status !== statusFilter) return false;
    if (tickerFilter && !r.ticker.toLowerCase().includes(tickerFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="bg-clay-card rounded-3xl border border-clay-border p-6 shadow-tactile-card">
      {/* Top Filter and Check Actuals Toolbar */}
      <div data-tour="ledger-filters" className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5 pb-4 border-b border-beige-300">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Filter className="w-4 h-4 text-ink-muted" />
            <span className="font-semibold uppercase tracking-wider">Filter:</span>
          </div>

          <input
            type="text"
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            placeholder="Search symbol..."
            className="px-3.5 py-1.5 rounded-xl text-xs font-mono border border-beige-300 bg-beige-100/70 focus:bg-white focus:outline-none w-32 shadow-inner text-ink-primary"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="tactile-pill px-3 py-1.5 rounded-xl text-xs font-mono text-ink-primary cursor-pointer focus:outline-none"
          >
            <option value="ALL">All Forecasts</option>
            <option value="RESOLVED">Fully Verified</option>
            <option value="PARTIALLY_RESOLVED">Partially Verified</option>
            <option value="PENDING">Awaiting Close</option>
          </select>
        </div>

        <button
          onClick={onReconcile}
          disabled={isReconciling}
          className="tactile-pill flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium text-ink-primary hover:text-terracotta-700 transition-colors cursor-pointer disabled:opacity-50"
          title="Fetch latest closing prices from the market to audit pending predictions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? "animate-spin text-terracotta-500" : "text-ink-muted"}`} />
          {isReconciling ? "Checking Market Closes..." : "Check Actual Prices"}
        </button>
      </div>

      {/* Runs Table */}
      {filteredRuns.length === 0 ? (
        <div className="text-center py-12 text-ink-muted text-xs font-mono">
          No forecasts found matching the selected filters.
        </div>
      ) : (
        <div data-tour="ledger-table" className="overflow-x-auto rounded-2xl bg-beige-100/40 border border-beige-200/90 shadow-inner p-1">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-beige-300 text-[11px] text-ink-muted uppercase tracking-wider">
                <th className="py-2.5 px-3"></th>
                <th className="py-2.5 px-3">Date Generated</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Forecast Date</th>
                <th className="py-2.5 px-3">Confidence Score</th>
                <th className="py-2.5 px-3">Market State</th>
                <th className="py-2.5 px-3">Verification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-200">
              {filteredRuns.map((r) => {
                const isExpanded = expandedId === r.id;
                const resolvedCount = r.points.filter((p) => p.actual_close !== null).length;

                let statusBadge = (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-beige-200 text-ink-muted border border-beige-300">
                    AWAITING CLOSE
                  </span>
                );
                if (r.resolution_status === "RESOLVED") {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                      VERIFIED ({resolvedCount}/{r.horizon_days} Days)
                    </span>
                  );
                } else if (r.resolution_status === "PARTIALLY_RESOLVED") {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                      PARTIAL ({resolvedCount}/{r.horizon_days} Days)
                    </span>
                  );
                }

                let regimeText = "Normal";
                let regimeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs";
                if (r.regime_status === "ELEVATED_VOL") {
                  regimeText = "High Volatility";
                  regimeStyle = "bg-amber-50 text-amber-800 border-amber-200 shadow-xs";
                } else if (r.regime_status === "OOD_WARNING") {
                  regimeText = "Unusual Shift";
                  regimeStyle = "bg-red-50 text-red-800 border-red-200 shadow-xs";
                }

                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => toggleExpand(r.id)}
                      className="hover:bg-beige-50/90 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 text-ink-muted">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-terracotta-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-ink-muted" />
                        )}
                      </td>
                      <td className="py-3 px-3 text-ink-secondary">{fmtDate(r.created_at)}</td>
                      <td className="py-3 px-3 font-bold text-ink-primary">
                        {r.ticker}
                        {r.is_seeded_demo && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-md bg-beige-200 text-ink-secondary border border-beige-300">
                            DEMO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-ink-secondary">
                        {fmtDate(r.anchor_date)} ({fmtPrice(r.anchor_close_price, r.ticker)})
                      </td>
                      <td className="py-3 px-3 font-semibold text-ink-primary">
                        {r.confidence_score.toFixed(1)}/100
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${regimeStyle}`}>
                          {regimeText}
                        </span>
                      </td>
                      <td className="py-3 px-3">{statusBadge}</td>
                    </tr>

                    {/* Expandable Scorecard */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="p-3 bg-beige-100/50">
                          <Scorecard run={r} onViewOnChart={onViewOnChart} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
