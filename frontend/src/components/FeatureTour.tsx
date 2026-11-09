import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, Check, RefreshCw, Lock, Shield, Eye, BarChart2, Cpu } from "lucide-react";
import { useForecastProgress } from "../lib/useForecastProgress";

export interface TourStep {
  target: string; // matches data-tour attribute
  tab: "terminal" | "ledger" | "models";
  title: string;
  sentence: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

// 1. Trader / Normal User Tour (Terminal + Ledger pages)
export const USER_TOUR_STEPS: TourStep[] = [
  {
    target: "ticker-bar",
    tab: "terminal",
    title: "Asset Selector & Search",
    sentence: "Switch between preset US Mega-caps (AAPL, NVDA, MSFT, SPY) and Indian Equities (RELIANCE.NS, TCS.NS), or type any stock symbol in the search box to analyze.",
    placement: "bottom",
  },
  {
    target: "horizon-selector",
    tab: "terminal",
    title: "Forecast Horizon Timeframe",
    sentence: "Select your projection horizon from 3 days up to 20 full trading sessions. The ML model predicts direct multi-horizon price trajectories for each selected timeframe.",
    placement: "bottom",
  },
  {
    target: "run-forecast",
    tab: "terminal",
    title: "ML Forecast Engine",
    sentence: "Executes our gradient-boosted multi-horizon quantile ensemble model to project expected price paths and calibrated statistical uncertainty bounds.",
    placement: "bottom",
  },
  {
    target: "master-chart",
    tab: "terminal",
    title: "Interactive Trajectory Canvas",
    sentence: "Visualizes the expected future path (dashed terracotta line) surrounded by the 80% likely corridor and 95% wider safety range, anchored strictly on the latest market close.",
    placement: "top",
  },
  {
    target: "chart-type-toggle",
    tab: "terminal",
    title: "Candlestick vs Line Toggle",
    sentence: "Switch between full Japanese Candlesticks (open, high, low, close with colored wicks) and a clean single closing price line for flexible price action analysis.",
    placement: "bottom",
  },
  {
    target: "ghost-forecasts-toggle",
    tab: "terminal",
    title: "Past Forecasts & Ghost Runs (Past 10)",
    sentence: "Toggles historical predictions made in prior trading sessions. Verified actual closes are plotted as green circles (hits inside the 80% corridor) or red 'x' marks (misses) for visual proof of accuracy.",
    placement: "bottom",
  },
  {
    target: "reliability-gauge",
    tab: "terminal",
    title: "Prediction Reliability Gauge",
    sentence: "A composite confidence score (0–100) combining Trend Accuracy (vs 50% Random Walk), Range Accuracy (PICP ~80%), Band Tightness (ATR-normalized), and Market Volatility Regime.",
    placement: "left",
  },
  {
    target: "market-anchor",
    tab: "terminal",
    title: "Exchange & Anchor Verification",
    sentence: "Displays the exchange market code, timezone (US ET vs India IST), and the exact market close date and price that anchor this forecast.",
    placement: "left",
  },
  {
    target: "forecast-table",
    tab: "terminal",
    title: "Day-by-Day Price Projections",
    sentence: "Tabular breakdown for every upcoming trading session, detailing target dates, expected closing prices, likely 80% intervals, 95% safety ranges, and expected percentage moves.",
    placement: "top",
  },
  {
    target: "ledger-stats",
    tab: "ledger",
    title: "Track Record Performance Strip",
    sentence: "Switches to Track Record & History to show cumulative verification metrics: Average Error (MAE) vs 2.65% Persistence Baseline and Directional Trend Win Rate vs 50% Random Walk.",
    placement: "bottom",
  },
  {
    target: "ledger-filters",
    tab: "ledger",
    title: "Audit Filters & Price Reconciliation",
    sentence: "Filter past predictions by symbol or status. Click 'Check Actual Prices' to fetch market closing prices and settle all pending forecasts against real-world data.",
    placement: "bottom",
  },
  {
    target: "ledger-table",
    tab: "ledger",
    title: "Historical Forecast Audit Ledger",
    sentence: "Every forecast generated is logged here immutably. Expand any row to inspect its verification scorecard, or click 'View on Chart' to inspect historical forecast trajectories.",
    placement: "top",
  },
];

// 2. Administrator Tour (Terminal + Ledger + AI Model Status pages)
export const ADMIN_TOUR_STEPS: TourStep[] = [
  ...USER_TOUR_STEPS,
  {
    target: "model-overview",
    tab: "models",
    title: "Active Model Architecture & Checksum",
    sentence: "Switches to AI Models Status. View the production model version tag, architecture (XGBoost Direct Multi-Horizon Quantile Ensemble), and immutable SHA-256 notebook checksum.",
    placement: "bottom",
  },
  {
    target: "model-metrics",
    tab: "models",
    title: "Walk-Forward Backtest Benchmarks",
    sentence: "Inspect out-of-sample backtest scores: Historical MAE vs 2.65% Baseline, Trend Directional Accuracy vs 50% Random Walk, and empirical 80% / 95% Conformal Quantile Coverage.",
    placement: "top",
  },
  {
    target: "model-retrain-controls",
    tab: "models",
    title: "Model Recalibration & Retraining Controls",
    sentence: "As Administrator, toggle 'Force Full Recalibration' to rebuild all walk-forward folds from scratch, or trigger retraining to update the model with the latest historical bars.",
    placement: "bottom",
  },
  {
    target: "model-history",
    tab: "models",
    title: "Model Version Registry & Audit Trail",
    sentence: "Full immutable registry of all trained model versions, showing training dates, walk-forward validation scores, and active vs archived deployment statuses.",
    placement: "top",
  },
];

interface FeatureTourProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: "terminal" | "ledger" | "models";
  setActiveTab: (tab: "terminal" | "ledger" | "models") => void;
  isAdmin?: boolean;
  onRunForecast?: () => void;
  isForecastLoading?: boolean;
  isForecastError?: boolean;
  isForecastSuccess?: boolean;
  hasForecast: boolean;
}

export const FeatureTour: React.FC<FeatureTourProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  isAdmin = false,
  onRunForecast,
  isForecastLoading = false,
  isForecastError = false,
  isForecastSuccess = false,
  hasForecast,
}) => {
  const steps = isAdmin ? ADMIN_TOUR_STEPS : USER_TOUR_STEPS;
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);

  const { progress, stage } = useForecastProgress(
    Boolean(isForecastLoading),
    Boolean(isForecastError),
    Boolean(isForecastSuccess)
  );

  const currentStep = steps[currentStepIdx] || steps[0];

  // When tour opens or closes, reset to step 0 and start on terminal
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIdx(0);
      if (activeTab !== "terminal") {
        setActiveTab("terminal");
      }
    }
  }, [isOpen]);

  // Synchronize Tab automatically whenever step changes
  useEffect(() => {
    if (isOpen && currentStep) {
      if (activeTab !== currentStep.tab) {
        setActiveTab(currentStep.tab);
      }
    }
  }, [isOpen, currentStepIdx, currentStep?.tab]);

  // Smoothly locate target element in DOM, with retries to account for tab transition renders
  const updateTargetPosition = useCallback(() => {
    if (!isOpen || !currentStep) return;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    let attempts = 0;
    const findElement = () => {
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        setTimeout(() => {
          setTargetRect(el.getBoundingClientRect());
        }, 180);
      } else if (attempts < 6) {
        attempts++;
        retryTimeoutRef.current = window.setTimeout(findElement, 120);
      } else {
        setTargetRect(null);
      }
    };

    findElement();
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (isOpen) {
      updateTargetPosition();
      const handleResize = () => updateTargetPosition();
      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleResize, true);
      return () => {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleResize, true);
      };
    }
  }, [isOpen, currentStepIdx, activeTab, updateTargetPosition]);

  // Keyboard controls (Arrow keys & Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStepIdx, hasForecast, isForecastLoading]);

  if (!isOpen) return null;

  const handleNext = () => {
    // If on Step 3 (index 2: run-forecast) and NO forecast has been generated yet, prompt generation
    if (currentStepIdx === 2 && !hasForecast) {
      if (onRunForecast && !isForecastLoading) {
        onRunForecast();
      }
      return;
    }
    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1);
    }
  };

  const handleClose = () => {
    setActiveTab("terminal");
    onClose();
  };

  // Dynamic positioning so the dialog card never covers the spotlighted element
  let cardStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    maxWidth: 480,
    width: "calc(100% - 32px)",
  };

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;
    const cardWidth = 480;
    const idealLeft = Math.max(
      16,
      Math.min(window.innerWidth - cardWidth - 16, targetRect.left + targetRect.width / 2 - cardWidth / 2)
    );

    if (spaceBelow >= 270) {
      cardStyle = {
        position: "fixed",
        top: Math.min(window.innerHeight - 300, targetRect.bottom + 16),
        left: idealLeft,
        maxWidth: cardWidth,
        width: "calc(100% - 32px)",
      };
    } else if (spaceAbove >= 270) {
      cardStyle = {
        position: "fixed",
        top: Math.max(16, targetRect.top - 270),
        left: idealLeft,
        maxWidth: cardWidth,
        width: "calc(100% - 32px)",
      };
    }
  }

  const getTabLabel = (tab: "terminal" | "ledger" | "models") => {
    switch (tab) {
      case "terminal":
        return "Forecast Terminal";
      case "ledger":
        return "Track Record & History";
      case "models":
        return "AI Models Status";
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* SVG Mask: Dims everything EXCEPT the target element (Zero blur on selected element) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto z-0 cursor-pointer"
        onClick={handleClose}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White background reveals the darkened overlay */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cutout creates a 100% transparent window over the target */}
            {targetRect && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(24, 18, 14, 0.58)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Crisp glowing bezel around the unblurred target element */}
      {targetRect && (
        <div
          className="fixed border-2 border-terracotta-500 rounded-2xl pointer-events-none transition-all duration-300 ring-4 ring-terracotta-400/40 shadow-[0_0_24px_rgba(200,90,50,0.4)] z-10"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Floating Tour Dialog Card */}
      <div
        style={cardStyle}
        className="z-20 bg-[#FAF6F0] rounded-3xl border-2 border-beige-300 shadow-tactile-card p-6 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
      >
        {/* Card Top: Step counter, Tour role badge, Tab pill, & close button */}
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-beige-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-terracotta-700 bg-beige-200/90 px-2.5 py-0.5 rounded-full border border-beige-300 shadow-2xs">
              <Sparkles className="w-3 h-3 text-terracotta-500" />
              Step {currentStepIdx + 1} of {steps.length}
            </span>

            <span
              className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isAdmin
                  ? "bg-amber-50 text-amber-800 border-amber-300 shadow-2xs"
                  : "bg-beige-200/80 text-ink-secondary border-beige-300"
              }`}
            >
              {isAdmin ? (
                <>
                  <Shield className="w-2.5 h-2.5 text-amber-600" />
                  <span>Admin Tour</span>
                </>
              ) : (
                <span>Trader Tour</span>
              )}
            </span>

            <span className="text-[10px] font-mono text-ink-muted bg-white/70 px-2 py-0.5 rounded-full border border-beige-200">
              {getTabLabel(currentStep.tab)}
            </span>
          </div>

          <button
            onClick={handleClose}
            className="p-1 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-beige-200/60 transition-colors cursor-pointer"
            title="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Title */}
        <h4 className="text-base font-bold text-ink-primary font-mono tracking-tight mb-2">
          {currentStep.title}
        </h4>

        {/* Step 3 Special Handling: Forecast Generation */}
        {currentStepIdx === 2 ? (
          <div className="space-y-3 mb-5">
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">
              Executes our machine learning models to project expected prices and calibrated uncertainty bands for upcoming sessions.
            </p>

            {hasForecast ? (
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs font-mono space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 font-bold">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Forecast generated successfully!</span>
                </div>
                <p className="text-[11px] text-emerald-700 font-sans leading-relaxed">
                  The chart trajectory, reliability score, and price table are now active. Click <strong>Next</strong> when you are ready to explore them.
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-beige-200/70 rounded-2xl border border-beige-300 shadow-tactile-well">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-terracotta-800 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-terracotta-600 shrink-0" />
                  <span>Forecast Required to Unlock Next Steps</span>
                </div>
                <p className="text-xs text-ink-secondary mb-3 leading-relaxed">
                  The trajectory chart, prediction reliability score, and price projections table require a live forecast. Click below to compute:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (onRunForecast && !isForecastLoading) {
                      onRunForecast();
                    }
                  }}
                  disabled={isForecastLoading}
                  className="console-glow-button w-full flex flex-col items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-mono font-bold text-white shadow-clay-pill cursor-pointer"
                >
                  {isForecastLoading ? (
                    <>
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Computing Forecast ({progress}%)...</span>
                      </div>
                      <span className="text-[10px] font-normal opacity-90">{stage}</span>
                      <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden mt-1 p-0.5">
                        <div
                          className="bg-white h-full rounded-full transition-all duration-150"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Forecast & Unlock Tour &rarr;</span>
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-secondary leading-relaxed font-sans mb-6">
            {currentStep.sentence}
          </p>
        )}

        {/* Progress dots & Navigation buttons */}
        <div className="flex items-center justify-between pt-2.5 border-t border-beige-200">
          {/* Progress dots */}
          <div className="flex items-center gap-1 max-w-[200px] flex-wrap">
            {steps.map((_, idx) => {
              const isLocked = idx > 2 && !hasForecast;
              return (
                <button
                  key={idx}
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    setCurrentStepIdx(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    isLocked
                      ? "w-1.5 bg-beige-300/40 cursor-not-allowed"
                      : idx === currentStepIdx
                      ? "w-4 bg-terracotta-500 cursor-pointer"
                      : "w-1.5 bg-beige-300 hover:bg-beige-400 cursor-pointer"
                  }`}
                  aria-label={`Jump to step ${idx + 1}`}
                  title={isLocked ? "Generate forecast first to unlock" : `Step ${idx + 1}`}
                />
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {currentStepIdx > 0 && (
              <button
                onClick={handlePrev}
                className="tactile-pill flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-ink-secondary hover:text-ink-primary cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            {currentStepIdx === 2 && !hasForecast ? (
              <button
                type="button"
                onClick={() => {
                  if (onRunForecast && !isForecastLoading) {
                    onRunForecast();
                  }
                }}
                disabled={isForecastLoading}
                className="console-glow-button flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold text-white cursor-pointer shadow-xs"
              >
                {isForecastLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating ({progress}%)...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Generate First</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="console-glow-button flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-mono font-bold text-white cursor-pointer shadow-xs"
              >
                {currentStepIdx === steps.length - 1 ? (
                  <>
                    <span>Finish Tour</span>
                    <Check className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
