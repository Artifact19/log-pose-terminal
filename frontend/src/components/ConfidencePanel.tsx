import React from "react";
import { AlertCircle, HelpCircle, ShieldAlert } from "lucide-react";
import { ConfidenceGauge } from "./ConfidenceGauge";
import type { ForecastRunDetail } from "../types";

interface ConfidencePanelProps {
  run: ForecastRunDetail;
}

export const ConfidencePanel: React.FC<ConfidencePanelProps> = ({ run }) => {
  const meta = run.confidence_metadata || {};
  const comp = meta.component_scores || {
    accuracy: 50,
    calibration: 80,
    tightness: 70,
    regime: 85,
  };

  const isOod = run.regime_status === "OOD_WARNING";
  const isElevated = run.regime_status === "ELEVATED_VOL";

  return (
    <div className="bg-clay-card rounded-2xl border border-clay-border p-5 shadow-clay-card flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-sand-200 mb-3">
          <h3 className="text-sm font-bold text-ink-primary font-mono tracking-tight">
            Prediction Reliability
          </h3>
          <span className="text-[11px] font-mono text-ink-muted">Risk Assessment</span>
        </div>

        {/* Gauge */}
        <ConfidenceGauge score={run.confidence_score} regime={run.regime_status} />

        {/* Regime Warning Banner */}
        {isOod && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-bold">Unusual Market Shift:</span> Recent price swings diverge significantly from historical training data. The model has automatically widened the expected price ranges to account for uncertainty.
            </div>
          </div>
        )}

        {isElevated && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">High Volatility Environment:</span> Market fluctuations are larger than usual. Expect wider price targets across all horizons.
            </div>
          </div>
        )}

        {/* 4 Breakdown Sub-scores */}
        <div className="mt-4 space-y-3">
          {/* 1. Accuracy */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-ink-secondary flex items-center gap-1">
                Trend Accuracy (30%)
                <span title="How reliably historical model forecasts identified upward vs downward direction">
                  <HelpCircle className="w-3 h-3 text-ink-muted cursor-help" />
                </span>
              </span>
              <span className="font-mono font-medium text-ink-primary">
                {meta.directional_accuracy !== undefined
                  ? `${(meta.directional_accuracy * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="w-full bg-sand-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-terracotta-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, comp.accuracy))}%` }}
              />
            </div>
          </div>

          {/* 2. Calibration (PICP 80) */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-ink-secondary flex items-center gap-1">
                Range Accuracy (30%)
                <span title="Percentage of actual market prices that landed inside the predicted 80% range">
                  <HelpCircle className="w-3 h-3 text-ink-muted cursor-help" />
                </span>
              </span>
              <span className="font-mono font-medium text-ink-primary">
                {meta.picp_80 !== undefined ? `${(meta.picp_80 * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="w-full bg-sand-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, comp.calibration))}%` }}
              />
            </div>
          </div>

          {/* 3. Tightness */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-ink-secondary flex items-center gap-1">
                Forecast Precision (20%)
                <span title="Measures whether the forecast price band is sharp and informative rather than overly wide">
                  <HelpCircle className="w-3 h-3 text-ink-muted cursor-help" />
                </span>
              </span>
              <span className="font-mono font-medium text-ink-primary">
                {meta.mpiw_80_atr !== undefined ? `${meta.mpiw_80_atr.toFixed(2)}x ATR` : "—"}
              </span>
            </div>
            <div className="w-full bg-sand-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, comp.tightness))}%` }}
              />
            </div>
          </div>

          {/* 4. Regime Volatility */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-ink-secondary flex items-center gap-1">
                Market Stability (20%)
                <span title="Measures current market calmness against long-term historical norms">
                  <HelpCircle className="w-3 h-3 text-ink-muted cursor-help" />
                </span>
              </span>
              <span className="font-mono font-medium text-ink-primary">
                {meta.regime_vol_z !== undefined ? `${meta.regime_vol_z.toFixed(2)}z` : "—"}
              </span>
            </div>
            <div className="w-full bg-sand-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, comp.regime))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-sand-200 flex justify-between items-center text-[11px] text-ink-muted font-mono">
        <span>Forecast Date: {run.anchor_date}</span>
        <span>Base Close: ${run.anchor_close_price.toFixed(2)}</span>
      </div>
    </div>
  );
};
