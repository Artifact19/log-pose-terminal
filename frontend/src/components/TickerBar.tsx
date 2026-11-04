import React, { useState } from "react";
import { Search, Play, RefreshCw, Calendar, Clock } from "lucide-react";

interface TickerBarProps {
  currentTicker: string;
  onSelectTicker: (ticker: string) => void;
  horizon: number;
  onSelectHorizon: (h: number) => void;
  onRunForecast: () => void;
  isLoading: boolean;
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
  lastBarDate,
  isStale,
}) => {
  const [inputVal, setInputVal] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim().toUpperCase();
    if (clean) {
      onSelectTicker(clean);
      setInputVal("");
    }
  };

  return (
    <div className="bg-clay-card rounded-2xl border border-clay-border p-4 shadow-clay-card mb-6">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Ticker chips & search */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider mr-1">
            Presets:
          </span>
          {PRESET_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => onSelectTicker(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                currentTicker === t
                  ? "bg-terracotta-500 text-white shadow-clay-pill scale-102"
                  : "bg-sand-100 text-ink-primary hover:bg-sand-200 border border-sand-200"
              }`}
            >
              {t}
            </button>
          ))}

          {/* Search box */}
          <form onSubmit={handleSubmit} className="flex items-center relative ml-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value.toUpperCase())}
              placeholder="Search ticker..."
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs font-mono border border-sand-200 bg-sand-50 focus:bg-white focus:outline-hidden focus:border-terracotta-400 w-36 transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 pointer-events-none" />
          </form>
        </div>

        {/* Controls: Horizon + Freshness + Run Button */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          {/* Data freshness pill */}
          {lastBarDate && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono border ${
                isStale
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-sand-100 text-ink-secondary border-sand-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-ink-muted" />
              <span>Market Date: {lastBarDate}</span>
            </div>
          )}

          {/* Horizon Selector */}
          <div className="flex items-center gap-1 bg-sand-100 p-1 rounded-xl border border-sand-200">
            <Calendar className="w-3.5 h-3.5 text-ink-muted ml-1.5 mr-0.5" />
            {PRESET_HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => onSelectHorizon(h)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                  horizon === h
                    ? "bg-clay-card text-terracotta-600 shadow-xs"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {h}D
              </button>
            ))}
          </div>

          {/* Action button */}
          <button
            onClick={onRunForecast}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 active:scale-98 disabled:opacity-60 text-white font-medium text-xs font-mono transition-all shadow-clay-pill cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Generating Forecast...</span>
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
    </div>
  );
};

