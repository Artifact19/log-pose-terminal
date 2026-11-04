import React from "react";
import { AlertCircle, HelpCircle, ShieldAlert, Globe } from "lucide-react";
import { ConfidenceGauge } from "./ConfidenceGauge";
import { fmtPrice, getMarketInfo } from "../lib/fmt";
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
    <div className="bg-beige-50 rounded-3xl border border-beige-300 p-6 shadow-tactile-card flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-beige-200 mb-4">
          <h3 className="text-sm font-bold text-ink-primary font-sans tracking-tight">
            Prediction Reliability
          </h3>
          <span className="text-[11px] font-mono text-ink-muted px-2 py-0.5 rounded-lg bg-beige-200/60 border border-beige-300">
            Risk Assessment
          </span>
        </div>

        {/* Gauge */}
        <ConfidenceGauge score={run.confidence_score} regime={run.regime_status} />

        {/* Regime Warning Banner */}
        {isOod && (
          <div className="mt-4 p-3.5 rounded-2xl bg-red-50/90 border border-red-200 text-red-800 text-xs flex items-start gap-2 shadow-2xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-bold">Unusual Market Shift:</span> Recent price swings diverge significantly from historical training data. The model has automatically widened the expected price ranges to account for uncertainty.
            </div>
          </div>
        )}

        {isElevated && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-800 text-xs flex items-start gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">High Volatility Environment:</span> Market fluctuations are larger than usual. Expect wider price targets across all horizons.
            </div>
          </div>
        )}

        {/* 4 Breakdown Sub-scores */}
        <div className="mt-5 space-y-3.5">
          {/* 1. Accuracy */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-ink-secondary flex items-center gap-1 font-medium">
                Trend Accuracy (30%)
                <span title="How reliably historical model forecasts identified upward vs downward direction">
                  <HelpCircle className="w-3.5 h-3.5 text-ink-muted cursor-help" />
                </span>
              </span>
              <span className="font-mono font-bold text-ink-primary">
                {meta.directional_accuracy !== undefined
                  ? `${(meta.directional_accuracy * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="w-full bg-beige-200/90 h-2.5 rounded-full overflow-hidden shadow-tactile-well p-0.5">
              <div
                className="bg-gradient-to-r from-terracotta-600 to-terracotta-500 h-full rounded-full transition-all duration-500 shadow-2xs"
                style={{ width: `${Math.min(100, Math.max(0, comp.accuracy))}%` }}
              />
            </div>
          </div>

          {/* 2. Calibration (PICP 80) */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-ink-secondary flex items-center gap-1 font-medium">
                Range Accuracy (30%)
                <span title="Percentage of actual market prices that landed inside the predicted 80% range">
                  <HelpCircle className="w-3.5 h-3.5 text-ink-muted cursor-help" />
                </span>
              </span>
              <span className="font-mono font-bold text-ink-primary">
                {meta.picp_80 !== undefined ? `${(meta.picp_80 * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="w-full bg-beige-200/90 h-2.5 rounded-full overflow-hidden shadow-tactile-well p-0.5">
              <div
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-2xs"
                style={{ width: `${Math.min(100, Math.max(0, comp.calibration))}%` }}
              />
            </div>
          </div>

          {/* 3. Tightness */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-ink-secondary flex items-center gap-1 font-medium">
                Forecast Precision (20%)
                <span title="Measures whether the forecast price band is sharp and informative rather than overly wide">
                  <HelpCircle className="w-3.5 h-3.5 text-ink-muted cursor-help" />
                </span>
              </span>
              <span className="font-mono font-bold text-ink-primary">
                {meta.mpiw_80_atr !== undefined ? `${meta.mpiw_80_atr.toFixed(2)}x ATR` : "—"}
              </span>
            </div>
            <div className="w-full bg-beige-200/90 h-2.5 rounded-full overflow-hidden shadow-tactile-well p-0.5">
              <div
                className="bg-gradient-to-r from-amber-600 to-amber-500 h-full rounded-full transition-all duration-500 shadow-2xs"
                style={{ width: `${Math.min(100, Math.max(0, comp.tightness))}%` }}
              />
            </div>
          </div>

          {/* 4. Regime Volatility */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-ink-secondary flex items-center gap-1 font-medium">
                Market Stability (20%)
                <span title="Measures current market calmness against long-term historical norms">
                  <HelpCircle className="w-3.5 h-3.5 text-ink-muted cursor-help" />
                </span>
              </span>
              <span className="font-mono font-bold text-ink-primary">
                {meta.regime_vol_z !== undefined ? `${meta.regime_vol_z.toFixed(2)}z` : "—"}
              </span>
            </div>
            <div className="w-full bg-beige-200/90 h-2.5 rounded-full overflow-hidden shadow-tactile-well p-0.5">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full transition-all duration-500 shadow-2xs"
                style={{ width: `${Math.min(100, Math.max(0, comp.regime))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Anchor Date, Market Exchange & Base Price Metadata */}
      {(() => {
        const mkt = getMarketInfo(run.ticker);
        return (
          <div className="mt-5 pt-3 border-t border-beige-300 text-[11px] text-ink-muted font-mono space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-ink-secondary">Anchor Date (Last Close):</span>
              <span className="font-bold text-ink-primary">{run.anchor_date}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-secondary flex items-center gap-1">
                <Globe className="w-3 h-3 text-terracotta-500" />
                Market / Exchange:
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-beige-200/80 border border-beige-300 font-semibold text-terracotta-700">
                <span>{mkt.exchangeCode}</span>
                <span className="text-[10px] text-ink-muted">({mkt.timezone})</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-secondary">Base Market Close:</span>
              <span className="font-bold text-ink-primary">{fmtPrice(run.anchor_close_price, run.ticker)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
