import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, wakeUpServer, subscribeBackendState, getBackendState } from "./api/client";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Header } from "./components/Header";
import { TickerBar } from "./components/TickerBar";
import { TickerSelectionHub } from "./components/TickerSelectionHub";
import { MasterChart } from "./components/MasterChart";
import { ConfidencePanel } from "./components/ConfidencePanel";
import { ForecastTable } from "./components/ForecastTable";
import { SentimentPulsePanel } from "./components/SentimentPulsePanel";
import { LedgerTable } from "./components/LedgerTable";
import { StatsStrip } from "./components/StatsStrip";
import { ModelOpsPanel } from "./components/ModelOpsPanel";
import { FeatureTour } from "./components/FeatureTour";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthModal } from "./components/AuthModal";
import { Analytics } from "@vercel/analytics/react";
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
  const [currentTicker, setCurrentTicker] = useState<string | null>(null);
  const [horizon, setHorizon] = useState(5);
  const [ghostCount, setGhostCount] = useState(10);
  const [selectedRun, setSelectedRun] = useState<ForecastRunDetail | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [forecastGeneratedInSession, setForecastGeneratedInSession] = useState(false);
  const [backendState, setBackendState] = useState(getBackendState());
  const { shouldLaunchTour, resetTourLaunch, isAdmin } = useAuth();

  useEffect(() => {
    wakeUpServer();
    const unsub = subscribeBackendState(setBackendState);
    return unsub;
  }, []);

  // Show tour ONLY when someone signs up for the first time
  useEffect(() => {
    if (shouldLaunchTour) {
      setIsTourOpen(true);
      resetTourLaunch();
    }
  }, [shouldLaunchTour, resetTourLaunch]);

  const handleCloseTour = () => {
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
    queryFn: () => (currentTicker ? api.getMarketBars(currentTicker, 250) : Promise.resolve(null)),
    enabled: !!currentTicker,
    staleTime: 30000,
  });

  const { data: ghostRuns } = useQuery({
    queryKey: ["ghosts", currentTicker, ghostCount],
    queryFn: () => (currentTicker ? api.getGhostRuns(currentTicker, ghostCount) : Promise.resolve([])),
    enabled: !!currentTicker,
    staleTime: 30000,
  });

  const { data: ledgerRuns = [], refetch: refetchLedger } = useQuery({
    queryKey: ["ledger", currentTicker || "ALL"],
    queryFn: () => api.getLedgerRuns(currentTicker || undefined, undefined, 50),
    staleTime: 10000,
  });

  const { data: ledgerStats } = useQuery({
    queryKey: ["ledgerStats", currentTicker || "ALL"],
    queryFn: () => api.getLedgerStats(currentTicker || undefined, 30),
    staleTime: 15000,
  });

  const { data: activeModel, refetch: refetchActiveModel } = useQuery({
    queryKey: ["activeModel", currentTicker],
    queryFn: () => (currentTicker ? api.getActiveModel(currentTicker) : Promise.resolve(null)),
    enabled: !!currentTicker,
    retry: false,
  });

  const { data: allModels = [], refetch: refetchAllModels } = useQuery({
    queryKey: ["allModels", currentTicker],
    queryFn: () => (currentTicker ? api.getModels(currentTicker) : Promise.resolve([])),
    enabled: !!currentTicker,
  });

  const {
    data: sentimentData,
    isLoading: sentimentLoading,
    isFetching: sentimentFetching,
    refetch: refetchSentiment,
  } = useQuery({
    queryKey: ["sentiment", currentTicker],
    queryFn: () => (currentTicker ? api.getSentiment(currentTicker) : Promise.resolve(null)),
    enabled: !!currentTicker,
    staleTime: 45000,
  });

  // Active run: either user selected or latest run for ticker
  const activeRun =
    selectedRun && (!currentTicker || selectedRun.ticker === currentTicker)
      ? selectedRun
      : currentTicker
      ? (Array.isArray(ledgerRuns) ? ledgerRuns.find((r) => r && r.ticker === currentTicker) : null) || null
      : null;

  // Run Forecast Mutation
  const forecastMutation = useMutation({
    mutationFn: () => {
      const t = currentTicker || "AAPL";
      const sentimentScore = sentimentData?.score;
      return api.createForecast(t, horizon, undefined, true, sentimentScore);
    },
    onSuccess: (newRun) => {
      setCurrentTicker(newRun.ticker);
      setSelectedRun(newRun);
      setForecastGeneratedInSession(true);

      // Immediately write newRun with all its points directly into the ledger cache so it appears instantly
      qc.setQueriesData<ForecastRunDetail[]>({ queryKey: ["ledger"] }, (old = []) => {
        const list = Array.isArray(old) ? old : [];
        const filtered = list.filter((r) => r.id !== newRun.id);
        return [newRun, ...filtered];
      });

      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["ghosts"] });
      qc.invalidateQueries({ queryKey: ["ledgerStats"] });
    },
  });

  // Reconcile Mutation
  const reconcileMutation = useMutation({
    mutationFn: () => api.triggerReconcile(currentTicker || undefined),
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
    mutationFn: (force: boolean) => api.triggerRetrain(currentTicker || "AAPL", force),
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

      {/* Cold start waking banner */}
      {backendState.isWakingUp && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-900 flex items-center justify-center gap-2 font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
          <span>Waking up forecasting server… (Render free tier instance is spinning up, this may take 30–60s)</span>
        </div>
      )}

      {/* Demo mode banner */}
      {backendState.isDemoMode && !backendState.isWakingUp && (
        <div className="bg-terracotta-500/10 border-b border-terracotta-500/25 px-4 py-2 text-center text-xs text-terracotta-800 font-mono font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-terracotta-600 shrink-0" />
          <span>Demo mode: backend unreachable — forecasts are simulated, not from the model</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Ticker Toolbar */}
        <TickerBar
          currentTicker={currentTicker}
          onSelectTicker={(t) => {
            setCurrentTicker(t);
            setSelectedRun(null);
          }}
          onClearTicker={() => {
            setCurrentTicker(null);
            setSelectedRun(null);
          }}
          horizon={horizon}
          onSelectHorizon={setHorizon}
          onRunForecast={() => {
            if (!currentTicker) {
              setCurrentTicker("AAPL");
            }
            forecastMutation.mutate();
          }}
          isLoading={forecastMutation.isPending}
          isError={forecastMutation.isError}
          isSuccess={forecastMutation.isSuccess}
          lastBarDate={barsData?.last_bar_date}
          isStale={barsData?.is_stale}
        />

        {/* Tab 1: Terminal View */}
        {activeTab === "terminal" && (
          <div>
            {!currentTicker ? (
              <TickerSelectionHub
                onSelectTicker={(t) => {
                  setCurrentTicker(t);
                  setSelectedRun(null);
                }}
                recentRuns={ledgerRuns}
                onViewOnChart={handleViewOnChart}
              />
            ) : (
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

                    {/* Market Pulse & NLP Sentiment Stream */}
                    <SentimentPulsePanel
                      sentiment={sentimentData || null}
                      isLoading={sentimentLoading}
                      isFetching={sentimentFetching}
                      onRefresh={() => refetchSentiment()}
                      ticker={currentTicker || "AAPL"}
                      directionalAccuracy={activeModel?.directional_accuracy}
                    />
                  </>
                ) : (
                  <div className="space-y-6">
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

                    {/* Show sentiment pulse even before first forecast generation */}
                    <SentimentPulsePanel
                      sentiment={sentimentData || null}
                      isLoading={sentimentLoading}
                      isFetching={sentimentFetching}
                      onRefresh={() => refetchSentiment()}
                      ticker={currentTicker || "AAPL"}
                      directionalAccuracy={activeModel?.directional_accuracy}
                    />
                  </div>
                )}
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
            {!currentTicker ? (
              <div className="bg-clay-card rounded-3xl border border-clay-border p-8 text-center shadow-tactile-card">
                <h3 className="text-base font-bold text-ink-primary font-mono mb-2">
                  Select a Stock Ticker to Inspect Model Status & Operations
                </h3>
                <p className="text-xs text-ink-secondary mb-5 max-w-md mx-auto">
                  Model training artifacts and walk-forward validation folds are managed per ticker.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["AAPL", "NVDA", "MSFT", "SPY", "RELIANCE.NS", "TCS.NS"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setCurrentTicker(t)}
                      className="tactile-pill px-4 py-2 rounded-xl text-xs font-mono font-bold text-ink-primary hover:text-terracotta-700 transition-colors"
                    >
                      Inspect {t} Model &rarr;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ModelOpsPanel
                ticker={currentTicker}
                activeModel={activeModel || undefined}
                allModels={allModels}
                onTriggerRetrain={(force) => retrainMutation.mutate(force)}
                isRetraining={retrainMutation.isPending}
                retrainStage={retrainStage}
                retrainDiff={retrainDiff}
              />
            )}
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
      <FeatureTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={isAdmin}
        onRunForecast={() => forecastMutation.mutate()}
        isForecastLoading={forecastMutation.isPending}
        isForecastError={forecastMutation.isError}
        isForecastSuccess={forecastMutation.isSuccess}
        hasForecast={forecastGeneratedInSession || Boolean(activeRun)}
      />

      {/* Supabase Authentication & Profile Modal */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TerminalApp />
        <Analytics />
      </AuthProvider>
    </QueryClientProvider>
  );
}

