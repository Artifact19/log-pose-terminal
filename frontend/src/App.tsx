import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api/client";
import { Header } from "./components/Header";
import { TickerBar } from "./components/TickerBar";
import { MasterChart } from "./components/MasterChart";
import { ConfidencePanel } from "./components/ConfidencePanel";
import { ForecastTable } from "./components/ForecastTable";
import { LedgerTable } from "./components/LedgerTable";
import { StatsStrip } from "./components/StatsStrip";
import { ModelOpsPanel } from "./components/ModelOpsPanel";
import { FeatureTour } from "./components/FeatureTour";
import type { ForecastRunDetail } from "./types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function TerminalApp() {
  const [activeTab, setActiveTab] = useState<"terminal" | "ledger" | "models">("terminal");
  const [currentTicker, setCurrentTicker] = useState("AAPL");
  const [horizon, setHorizon] = useState(5);
  const [ghostCount, setGhostCount] = useState(10);
  const [selectedRun, setSelectedRun] = useState<ForecastRunDetail | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("logpose_tour_completed");
    if (!hasSeenTour) {
      setIsTourOpen(true);
    }
  }, []);

  const handleCloseTour = () => {
    localStorage.setItem("logpose_tour_completed", "true");
    setIsTourOpen(false);
  };

  const qc = useQueryClient();

  // Queries
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
    staleTime: 60000,
  });

  const { data: barsData, isLoading: barsLoading } = useQuery({
    queryKey: ["bars", currentTicker],
    queryFn: () => api.getMarketBars(currentTicker, 250),
    staleTime: 30000,
  });

  const { data: ghostRuns } = useQuery({
    queryKey: ["ghosts", currentTicker, ghostCount],
    queryFn: () => api.getGhostRuns(currentTicker, ghostCount),
    staleTime: 30000,
  });

  const { data: ledgerRuns = [], refetch: refetchLedger } = useQuery({
    queryKey: ["ledger", currentTicker],
    queryFn: () => api.getLedgerRuns(currentTicker, undefined, 50),
    staleTime: 10000,
  });

  const { data: ledgerStats } = useQuery({
    queryKey: ["ledgerStats", currentTicker],
    queryFn: () => api.getLedgerStats(currentTicker, 30),
    staleTime: 15000,
  });

  const { data: activeModel, refetch: refetchActiveModel } = useQuery({
    queryKey: ["activeModel", currentTicker],
    queryFn: () => api.getActiveModel(currentTicker),
    retry: false,
  });

  const { data: allModels = [], refetch: refetchAllModels } = useQuery({
    queryKey: ["allModels", currentTicker],
    queryFn: () => api.getModels(currentTicker),
  });

  // Active run: either user selected or latest run for ticker
  const activeRun =
    selectedRun && selectedRun.ticker === currentTicker
      ? selectedRun
      : ledgerRuns.find((r) => r.ticker === currentTicker) || null;

  // Run Forecast Mutation
  const forecastMutation = useMutation({
    mutationFn: () => api.createForecast(currentTicker, horizon, undefined, true),
    onSuccess: (newRun) => {
      setSelectedRun(newRun);
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["ghosts"] });
      qc.invalidateQueries({ queryKey: ["ledgerStats"] });
    },
  });

  // Reconcile Mutation
  const reconcileMutation = useMutation({
    mutationFn: () => api.triggerReconcile(currentTicker),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["ledgerStats"] });
      qc.invalidateQueries({ queryKey: ["ghosts"] });
    },
  });

  // Retrain Mutation
  const [retrainStage, setRetrainStage] = useState<string>("");
  const [retrainDiff, setRetrainDiff] = useState<any>(null);

  const retrainMutation = useMutation({
    mutationFn: (force: boolean) => api.triggerRetrain(currentTicker, force),
    onMutate: () => {
      setRetrainStage("FETCHING_DATA");
      setRetrainDiff(null);
    },
    onSuccess: (res) => {
      setRetrainDiff(res);
      setRetrainStage("DONE");
      refetchActiveModel();
      refetchAllModels();
      qc.invalidateQueries({ queryKey: ["activeModel"] });
      qc.invalidateQueries({ queryKey: ["allModels"] });
    },
    onError: (err: any) => {
      setRetrainStage("FAILED");
      alert(`Retraining error: ${err.message}`);
    },
  });

  const handleViewOnChart = (runToView: ForecastRunDetail) => {
    setCurrentTicker(runToView.ticker);
    setSelectedRun(runToView);
    setActiveTab("terminal");
  };

  return (
    <div className="min-h-screen bg-clay-canvas flex flex-col font-sans selection:bg-terracotta-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        onOpenTour={() => setIsTourOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Ticker Toolbar */}
        <TickerBar
          currentTicker={currentTicker}
          onSelectTicker={(t) => {
            setCurrentTicker(t);
            setSelectedRun(null);
          }}
          horizon={horizon}
          onSelectHorizon={setHorizon}
          onRunForecast={() => forecastMutation.mutate()}
          isLoading={forecastMutation.isPending}
          lastBarDate={barsData?.last_bar_date}
          isStale={barsData?.is_stale}
        />

        {/* Tab 1: Terminal View */}
        {activeTab === "terminal" && (
          <div>
            {forecastMutation.isError && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-mono">
                Error running forecast: {forecastMutation.error?.message}
              </div>
            )}

            {activeRun ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Master Chart Canvas */}
                  <div className="lg:col-span-2">
                    <MasterChart
                      run={activeRun}
                      historyBars={barsData?.bars || []}
                      ghostRuns={ghostRuns || []}
                      ghostCount={ghostCount}
                      onSetGhostCount={setGhostCount}
                    />
                  </div>

                  {/* Confidence Gauge & Guard Panel */}
                  <div className="lg:col-span-1">
                    <ConfidencePanel run={activeRun} />
                  </div>
                </div>

                {/* Step Projection Table */}
                <ForecastTable points={activeRun.points} ticker={activeRun.ticker} />
              </>
            ) : (
              <div className="bg-clay-card rounded-3xl border border-clay-border p-12 text-center shadow-tactile-card">
                <img
                  src="/cat-logo.jpg"
                  alt="Log Pose Logo"
                  className="w-20 h-20 mx-auto rounded-3xl border-2 border-beige-300 shadow-tactile-knob mb-4 object-cover"
                />
                <h3 className="text-base font-bold text-ink-primary font-mono mb-1">
                  Ready to Forecast {currentTicker}
                </h3>
                <p className="text-xs text-ink-secondary mb-5 max-w-md mx-auto">
                  Click &ldquo;Generate Forecast&rdquo; above to project expected prices and statistical
                  probability ranges for upcoming trading sessions.
                </p>
                <button
                  onClick={() => forecastMutation.mutate()}
                  disabled={forecastMutation.isPending}
                  className="console-glow-button px-6 py-2.5 rounded-2xl text-white font-mono text-xs font-semibold cursor-pointer"
                >
                  {forecastMutation.isPending ? "Generating..." : `Generate ${horizon}-Day Forecast`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Audit Ledger */}
        {activeTab === "ledger" && (
          <div>
            <StatsStrip stats={ledgerStats} />
            <LedgerTable
              runs={ledgerRuns}
              onReconcile={() => reconcileMutation.mutate()}
              isReconciling={reconcileMutation.isPending}
              onViewOnChart={handleViewOnChart}
            />
          </div>
        )}

        {/* Tab 3: Model Operations */}
        {activeTab === "models" && (
          <div>
            <ModelOpsPanel
              ticker={currentTicker}
              activeModel={activeModel}
              allModels={allModels}
              onTriggerRetrain={(force) => retrainMutation.mutate(force)}
              isRetraining={retrainMutation.isPending}
              retrainStage={retrainStage}
              retrainDiff={retrainDiff}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-beige-50/90 border-t border-beige-300 py-5 px-6 mt-12 text-center text-[11px] text-ink-muted font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Log Pose Terminal &middot; Verifiable Market Intelligence &middot; Strictly Causal Data Pipeline</span>
          <span>Log Pose Terminal is for research and forward-testing purposes only. Not financial advice.</span>
        </div>
      </footer>

      {/* Guided Feature Tour */}
      <FeatureTour isOpen={isTourOpen} onClose={handleCloseTour} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TerminalApp />
    </QueryClientProvider>
  );
}

