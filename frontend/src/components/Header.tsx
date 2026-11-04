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
      <header className="bg-clay-card border-b border-clay-border px-6 py-3 shadow-clay-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-terracotta-200 shadow-clay-sm bg-sand-100 flex items-center justify-center transition-transform group-hover:scale-105">
                <img
                  src="/cat-logo.jpg"
                  alt="Log Pose Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-market-up rounded-full border-2 border-white shadow-xs" title="Terminal Live" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-ink-primary font-mono">
                  Log Pose <span className="text-terracotta-500">Terminal</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-md bg-sand-100 text-ink-secondary border border-sand-200">
                  Terminal v2.0
                </span>
              </div>
              <p className="text-xs text-ink-muted">AI Stock Navigation & Performance Verification</p>
            </div>
          </div>

          {/* Navigation Switcher */}
          <nav className="flex items-center bg-sand-100 p-1 rounded-2xl border border-clay-border">
            <button
              onClick={() => setActiveTab("terminal")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "terminal"
                  ? "bg-clay-card text-terracotta-600 shadow-clay-sm"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Forecast Terminal
            </button>

            <button
              onClick={() => setActiveTab("ledger")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "ledger"
                  ? "bg-clay-card text-terracotta-600 shadow-clay-sm"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <FileText className="w-4 h-4" />
              Track Record & History
            </button>

            <button
              onClick={() => setActiveTab("models")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "models"
                  ? "bg-clay-card text-terracotta-600 shadow-clay-sm"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <Cpu className="w-4 h-4" />
              AI Model Status
            </button>
          </nav>

          {/* System Status & Disclaimer Link */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium border ${
                health?.ml_exports_in_sync
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
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
              className="p-2 text-ink-muted hover:text-ink-primary rounded-xl hover:bg-sand-100 transition-colors cursor-pointer"
              title="Important Disclaimer"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Professional Financial Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-clay-card rounded-3xl p-6 max-w-md w-full border border-clay-border shadow-clay-card animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-terracotta-600 mb-3">
              <Info className="w-5 h-5" />
              <h3 className="font-bold text-base text-ink-primary">Methodology & Regulatory Disclaimer</h3>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed mb-4">
              Log Pose Terminal is an analytical system engineered strictly for quantitative research,
              model forward-testing, and auditable uncertainty measurement.
            </p>
            <div className="bg-sand-50 p-3 rounded-xl border border-sand-200 text-[11px] text-ink-secondary font-mono mb-4">
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
