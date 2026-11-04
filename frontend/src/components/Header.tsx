import React, { useState } from "react";
import { TrendingUp, FileText, Cpu, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import type { HealthResponse } from "../types";

interface HeaderProps {
  activeTab: "terminal" | "ledger" | "models";
  setActiveTab: (tab: "terminal" | "ledger" | "models") => void;
  health?: HealthResponse;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, health }) => {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <>
      <header className="bg-beige-50/95 backdrop-blur-md border-b border-beige-300 px-6 py-3.5 shadow-clay-sm sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/80 shadow-tactile-knob bg-beige-100 flex items-center justify-center transition-transform group-hover:scale-105">
                <img
                  src="/cat-logo.jpg"
                  alt="Log Pose Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-market-up rounded-full border-2 border-beige-50 shadow-xs" title="Terminal Live" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-ink-primary font-sans">
                  Log Pose <span className="text-terracotta-500 font-extrabold">Terminal</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-lg bg-beige-200/70 text-ink-secondary border border-beige-300/80 shadow-2xs">
                  Terminal v2.0
                </span>
              </div>
              <p className="text-xs text-ink-muted">AI Stock Navigation & Performance Verification</p>
            </div>
          </div>

          {/* Navigation Switcher (Tactile Recessed Well with Extruded Buttons) */}
          <nav className="flex items-center bg-beige-200/70 p-1.5 rounded-2xl border border-beige-300/90 shadow-tactile-well">
            <button
              onClick={() => setActiveTab("terminal")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "terminal"
                  ? "bg-white text-terracotta-600 shadow-tactile-btn border-t border-white border-b-2 border-beige-300"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-beige-100/50"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Forecast Terminal
            </button>

            <button
              onClick={() => setActiveTab("ledger")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "ledger"
                  ? "bg-white text-terracotta-600 shadow-tactile-btn border-t border-white border-b-2 border-beige-300"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-beige-100/50"
              }`}
            >
              <FileText className="w-4 h-4" />
              Track Record & History
            </button>

            <button
              onClick={() => setActiveTab("models")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "models"
                  ? "bg-white text-terracotta-600 shadow-tactile-btn border-t border-white border-b-2 border-beige-300"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-beige-100/50"
              }`}
            >
              <Cpu className="w-4 h-4" />
              AI Model Status
            </button>
          </nav>

          {/* System Status & Disclaimer Link */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border shadow-2xs ${
                health?.ml_exports_in_sync
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                  : "bg-amber-50 text-amber-800 border-amber-200/80"
              }`}
              title="Forecasting algorithms and feature pipelines are verified and synchronized."
            >
              {health?.ml_exports_in_sync ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AI Engine: Verified</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>AI Engine: Update Needed</span>
                </>
              )}
            </div>

            <button
              onClick={() => setShowDisclaimer(true)}
              className="p-2 text-ink-muted hover:text-ink-primary rounded-xl hover:bg-beige-200/60 transition-colors cursor-pointer border border-transparent hover:border-beige-300"
              title="Important Disclaimer"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Financial Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
          <div className="bg-beige-50 rounded-3xl p-6 max-w-md w-full border border-beige-300 shadow-tactile-card animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-terracotta-600 mb-3">
              <Info className="w-5 h-5" />
              <h3 className="font-bold text-base text-ink-primary">Methodology & Regulatory Disclaimer</h3>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed mb-4">
              Log Pose Terminal is an analytical system engineered strictly for quantitative research,
              model forward-testing, and auditable uncertainty measurement.
            </p>
            <div className="bg-beige-100 p-3.5 rounded-xl border border-beige-300 text-[11px] text-ink-secondary font-mono mb-4 shadow-tactile-well">
              NOT FINANCIAL ADVICE. Statistical forecasts and probability ranges are mathematical estimates
              derived from past market patterns and are not guarantees of future stock performance.
            </div>
            <button
              onClick={() => setShowDisclaimer(false)}
              className="w-full py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-medium text-xs transition-colors shadow-clay-pill cursor-pointer"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </>
  );
};
