import React, { useState } from "react";
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Clock,
  Compass,
} from "lucide-react";
import type { SentimentResponse } from "../types";

interface SentimentPulsePanelProps {
  sentiment: SentimentResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
  ticker: string;
  directionalAccuracy?: number;
}

export const SentimentPulsePanel: React.FC<SentimentPulsePanelProps> = ({
  sentiment,
  isLoading,
  onRefresh,
  ticker,
  directionalAccuracy,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!sentiment && isLoading) {
    return (
      <div className="bg-beige-50 rounded-3xl border border-beige-300 p-6 shadow-tactile-card animate-pulse">
        <div className="flex items-center justify-between pb-3 border-b border-beige-200 mb-4">
          <div className="h-4 w-48 bg-beige-200 rounded"></div>
          <div className="h-4 w-24 bg-beige-200 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="h-20 bg-beige-200/70 rounded-2xl"></div>
          <div className="h-20 bg-beige-200/70 rounded-2xl"></div>
          <div className="h-20 bg-beige-200/70 rounded-2xl"></div>
        </div>
        <div className="space-y-3">
          <div className="h-14 bg-beige-200/50 rounded-2xl"></div>
          <div className="h-14 bg-beige-200/50 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!sentiment) return null;

  const score = sentiment.score;
  const isSubBaseline = directionalAccuracy !== undefined && directionalAccuracy < 0.50;

  // Sentiment colors
  const isBullish = score > 0.12;
  const isBearish = score < -0.12;

  const scoreColor = isBullish
    ? "text-emerald-700 bg-emerald-50 border-emerald-300"
    : isBearish
    ? "text-terracotta-700 bg-terracotta-50 border-terracotta-300"
    : "text-amber-800 bg-amber-50 border-amber-300";

  const total = sentiment.articles_analyzed || 1;
  const bullishPct = Math.round((sentiment.bullish_count / total) * 100);
  const bearishPct = Math.round((sentiment.bearish_count / total) * 100);
  const neutralPct = Math.max(0, 100 - bullishPct - bearishPct);

  return (
    <div
      data-tour="sentiment-pulse"
      className="bg-beige-50 rounded-3xl border border-beige-300 p-6 shadow-tactile-card transition-all duration-300"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-beige-200 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-terracotta-500/10 border border-terracotta-500/20 flex items-center justify-center text-terracotta-600 shadow-2xs">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-ink-primary font-sans tracking-tight">
                Market Pulse & NLP Sentiment
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                LIVE NLP STREAM
              </span>
            </div>
            <p className="text-[11px] text-ink-muted">
              Live financial news headline polarity & event impact for {ticker}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-beige-300 bg-beige-100/80 hover:bg-beige-200 text-ink-secondary text-xs font-mono font-medium transition cursor-pointer disabled:opacity-50"
            title="Refresh breaking financial news"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-terracotta-500" : ""}`} />
            <span>{isLoading ? "Analyzing..." : "Refresh News"}</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-mono text-ink-muted hover:text-ink-primary px-2 py-1 rounded-lg bg-beige-200/50 cursor-pointer"
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5 font-mono">
        {/* 1. Composite Sentiment */}
        <div className="bg-beige-100/70 p-4 rounded-2xl border border-beige-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="uppercase text-[10px] tracking-wider font-semibold">Composite Sentiment</span>
            <span title="Aggregate news polarity scored from -1.0 (Extreme Bearish) to +1.0 (Extreme Bullish)">
              <HelpCircle className="w-3.5 h-3.5 text-ink-muted cursor-help" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-ink-primary">
              {score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2)}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider ${scoreColor}`}
            >
              {sentiment.label}
            </span>
          </div>
          <span className="text-[10px] text-ink-muted mt-2 block font-sans">
            Scored across {sentiment.articles_analyzed} recent headlines
          </span>
        </div>

        {/* 2. Quant Drift Tilt (Option A) */}
        <div className="bg-beige-100/70 p-4 rounded-2xl border border-beige-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="uppercase text-[10px] tracking-wider font-semibold flex items-center gap-1">
              <Compass className="w-3 h-3 text-terracotta-500" />
              Directional Conviction
            </span>
            <span title="How live news sentiment modifies the forecast path">
              <HelpCircle className="w-3.5 h-3.5 text-ink-muted cursor-help" />
            </span>
          </div>
          <div className="mt-1">
            {isSubBaseline ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-terracotta-700">
                  {sentiment.drift_tilt_pct >= 0
                    ? `+${sentiment.drift_tilt_pct.toFixed(2)}%`
                    : `${sentiment.drift_tilt_pct.toFixed(2)}%`}
                </span>
                <span className="text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded bg-terracotta-100 text-terracotta-800 border border-terracotta-200">
                  DRIFT TILT ACTIVE
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-emerald-700">
                  {sentiment.drift_tilt_pct >= 0
                    ? `+${sentiment.drift_tilt_pct.toFixed(2)}%`
                    : `${sentiment.drift_tilt_pct.toFixed(2)}%`}
                </span>
                <span className="text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  MOMENTUM CONFIRMED
                </span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-ink-muted mt-2 block font-sans">
            {isSubBaseline
              ? "Replaces flat random walk with catalyst-driven direction"
              : "Affirms technical momentum with positive news flow"}
          </span>
        </div>

        {/* 3. Coverage Polarity Dispersion */}
        <div className="bg-beige-100/70 p-4 rounded-2xl border border-beige-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span className="uppercase text-[10px] tracking-wider font-semibold">Headline Consensus</span>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                sentiment.news_velocity === "HIGH" || sentiment.articles_analyzed >= 8
                  ? "bg-terracotta-100 text-terracotta-800 border-terracotta-300"
                  : sentiment.articles_analyzed >= 4
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-beige-200 text-ink-secondary border-beige-300"
              }`}
            >
              {sentiment.news_velocity === "HIGH" || sentiment.articles_analyzed >= 8
                ? "HIGH VELOCITY"
                : sentiment.articles_analyzed >= 4
                ? "NORMAL VELOCITY"
                : "MODERATE VELOCITY"}
            </span>
          </div>

          <div className="text-[10.5px] text-ink-secondary font-sans mt-0.5">
            <strong>{sentiment.articles_analyzed}</strong> live stories captured{" "}
            {sentiment.volume_24h ? `(${sentiment.volume_24h} in past 24h)` : ""}
          </div>

          {/* Bar */}
          <div className="w-full bg-beige-300 h-2 rounded-full overflow-hidden flex my-2 shadow-inner">
            <div
              style={{ width: `${bullishPct}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
              title={`${bullishPct}% Bullish`}
            />
            <div
              style={{ width: `${neutralPct}%` }}
              className="bg-beige-400 h-full transition-all duration-500"
              title={`${neutralPct}% Neutral`}
            />
            <div
              style={{ width: `${bearishPct}%` }}
              className="bg-terracotta-500 h-full transition-all duration-500"
              title={`${bearishPct}% Bearish`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-ink-secondary">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <TrendingUp className="w-3 h-3" /> {sentiment.bullish_count} Bullish
            </span>
            <span className="flex items-center gap-1 text-ink-muted">
              <Minus className="w-3 h-3" /> {sentiment.neutral_count} Neutral
            </span>
            <span className="flex items-center gap-1 text-terracotta-700 font-semibold">
              <TrendingDown className="w-3 h-3" /> {sentiment.bearish_count} Bearish
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Headlines Stream */}
      {isExpanded && (
        <div>
          <div className="text-xs font-semibold text-ink-secondary mb-3 flex items-center justify-between">
            <span>Dynamic Feed: {sentiment.articles_analyzed} Breaking Stories Analyzed</span>
            <span className="text-[11px] text-ink-muted font-mono">
              Live Yahoo Finance & Google News stream
            </span>
          </div>

          <div className="space-y-2.5">
            {sentiment.articles.map((art, idx) => {
              const artBull = art.sentiment === "BULLISH";
              const artBear = art.sentiment === "BEARISH";

              return (
                <div
                  key={idx}
                  className="bg-beige-100/50 hover:bg-beige-100 p-3.5 rounded-2xl border border-beige-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs group"
                >
                  <div className="space-y-1 flex-1 pr-2">
                    <a
                      href={art.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-ink-primary hover:text-terracotta-600 transition flex items-center gap-1.5 leading-snug group-hover:underline"
                    >
                      <span>{art.title}</span>
                      <ExternalLink className="w-3 h-3 text-ink-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <div className="flex items-center gap-3 text-[10px] text-ink-muted font-mono">
                      <span className="font-semibold text-ink-secondary">{art.publisher}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-ink-muted" />
                        {art.published_at}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                        artBull
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : artBear
                          ? "bg-terracotta-50 text-terracotta-800 border-terracotta-300"
                          : "bg-beige-200 text-ink-secondary border-beige-300"
                      }`}
                    >
                      {artBull ? (
                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                      ) : artBear ? (
                        <TrendingDown className="w-3 h-3 text-terracotta-600" />
                      ) : (
                        <Minus className="w-3 h-3 text-ink-muted" />
                      )}
                      <span>
                        {art.score > 0 ? `+${art.score.toFixed(2)}` : art.score.toFixed(2)}{" "}
                        {art.sentiment}
                      </span>
                    </span>

                    <a
                      href={art.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-beige-200/90 hover:bg-beige-300 text-ink-primary hover:text-terracotta-700 text-[11px] font-mono font-semibold border border-beige-300 transition shadow-2xs"
                      title="Open full news story for verification"
                    >
                      <span>Read Story</span>
                      <ExternalLink className="w-3 h-3 text-terracotta-600 shrink-0" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-beige-200 flex items-center gap-2 text-[11px] text-ink-muted">
            <Sparkles className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
            <span>
              <strong>Quant Edge:</strong> On mega-cap assets with efficient pricing, pure technical momentum averages ~50% random walk. Real-time news sentiment injects external catalyst conviction to break the symmetry.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

