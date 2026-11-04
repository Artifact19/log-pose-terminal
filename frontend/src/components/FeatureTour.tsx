import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, Check } from "lucide-react";

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
    sentence: "Runs our machine learning models to project future prices and calibrated uncertainty bands.",
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
}

export const FeatureTour: React.FC<FeatureTourProps> = ({ isOpen, onClose }) => {
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* Dark overlay backdrop */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Spotlight highlight cut-out around target element */}
      {targetRect && (
        <div
          className="absolute border-2 border-terracotta-400 rounded-2xl pointer-events-none transition-all duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-4 ring-terracotta-300/40"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Floating Tour Card */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto max-w-md w-full bg-[#FAF6F0] rounded-3xl border-2 border-beige-300 shadow-tactile-card p-6 animate-in fade-in zoom-in-95 duration-200">
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

          {/* One Simple Sentence */}
          <p className="text-sm text-ink-secondary leading-relaxed font-sans mb-6">
            {currentStep.sentence}
          </p>

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
                    <span>Finish</span>
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
    </div>
  );
};

