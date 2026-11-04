import React, { useState } from "react";
import Plot from "react-plotly.js";
import { Eye, EyeOff, BarChart2, LineChart } from "lucide-react";
import type { ForecastRunDetail, GhostRun, OHLCVBar } from "../types";

interface MasterChartProps {
  run: ForecastRunDetail;
  historyBars?: OHLCVBar[];
  ghostRuns?: GhostRun[];
  ghostCount: number;
  onSetGhostCount: (n: number) => void;
}

export const MasterChart: React.FC<MasterChartProps> = ({
  run,
  historyBars = [],
  ghostRuns = [],
  ghostCount,
}) => {
  const [showGhosts, setShowGhosts] = useState(true);
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");

  // Prepare History data (last 120 bars)
  const displayBars = historyBars.slice(-120);
  const histDates = displayBars.map((b) => b.date);
  const histOpens = displayBars.map((b) => b.open);
  const histHighs = displayBars.map((b) => b.high);
  const histLows = displayBars.map((b) => b.low);
  const histCloses = displayBars.map((b) => b.close);

  // Prepare Live Forecast Trajectory data
  const forecastDates = [run.anchor_date, ...run.points.map((p) => p.target_trading_date)];
  const forecastPrices = [run.anchor_close_price, ...run.points.map((p) => p.predicted_close)];
  const lower80 = [run.anchor_close_price, ...run.points.map((p) => p.lower_80)];
  const upper80 = [run.anchor_close_price, ...run.points.map((p) => p.upper_80)];
  const lower95 = [run.anchor_close_price, ...run.points.map((p) => p.lower_95)];
  const upper95 = [run.anchor_close_price, ...run.points.map((p) => p.upper_95)];

  const traces: any[] = [];

  // 1. Candlestick or Line Chart for Historical Prices
  if (chartType === "candlestick") {
    traces.push({
      type: "candlestick",
      name: `${run.ticker} Historical Price`,
      x: histDates,
      open: histOpens,
      high: histHighs,
      low: histLows,
      close: histCloses,
      increasing: { line: { color: "#1E824C", width: 1.2 }, fillcolor: "#1E824C" },
      decreasing: { line: { color: "#C84B31", width: 1.2 }, fillcolor: "#C84B31" },
      hoverlabel: { font: { family: "JetBrains Mono" } },
    });
  } else {
    traces.push({
      type: "scatter",
      mode: "lines",
      name: `${run.ticker} Close Price`,
      x: histDates,
      y: histCloses,
      line: { color: "#2D2825", width: 2 },
      hoverlabel: { font: { family: "JetBrains Mono" } },
    });
  }

  // 2. 95% Expected Range (Wider Range)
  traces.push({
    type: "scatter",
    mode: "lines",
    x: forecastDates,
    y: lower95,
    line: { color: "transparent" },
    showlegend: false,
    hoverinfo: "skip",
  });
  traces.push({
    type: "scatter",
    mode: "lines",
    name: "Wider Safety Range (95%)",
    x: forecastDates,
    y: upper95,
    fill: "tonexty",
    fillcolor: "rgba(200, 90, 50, 0.08)",
    line: { color: "rgba(200, 90, 50, 0.35)", dash: "dot", width: 1 },
    hoverinfo: "skip",
  });

  // 3. 80% Expected Range (Likely Range)
  traces.push({
    type: "scatter",
    mode: "lines",
    x: forecastDates,
    y: lower80,
    line: { color: "transparent" },
    showlegend: false,
    hoverinfo: "skip",
  });
  traces.push({
    type: "scatter",
    mode: "lines",
    name: "Likely Range (80%)",
    x: forecastDates,
    y: upper80,
    fill: "tonexty",
    fillcolor: "rgba(200, 90, 50, 0.20)",
    line: { color: "rgba(200, 90, 50, 0.55)", dash: "dot", width: 1.2 },
    hoverinfo: "skip",
  });

  // 4. Past Forecast History Overlay
  if (showGhosts && ghostRuns.length > 0) {
    ghostRuns.slice(0, ghostCount).forEach((g, gIdx) => {
      if (g.run_id === run.id) return; // Don't duplicate active run

      const gDates = [g.anchor_date, ...g.points.map((p) => p.target_trading_date)];
      const gPrices = [g.anchor_close_price, ...g.points.map((p) => p.predicted_close)];

      // Thin dotted historical forecast trajectory
      traces.push({
        type: "scatter",
        mode: "lines",
        name: `Forecast from ${g.anchor_date}`,
        x: gDates,
        y: gPrices,
        line: { color: "rgba(160, 140, 120, 0.5)", width: 1, dash: "dot" },
        showlegend: gIdx === 0,
        hoverinfo: "skip",
      });

      // Resolved Actuals on Past Forecasts
      const resolvedPts = g.points.filter((p) => p.actual_close !== null && p.actual_close !== undefined);
      if (resolvedPts.length > 0) {
        traces.push({
          type: "scatter",
          mode: "markers",
          name: "Verified Outcome (Hit/Miss)",
          x: resolvedPts.map((p) => p.target_trading_date),
          y: resolvedPts.map((p) => p.actual_close),
          marker: {
            size: 6,
            color: resolvedPts.map((p) => (p.inside_80_band ? "#1E824C" : "#C84B31")),
            symbol: resolvedPts.map((p) => (p.inside_80_band ? "circle" : "x")),
            line: { width: 1, color: "#FFFFFF" },
          },
          showlegend: gIdx === 0,
          hovertemplate: "Actual Close: $%{y:.2f}<br>Date: %{x}<extra></extra>",
        });
      }
    });
  }

  // 5. Main Forecast Path Line + Anchor Marker
  traces.push({
    type: "scatter",
    mode: "lines+markers",
    name: "Expected Price Path",
    x: forecastDates,
    y: forecastPrices,
    line: { color: "#C85A32", width: 2.5, dash: "dash" },
    marker: { size: [8, ...run.points.map(() => 5)], color: "#C85A32", symbol: "circle" },
    hovertemplate: "Expected Close: $%{y:.2f}<br>Date: %{x}<extra></extra>",
  });

  return (
    <div data-tour="master-chart" className="bg-beige-50 rounded-3xl border border-beige-300 p-5 shadow-tactile-card">
      {/* Top Chart Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-beige-200">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-ink-primary font-sans tracking-tight">
            {run.ticker} Price & Forecast Trajectory
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-lg bg-beige-200/70 font-mono text-ink-secondary border border-beige-300 shadow-2xs">
            Baseline Price: ${run.anchor_close_price.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Chart mode toggle (Sunken Tactile Well) */}
          <div className="flex items-center bg-beige-200/70 p-1 rounded-2xl border border-beige-300 shadow-tactile-well text-xs">
            <button
              onClick={() => setChartType("candlestick")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-medium transition-all cursor-pointer ${
                chartType === "candlestick"
                  ? "bg-white text-ink-primary shadow-tactile-btn border-t border-white border-b border-beige-300"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-terracotta-500" />
              Candles
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-medium transition-all cursor-pointer ${
                chartType === "line"
                  ? "bg-white text-ink-primary shadow-tactile-btn border-t border-white border-b border-beige-300"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              <LineChart className="w-3.5 h-3.5 text-terracotta-500" />
              Line
            </button>
          </div>

          {/* Past Forecasts toggle */}
          <button
            onClick={() => setShowGhosts(!showGhosts)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
              showGhosts
                ? "bg-gradient-to-r from-terracotta-500 to-terracotta-600 text-white shadow-clay-pill border-t border-white/30"
                : "tactile-pill text-ink-secondary hover:text-ink-primary"
            }`}
            title="Toggle previous historical forecasts to inspect accuracy over time"
          >
            {showGhosts ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Past Forecasts ({ghostCount})
          </button>
        </div>
      </div>

      {/* Plotly Chart Canvas */}
      <div className="w-full h-[450px] rounded-2xl overflow-hidden bg-[#FAF7F2] border border-beige-200/70 shadow-tactile-well p-1">
        <Plot
          data={traces}
          layout={{
            autosize: true,
            margin: { l: 20, r: 50, t: 15, b: 35 },
            plot_bgcolor: "#FAF7F2",
            paper_bgcolor: "#FAF7F2",
            font: { family: "Outfit, Plus Jakarta Sans, sans-serif", color: "#675B53", size: 11 },
            xaxis: {
              gridcolor: "#EBE2D6",
              linecolor: "#D8CCBF",
              showline: true,
              rangeslider: { visible: false },
              type: "date",
            },
            yaxis: {
              gridcolor: "#EBE2D6",
              linecolor: "#D8CCBF",
              showline: true,
              side: "right",
              tickprefix: "$",
            },
            legend: {
              orientation: "h",
              y: 1.08,
              x: 0,
              font: { size: 10 },
            },
            hovermode: "x unified",
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "100%" }}
          config={{ displayModeBar: false, responsive: true }}
        />
      </div>
    </div>
  );
};
