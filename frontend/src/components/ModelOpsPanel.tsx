import React, { useState } from "react";
import { Cpu, RefreshCw, GitBranch } from "lucide-react";
import { fmtDate } from "../lib/fmt";
import type { ModelVersion } from "../types";

interface ModelOpsPanelProps {
  ticker: string;
  activeModel?: ModelVersion;
  allModels?: ModelVersion[];
  onTriggerRetrain: (force: boolean) => void;
  isRetraining: boolean;
  retrainStage?: string;
  retrainDiff?: any;
}

export const ModelOpsPanel: React.FC<ModelOpsPanelProps> = ({
  ticker,
  activeModel,
  allModels = [],
  onTriggerRetrain,
  isRetraining,
  retrainStage,
  retrainDiff,
}) => {
  const [forceRetrain, setForceRetrain] = useState(false);

  return (
    <div className="space-y-6">
      {/* 1. Active Model Overview Card */}
      <div className="bg-clay-card rounded-3xl border border-clay-border p-6 shadow-tactile-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-beige-300 mb-5 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold text-ink-primary font-mono tracking-tight">{ticker} Forecasting Model</span>
              {activeModel && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                  ACTIVE & CALIBRATED
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted font-mono">
              Model Type: Gradient Boosted Quantile Ensemble &middot; Engine Checksum:{" "}
              {activeModel?.notebook_hash ? activeModel.notebook_hash.slice(0, 10) : "—"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-mono text-ink-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceRetrain}
                onChange={(e) => setForceRetrain(e.target.checked)}
                className="rounded-sm border-beige-300 text-terracotta-500 focus:ring-terracotta-400"
              />
              Force Full Recalibration
            </label>

            <button
              onClick={() => onTriggerRetrain(forceRetrain)}
              disabled={isRetraining}
              className="console-glow-button flex items-center gap-2 px-5 py-2.5 rounded-2xl disabled:opacity-60 text-white font-mono text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetraining ? "animate-spin" : ""}`} />
              {isRetraining ? "Recalibrating Model..." : "Update Model with Latest Market Data"}
            </button>
          </div>
        </div>

        {/* Retrain Stepper Stage (When active) */}
        {isRetraining && (
          <div className="p-4 rounded-2xl bg-beige-100 border border-beige-300 mb-5 animate-pulse">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-terracotta-700 mb-1">
              <RefreshCw className="w-4 h-4 animate-spin text-terracotta-500" />
              <span>Current Pipeline Step: {retrainStage || "PROCESSING"}</span>
            </div>
            <p className="text-[11px] text-ink-secondary">
              Analyzing historical market price dynamics, validating across past market cycles, and calibrating prediction ranges.
            </p>
          </div>
        )}

        {/* Retrain Comparison (After Retrain) */}
        {retrainDiff && (
          <div className="p-5 rounded-2xl bg-beige-100/60 border border-beige-300 mb-6 shadow-inner">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-beige-300">
              <span className="text-xs font-bold font-mono text-ink-primary">
                Model Evaluation & Upgrade Result
              </span>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  retrainDiff.activated
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs"
                    : "bg-amber-50 text-amber-800 border-amber-200 shadow-xs"
                }`}
              >
                {retrainDiff.activated ? "NEW VERSION ACTIVATED" : "CURRENT MODEL RETAINED"}
              </span>
            </div>

            <p className="text-xs text-ink-secondary mb-3 font-mono">
              Result: {retrainDiff.activation_reason || "Evaluated against activation thresholds."}
            </p>

            {retrainDiff.old && retrainDiff.new && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-[#FAF6F0] p-3 rounded-xl border border-beige-200 shadow-xs">
                  <div className="text-[10px] text-ink-muted uppercase">Historical Error (MAE)</div>
                  <div className="font-bold text-ink-primary mt-1">
                    {retrainDiff.new.walk_forward_mae.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    Prev: {retrainDiff.old.walk_forward_mae.toFixed(2)}%
                  </div>
                </div>

                <div className="bg-[#FAF6F0] p-3 rounded-xl border border-beige-200 shadow-xs">
                  <div className="text-[10px] text-ink-muted uppercase">Trend Accuracy</div>
                  <div className="font-bold text-ink-primary mt-1">
                    {(retrainDiff.new.directional_accuracy * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    Prev: {(retrainDiff.old.directional_accuracy * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="bg-[#FAF6F0] p-3 rounded-xl border border-beige-200 shadow-xs">
                  <div className="text-[10px] text-ink-muted uppercase">Inside 80% Range</div>
                  <div className="font-bold text-ink-primary mt-1">
                    {(retrainDiff.new.empirical_coverage_80 * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    Prev: {(retrainDiff.old.empirical_coverage_80 * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="bg-[#FAF6F0] p-3 rounded-xl border border-beige-200 shadow-xs">
                  <div className="text-[10px] text-ink-muted uppercase">Version Identifier</div>
                  <div className="font-bold text-terracotta-600 mt-1 truncate">
                    {retrainDiff.new_version_tag}
                  </div>
                  <div className="text-[10px] text-ink-muted">Saved Immutably</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Model Metrics Grid */}
        {activeModel ? (
          <div>
            <div className="text-xs font-semibold text-ink-secondary mb-2.5">
              Backtested Performance Metrics (Historical Simulation):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
              <div className="bg-beige-100/60 p-3 rounded-xl border border-beige-200 shadow-xs" title="Average percentage error across backtested historical forecasts">
                <span className="text-[10px] text-ink-muted uppercase tracking-wider block">Average Error (MAE)</span>
                <span className="text-base font-bold text-ink-primary mt-0.5 block">
                  {activeModel.walk_forward_mae.toFixed(2)}%
                </span>
              </div>

              <div className="bg-beige-100/60 p-3 rounded-xl border border-beige-200 shadow-xs" title="Percentage of times the model correctly anticipated whether the stock moved up or down">
                <span className="text-[10px] text-ink-muted uppercase tracking-wider block">Trend Accuracy</span>
                <span className="text-base font-bold text-ink-primary mt-0.5 block">
                  {(activeModel.directional_accuracy * 100).toFixed(1)}%
                </span>
              </div>

              <div className="bg-beige-100/60 p-3 rounded-xl border border-beige-200 shadow-xs" title="Percentage of past prices that landed inside the 80% prediction range">
                <span className="text-[10px] text-ink-muted uppercase tracking-wider block">80% Range Accuracy</span>
                <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                  {(activeModel.empirical_coverage_80 * 100).toFixed(1)}%
                </span>
              </div>

              <div className="bg-beige-100/60 p-3 rounded-xl border border-beige-200 shadow-xs" title="Percentage of past prices that landed inside the 95% prediction range">
                <span className="text-[10px] text-ink-muted uppercase tracking-wider block">95% Range Accuracy</span>
                <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                  {activeModel.empirical_coverage_95
                    ? `${(activeModel.empirical_coverage_95 * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>

              <div className="bg-beige-100/60 p-3 rounded-xl border border-beige-200 shadow-xs" title="Width of the predicted price band relative to normal historical market volatility">
                <span className="text-[10px] text-ink-muted uppercase tracking-wider block">Band Tightness</span>
                <span className="text-base font-bold text-ink-primary mt-0.5 block">
                  {activeModel.mpiw_80_atr ? `${activeModel.mpiw_80_atr.toFixed(2)}x` : "—"}
                </span>
              </div>

              <div className="bg-beige-100/60 p-3 rounded-xl border border-beige-200 shadow-xs" title="Most recent market session included in model training">
                <span className="text-[10px] text-ink-muted uppercase tracking-wider block">Trained Through</span>
                <span className="text-base font-bold text-ink-primary mt-0.5 block">
                  {activeModel.train_end_date}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-ink-muted font-mono">
            No active model found. Click "Update Model with Latest Market Data" to train the initial model.
          </div>
        )}
      </div>

      {/* 2. Model History Log */}
      <div className="bg-clay-card rounded-3xl border border-clay-border p-6 shadow-tactile-card">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-beige-300">
          <GitBranch className="w-4 h-4 text-terracotta-500" />
          <h3 className="text-sm font-bold text-ink-primary font-mono tracking-tight">
            Historical Model Versions ({allModels.length})
          </h3>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-beige-100/40 border border-beige-200/90 shadow-inner p-1">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-beige-300 text-[10px] text-ink-muted uppercase tracking-wider">
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-3">Trained On</th>
                <th className="py-2.5 px-3">Training Window</th>
                <th className="py-2.5 px-3">Test Error (MAE)</th>
                <th className="py-2.5 px-3">Trend Accuracy</th>
                <th className="py-2.5 px-3">80% Range</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-200">
              {allModels.map((m) => (
                <tr key={m.id} className="hover:bg-beige-50/90 transition-colors">
                  <td className="py-3 px-3 font-semibold text-ink-primary">{m.version_tag}</td>
                  <td className="py-3 px-3 text-ink-secondary">{m.trained_at ? fmtDate(m.trained_at) : m.train_end_date}</td>
                  <td className="py-3 px-3 text-ink-secondary">{m.train_start_date} – {m.train_end_date}</td>
                  <td className="py-3 px-3 text-ink-primary font-medium">{m.walk_forward_mae.toFixed(2)}%</td>
                  <td className="py-3 px-3 text-ink-primary font-medium">{(m.directional_accuracy * 100).toFixed(1)}%</td>
                  <td className="py-3 px-3 text-emerald-700 font-medium">{(m.empirical_coverage_80 * 100).toFixed(1)}%</td>
                  <td className="py-3 px-3">
                    {m.is_active ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-beige-200 text-ink-muted border border-beige-300">
                        ARCHIVED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
