import React from "react";
import {
  TrendingUp,
  Clock,
  ArrowRight,
  History,
  Sparkles,
  Globe,
  Activity,
  Layers,
  ChevronRight,
} from "lucide-react";
import { fmtDate, fmtPrice, getMarketInfo } from "../lib/fmt";
import { useExchangeClock } from "../lib/useExchangeClock";
import type { ForecastRunDetail } from "../types";

interface TickerSelectionHubProps {
  onSelectTicker: (ticker: string) => void;
  recentRuns: ForecastRunDetail[];
  onViewOnChart: (run: ForecastRunDetail) => void;
}

interface AssetDef {
  ticker: string;
  name: string;
  exchange: string;
  region: string;
  flag: string;
  price: number;
  tz: "ET" | "IST";
  desc: string;
}

const FEATURED_ASSETS: AssetDef[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NasdaqGS",
    region: "United States",
    flag: "🇺🇸",
    price: 342.37,
    tz: "ET",
    desc: "Consumer tech, silicon hardware, services & AI ecosystems.",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NasdaqGS",
    region: "United States",
    flag: "🇺🇸",
    price: 186.64,
    tz: "ET",
    desc: "GPU accelerated computing, datacenter AI & Hopper architecture.",
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NasdaqGS",
    region: "United States",
    flag: "🇺🇸",
    price: 530.61,
    tz: "ET",
    desc: "Cloud infrastructure, enterprise productivity & generative AI.",
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    exchange: "NYSE Arca",
    region: "United States",
    flag: "🇺🇸",
    price: 735.29,
    tz: "ET",
    desc: "Benchmark index tracking 500 leading US publicly traded equities.",
  },
  {
    ticker: "RELIANCE.NS",
    name: "Reliance Industries Ltd.",
    exchange: "NSE India",
    region: "India",
    flag: "🇮🇳",
    price: 1324.4,
    tz: "IST",
    desc: "Energy, telecommunications (Jio), retail & digital services conglomerate.",
  },
  {
    ticker: "TCS.NS",
    name: "Tata Consultancy Services",
    exchange: "NSE India",
    region: "India",
    flag: "🇮🇳",
    price: 2475.4,
    tz: "IST",
    desc: "Global leader in IT consulting, enterprise cloud transformation & digital solutions.",
  },
];

const AssetCard: React.FC<{
  asset: AssetDef;
  onSelect: (t: string) => void;
  runCount: number;
}> = ({ asset, onSelect, runCount }) => {
  const clock = useExchangeClock(asset.tz);

  return (
    <div
      onClick={() => onSelect(asset.ticker)}
      className="bg-beige-50 hover:bg-white rounded-3xl border border-beige-300 p-5 shadow-tactile-card hover:shadow-tactile-card-hover hover:border-terracotta-400 transition-all cursor-pointer flex flex-col justify-between group"
    >
      <div>
        {/* Top Header: Flag + Symbol + Exchange Badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl select-none" role="img" aria-label={asset.region}>
              {asset.flag}
            </span>
            <span className="text-base font-bold text-ink-primary font-mono group-hover:text-terracotta-700 transition-colors">
              {asset.ticker}
            </span>
          </div>

          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-beige-200/80 text-ink-secondary border border-beige-300">
            {asset.exchange}
          </span>
        </div>

        {/* Company Name & Description */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-ink-primary font-sans mb-1">
            {asset.name}
          </h4>
          <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2">
            {asset.desc}
          </p>
        </div>
      </div>

      <div>
        {/* Market Status + Clock */}
        <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted pb-3 mb-3 border-b border-beige-200">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-terracotta-500" />
            <span>{clock.timeStr} {asset.tz}</span>
          </div>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              clock.status === "OPEN"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : clock.status === "PRE_MARKET"
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "bg-beige-200 text-ink-muted border border-beige-300"
            }`}
          >
            {clock.status === "OPEN"
              ? "Market Open"
              : clock.status === "PRE_MARKET"
              ? "Pre-Market"
              : "Market Closed"}
          </span>
        </div>

        {/* Price + Action Button */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-ink-muted font-mono block">Current Close</span>
            <span className="text-base font-extrabold text-ink-primary font-mono tracking-tight">
              {fmtPrice(asset.price, asset.ticker)}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(asset.ticker);
            }}
            className="tactile-pill flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-terracotta-700 group-hover:bg-terracotta-600 group-hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <span>Forecast</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {runCount > 0 && (
          <div className="mt-3 pt-2 border-t border-beige-200/60 flex items-center gap-1.5 text-[10px] font-mono text-emerald-800">
            <Activity className="w-3 h-3 text-emerald-600" />
            <span>{runCount} forecast{runCount > 1 ? "s" : ""} generated in your ledger</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const TickerSelectionHub: React.FC<TickerSelectionHubProps> = ({
  onSelectTicker,
  recentRuns,
  onViewOnChart,
}) => {
  // Count how many runs the user has per ticker
  const runCountsByTicker: Record<string, number> = {};
  (Array.isArray(recentRuns) ? recentRuns : []).forEach((r) => {
    if (r?.ticker) {
      const t = r.ticker.toUpperCase();
      runCountsByTicker[t] = (runCountsByTicker[t] || 0) + 1;
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Welcome & Asset Selector Header */}
      <div className="bg-clay-card rounded-3xl border border-clay-border p-6 sm:p-8 shadow-tactile-card">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-beige-200/80 border border-beige-300 text-ink-secondary text-xs font-mono mb-3 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-terracotta-600" />
            <span>Market Intelligence Hub &middot; Choose an Asset</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-ink-primary font-mono tracking-tight mb-2">
            Select a Stock Ticker to Forecast
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Choose from major US equities (NYSE/NASDAQ) or Indian benchmarks (NSE), or search any custom ticker.
            The engine runs multi-horizon calibrated quantile models with verifiable prediction bands.
          </p>
        </div>

        {/* Assets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-6">
          {FEATURED_ASSETS.map((asset) => (
            <AssetCard
              key={asset.ticker}
              asset={asset}
              onSelect={onSelectTicker}
              runCount={runCountsByTicker[asset.ticker] || 0}
            />
          ))}
        </div>
      </div>

      {/* 2. User Forecast History Section */}
      <div className="bg-clay-card rounded-3xl border border-clay-border p-6 sm:p-8 shadow-tactile-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-beige-300 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-beige-200 border border-beige-300 text-terracotta-600 shadow-tactile-knob">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-primary font-mono">
                Your Recent Forecast History
              </h3>
              <p className="text-[11px] text-ink-muted font-mono">
                {recentRuns.length > 0
                  ? `${recentRuns.length} forecast${recentRuns.length > 1 ? "s" : ""} recorded across your sessions`
                  : "Audit ledger of forecasts created in this terminal"}
              </p>
            </div>
          </div>

          {recentRuns.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-ink-secondary px-3 py-1 rounded-xl bg-beige-200/80 border border-beige-300">
                {Object.keys(runCountsByTicker).length} Asset{Object.keys(runCountsByTicker).length > 1 ? "s" : ""} Tracked
              </span>
            </div>
          )}
        </div>

        {recentRuns.length === 0 ? (
          <div className="py-10 text-center rounded-2xl bg-beige-100/40 border border-beige-200/80 p-6">
            <Layers className="w-10 h-10 text-ink-muted mx-auto mb-3 opacity-60" />
            <h4 className="text-xs font-bold text-ink-primary font-mono mb-1">
              No Forecasts Generated Yet
            </h4>
            <p className="text-[11px] text-ink-muted max-w-md mx-auto mb-4">
              Select any ticker from the cards above to generate your first 3 to 20-day projection.
              Every forecast is logged here immutably for performance verification.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {FEATURED_ASSETS.slice(0, 4).map((a) => (
                <button
                  key={a.ticker}
                  onClick={() => onSelectTicker(a.ticker)}
                  className="tactile-pill px-3 py-1 rounded-xl text-xs font-mono text-ink-primary hover:text-terracotta-700 transition-colors"
                >
                  Start with {a.ticker} &rarr;
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-beige-100/40 border border-beige-200/90 shadow-inner p-1">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-beige-300 text-[11px] text-ink-muted uppercase tracking-wider">
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Date Generated</th>
                  <th className="py-2.5 px-3">Anchor Close Price</th>
                  <th className="py-2.5 px-3">Horizon</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Verification</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige-200">
                {recentRuns.slice(0, 8).map((r) => {
                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-beige-200 text-ink-muted border border-beige-300">
                      AWAITING CLOSE
                    </span>
                  );
                  if (r.resolution_status === "RESOLVED") {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        VERIFIED
                      </span>
                    );
                  } else if (r.resolution_status === "PARTIALLY_RESOLVED") {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        PARTIAL
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={r.id}
                      onClick={() => onViewOnChart(r)}
                      className="hover:bg-beige-50/90 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-ink-primary">
                        {r.ticker}
                      </td>
                      <td className="py-3 px-3 text-ink-secondary">
                        {fmtDate(r.created_at)}
                      </td>
                      <td className="py-3 px-3 text-ink-primary font-semibold">
                        {fmtPrice(r.anchor_close_price, r.ticker)}
                      </td>
                      <td className="py-3 px-3 text-ink-secondary">
                        {r.horizon_days} Days
                      </td>
                      <td className="py-3 px-3 font-semibold text-ink-primary">
                        {r.confidence_score !== undefined && r.confidence_score !== null
                          ? `${r.confidence_score.toFixed(1)}/100`
                          : "—"}
                      </td>
                      <td className="py-3 px-3">{statusBadge}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewOnChart(r);
                          }}
                          className="tactile-pill inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-mono font-medium text-terracotta-700 hover:text-terracotta-800 transition-colors"
                        >
                          <span>Open on Chart</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

