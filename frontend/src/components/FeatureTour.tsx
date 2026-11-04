import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, Check, RefreshCw } from "lucide-react";

export interface TourStep {
  target: string; // matches data-tour attribute
  title: string;
  sentence: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "ticker-bar",
    title: "Stock Selector & Search",
    sentence: "Pick preset stocks from US or Indian markets, or type any stock symbol in the search bar to analyze.",
    placement: "bottom",
  },
  {
    target: "horizon-selector",
    title: "Forecast Timeframe",
    sentence: "Choose how many future trading sessions to project (from 3 days up to 20 full sessions).",
    placement: "bottom",
  },
  {
    target: "run-forecast",
    title: "Generate Forecast",
    sentence: "Runs our machine learning models to project expected prices and calibrated uncertainty bands.",
    placement: "bottom",
  },
  {
    target: "master-chart",
    title: "Interactive Trajectory Chart",
    sentence: "Visualizes the expected future price path surrounded by 80% likely and 95% safety ranges.",
    placement: "top",
  },
  {
    target: "reliability-gauge",
    title: "Prediction Reliability Gauge",
    sentence: "Combines past trend accuracy, range coverage, and market volatility into an overall confidence score out of 100.",
    placement: "left",
  },
  {
    target: "market-anchor",
    title: "Exchange & Anchor Date",
    sentence: "Shows the specific stock exchange, local timezone, and the last completed market close that anchors the forecast.",
    placement: "left",
  },
  {
    target: "forecast-table",
    title: "Price Projections Table",
    sentence: "Detailed day-by-day table showing expected prices, percentage changes, and probability bands for every upcoming session.",
    placement: "top",
  },
  {
    target: "nav-tabs",
    title: "Audit Ledger & Track Record",
    sentence: "Switch to 'Track Record & History' to verify how past forecasts performed against actual market closing prices.",
    placement: "bottom",
  },
];

interface FeatureTourProps {
  isOpen: boolean;
  onClose: () => void;
  onRunForecast?: () => void;
  isForecastLoading?: boolean;
}

export const FeatureTour: React.FC<FeatureTourProps> = ({
  isOpen,
  onClose,
  onRunForecast,
  isForecastLoading,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = TOUR_STEPS[currentStepIdx];

  const updateTargetPosition = useCallback(() => {
    if (!isOpen || !currentStep) return;
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      setTimeout(() => {
        setTargetRect(el.getBoundingClientRect());
      }, 250);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (isOpen) {
      updateTargetPosition();
      const handleResize = () => updateTargetPosition();
      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleResize, true);
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleResize, true);
      };
    }
  }, [isOpen, currentStepIdx, updateTargetPosition]);

  // When on step 2 (Generate Forecast button), listen for clicks on the actual button in the DOM
  useEffect(() => {
    if (isOpen && currentStepIdx === 2) {
      const btn = document.querySelector('[data-tour="run-forecast"]');
      const handleBtnClick = () => {
        setTimeout(() => {
          setCurrentStepIdx(3);
        }, 350);
      };
      btn?.addEventListener("click", handleBtnClick);
      return () => btn?.removeEventListener("click", handleBtnClick);
    }
  }, [isOpen, currentStepIdx]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStepIdx]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIdx < TOUR_STEPS.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1);
    }
  };

  // Dynamic positioning so the dialog card never covers the spotlighted element
  let cardStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    maxWidth: 460,
    width: "calc(100% - 32px)",
  };

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;
    const cardWidth = 460;
    const idealLeft = Math.max(
      16,
      Math.min(window.innerWidth - cardWidth - 16, targetRect.left + targetRect.width / 2 - cardWidth / 2)
    );

    if (spaceBelow >= 260) {
      cardStyle = {
        position: "fixed",
        top: Math.min(window.innerHeight - 280, targetRect.bottom + 16),
        left: idealLeft,
        maxWidth: cardWidth,
        width: "calc(100% - 32px)",
      };
    } else if (spaceAbove >= 260) {
      cardStyle = {
        position: "fixed",
        top: Math.max(16, targetRect.top - 260),
        left: idealLeft,
        maxWidth: cardWidth,
        width: "calc(100% - 32px)",
      };
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* SVG Mask: Dims everything EXCEPT the target element (Zero blur or dim on the selected element!) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto z-0 cursor-pointer"
        onClick={onClose}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White background reveals the darkened overlay */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cutout creates a 100% crystal-clear, unblurred transparent window over the target */}
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

      {/* Crisp glowing bezel around the crystal-clear unblurred target element */}
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

      {/* Floating Tour Card (Positioned so it doesn't obstruct the spotlight) */}
      <div
        style={cardStyle}
        className="z-20 bg-[#FAF6F0] rounded-3xl border-2 border-beige-300 shadow-tactile-card p-6 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
      >
        {/* Card Top: Step counter & close button */}
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-beige-200">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-terracotta-700 bg-beige-200/90 px-2.5 py-0.5 rounded-full border border-beige-300 shadow-2xs">
              <Sparkles className="w-3 h-3 text-terracotta-500" />
              Step {currentStepIdx + 1} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-beige-200/60 transition-colors cursor-pointer"
            title="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <h4 className="text-base font-bold text-ink-primary font-mono tracking-tight mb-2">
          {currentStep.title}
        </h4>

        {/* Dynamic Content: If Step 2, prompt user to generate forecast first */}
        {currentStepIdx === 2 ? (
          <div className="space-y-3 mb-5">
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">
              Runs our machine learning models to project expected prices and calibrated uncertainty bands.
            </p>
            <div className="p-3.5 bg-beige-200/60 rounded-2xl border border-beige-300 shadow-tactile-well">
              <p className="text-xs font-mono font-semibold text-ink-primary mb-2.5">
                Generate a forecast first to bring all charts, reliability gauges, and projections to life:
              </p>
              <button
                type="button"
                onClick={() => {
                  if (onRunForecast) {
                    onRunForecast();
                  }
                  setCurrentStepIdx(3);
                }}
                disabled={isForecastLoading}
                className="console-glow-button w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-mono font-bold text-white shadow-clay-pill cursor-pointer"
              >
                {isForecastLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Calculating Multi-Horizon Bounds...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Forecast & Continue &rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-secondary leading-relaxed font-sans mb-6">
            {currentStep.sentence}
          </p>
        )}

        {/* Progress dots & Navigation buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-beige-200">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStepIdx(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIdx
                    ? "w-5 bg-terracotta-500"
                    : "w-1.5 bg-beige-300 hover:bg-beige-400"
                }`}
                aria-label={`Jump to step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStepIdx > 0 && (
              <button
                onClick={handlePrev}
                className="tactile-pill flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-ink-secondary hover:text-ink-primary cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="console-glow-button flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-mono font-bold text-white cursor-pointer shadow-xs"
            >
              {currentStepIdx === TOUR_STEPS.length - 1 ? (
                <>
                  <span>Done</span>
                  <Check className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
