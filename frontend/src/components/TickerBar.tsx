import React, { useState } from "react";
import { Search, Play, RefreshCw, Calendar, Clock } from "lucide-react";
import { getMarketInfo } from "../lib/fmt";
import { useForecastProgress } from "../lib/useForecastProgress";

interface TickerBarProps {
  currentTicker: string;
  onSelectTicker: (ticker: string) => void;
  horizon: number;
  onSelectHorizon: (h: number) => void;
  onRunForecast: () => void;
  isLoading: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  lastBarDate?: string;
  isStale?: boolean;
}

const PRESET_TICKERS = ["AAPL", "NVDA", "MSFT", "SPY", "RELIANCE.NS", "TCS.NS"];
const PRESET_HORIZONS = [3, 5, 10, 14, 20];

export const TickerBar: React.FC<TickerBarProps> = ({
  currentTicker,
  onSelectTicker,
  horizon,
  onSelectHorizon,
  onRunForecast,
  isLoading,
  isError = false,
  isSuccess = false,
  lastBarDate,
  isStale,
}) => {
  const [inputVal, setInputVal] = useState("");
  const { progress, stage } = useForecastProgress(isLoading, isError, isSuccess);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim().toUpperCase();
    if (clean) {
      onSelectTicker(clean);
      setInputVal("");
    }
  };

  return (
    <div className="bg-beige-50 rounded-3xl border border-beige-300 p-4 sm:p-5 shadow-tactile-card mb-6">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Ticker chips & search */}
        <div data-tour="ticker-bar" className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <span className="text-xs font-bold text-ink-muted uppercase tracking-wider mr-1">
            Presets:
          </span>
          {PRESET_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => onSelectTicker(t)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                currentTicker === t
                  ? "bg-gradient-to-r from-terracotta-600 to-terracotta-500 text-white shadow-clay-pill border-t border-white/40 scale-102"
                  : "tactile-pill text-ink-primary hover:text-terracotta-600"
              }`}
            >
              {t}
            </button>
          ))}

          {/* Search box (Sunken Well) */}
          <form onSubmit={handleSubmit} className="flex items-center relative ml-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value.toUpperCase())}
              placeholder="Search symbol..."
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs font-mono border border-beige-300 bg-beige-200/60 shadow-tactile-well focus:bg-white focus:outline-hidden focus:border-terracotta-400 w-36 transition-all text-ink-primary"
            />
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 pointer-events-none" />
          </form>
        </div>

        {/* Controls: Horizon + Freshness + Run Button */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          {/* Data freshness pill */}
          {lastBarDate && (() => {
            const mkt = getMarketInfo(currentTicker);
            return (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono border shadow-2xs ${
                  isStale
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-beige-200/60 text-ink-secondary border-beige-300 shadow-tactile-well"
                }`}
                title={`Last daily market close recorded on ${mkt.exchangeName} (${mkt.timezone})`}
              >
                <Clock className="w-3.5 h-3.5 text-ink-muted" />
                <span>Last Close: {lastBarDate}</span>
                <span className="text-[10px] px-1 py-0.2 rounded-sm bg-beige-300/60 text-ink-primary font-bold">
                  {mkt.exchangeCode}
                </span>
              </div>
            );
          })()}

          {/* Horizon Selector (Tactile Tray with Inset Shadows) */}
          <div data-tour="horizon-selector" className="flex items-center gap-1 bg-beige-200/60 p-1 rounded-2xl border border-beige-300 shadow-tactile-well">
            <Calendar className="w-3.5 h-3.5 text-ink-muted ml-1.5 mr-0.5" />
            {PRESET_HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => onSelectHorizon(h)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                  horizon === h
                    ? "bg-white text-terracotta-600 shadow-tactile-btn border-t border-white border-b-2 border-beige-300"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-beige-100/60"
                }`}
              >
                {h}D
              </button>
            ))}
          </div>

          {/* Glowing Luminous Console Action Button */}
          <button
            data-tour="run-forecast"
            onClick={onRunForecast}
            disabled={isLoading}
            className="console-glow-button flex items-center gap-2 px-6 py-2.5 rounded-2xl text-white font-sans font-bold text-xs tracking-wide cursor-pointer disabled:opacity-75 transition-all"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Generating ({progress}%)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Generate {horizon}-Day Forecast</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Computational Percentage Progress Bar */}
      {progress > 0 && (
        <div className="mt-4 pt-3.5 border-t border-beige-300 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center text-xs font-mono mb-1.5">
            <span className="flex items-center gap-2 text-terracotta-700 font-semibold">
              <RefreshCw className={`w-3.5 h-3.5 ${progress < 100 ? "animate-spin" : "text-emerald-600"}`} />
              <span>{stage}</span>
            </span>
            <span className="font-bold text-ink-primary font-mono text-xs">{progress}%</span>
          </div>
          <div className="w-full bg-beige-200/90 h-2.5 rounded-full overflow-hidden shadow-tactile-well p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-150 ease-out shadow-2xs ${
                progress >= 100
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
                  : "bg-gradient-to-r from-terracotta-600 via-amber-500 to-terracotta-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
