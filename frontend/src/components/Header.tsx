import React, { useState } from "react";
import { TrendingUp, FileText, Cpu, CheckCircle2, AlertTriangle, Info, HelpCircle, User, LogOut, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { HealthResponse } from "../types";

interface HeaderProps {
  activeTab: "terminal" | "ledger" | "models";
  setActiveTab: (tab: "terminal" | "ledger" | "models") => void;
  health?: HealthResponse;
  onOpenTour?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, health, onOpenTour }) => {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const { user, isAdmin, openAuthModal, signOut } = useAuth();

  return (
    <>
      <header className="bg-beige-50/95 backdrop-blur-md border-b border-beige-300 px-3 sm:px-6 py-2.5 sm:py-3 shadow-clay-sm sticky top-0 z-30 transition-colors">
        <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between gap-2 sm:gap-4 lg:gap-6 flex-nowrap">
          {/* 1. Logo & Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="relative group shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden border border-white/80 shadow-tactile-knob bg-beige-100 flex items-center justify-center transition-transform group-hover:scale-105">
                <img
                  src="/cat-logo.jpg"
                  alt="Log Pose Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-market-up rounded-full border-2 border-beige-50 shadow-xs" title="Terminal Live" />
            </div>

            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-ink-primary font-sans whitespace-nowrap">
                  Log Pose <span className="text-terracotta-500 font-extrabold">Terminal</span>
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-semibold uppercase tracking-wider rounded-lg bg-beige-200/70 text-ink-secondary border border-beige-300/80 shadow-2xs whitespace-nowrap">
                  v2.0
                </span>
              </div>
              <p className="hidden xl:block text-[11px] text-ink-muted whitespace-nowrap">Stock Forecasting Terminal</p>
            </div>
          </div>

          {/* 2. Navigation Switcher (Tactile Recessed Well with Extruded Buttons) */}
          <nav data-tour="nav-tabs" className="flex items-center bg-beige-200/70 p-1 rounded-2xl border border-beige-300/90 shadow-tactile-well shrink-0">
            <button
              onClick={() => setActiveTab("terminal")}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "terminal"
                  ? "bg-white text-terracotta-600 shadow-tactile-btn border-t border-white border-b-2 border-beige-300"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-beige-100/50"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Forecast Terminal</span>
            </button>

            <button
              onClick={() => setActiveTab("ledger")}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "ledger"
                  ? "bg-white text-terracotta-600 shadow-tactile-btn border-t border-white border-b-2 border-beige-300"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-beige-100/50"
              }`}
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Track Record & History</span>
            </button>

            <button
              onClick={() => setActiveTab("models")}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "models"
                  ? "bg-white text-terracotta-600 shadow-tactile-btn border-t border-white border-b-2 border-beige-300"
                  : "text-ink-secondary hover:text-ink-primary hover:bg-beige-100/50"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>AI Model Status</span>
            </button>
          </nav>

          {/* 3. System Status, User Profile & Disclaimer */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 whitespace-nowrap">
            {/* Quick Tour Button */}
            {onOpenTour && (
              <button
                onClick={onOpenTour}
                className="tactile-pill flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-mono font-medium text-ink-primary hover:text-terracotta-600 transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
                title="Start Interactive Feature Tour"
              >
                <HelpCircle className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                <span>Quick Tour</span>
              </button>
            )}

            {/* AI Engine Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium border shadow-2xs shrink-0 whitespace-nowrap ${
                health?.ml_exports_in_sync
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                  : "bg-amber-50 text-amber-800 border-amber-200/80"
              }`}
              title="Forecasting algorithms and feature pipelines are verified and synchronized."
            >
              {health?.ml_exports_in_sync ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="hidden md:inline">AI Engine:</span> <span>Verified</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="hidden md:inline">AI Engine:</span> <span>Update Needed</span>
                </>
              )}
            </div>

            {/* User Profile / Sign In Pill */}
            {user ? (
              <div className="flex items-center gap-2 bg-beige-200/80 pl-1.5 pr-2.5 py-1 rounded-full border border-beige-300 shadow-2xs font-mono text-xs shrink-0 whitespace-nowrap">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 ${
                    isAdmin
                      ? "bg-gradient-to-tr from-terracotta-600 to-terracotta-400"
                      : "bg-ink-secondary"
                  }`}
                >
                  {isAdmin ? <Shield className="w-3.5 h-3.5" /> : user.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink-primary max-w-[110px] sm:max-w-[130px] truncate" title={user.email}>
                    {user.email.split("@")[0]}
                  </span>
                  {isAdmin && (
                    <span className="px-1.5 py-0.2 rounded-sm bg-terracotta-500 text-white font-bold text-[9px] shadow-2xs shrink-0">
                      ADMIN
                    </span>
                  )}
                </div>
                <button
                  onClick={signOut}
                  className="p-1 text-ink-muted hover:text-terracotta-600 rounded-lg hover:bg-beige-300/50 transition-colors cursor-pointer ml-0.5 shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="tactile-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium text-ink-primary hover:text-terracotta-600 transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                <span>Sign In</span>
              </button>
            )}

            <button
              onClick={() => setShowDisclaimer(true)}
              className="p-1.5 text-ink-muted hover:text-ink-primary rounded-xl hover:bg-beige-200/60 transition-colors cursor-pointer border border-transparent hover:border-beige-300 shrink-0"
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
