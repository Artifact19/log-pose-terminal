export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketBarsResponse {
  ticker: string;
  bars: OHLCVBar[];
  last_bar_date?: string;
  is_stale: boolean;
}

export interface ForecastPointDetail {
  id?: number;
  step_ahead: number;
  target_trading_date: string;
  predicted_return: number;
  predicted_close: number;
  lower_80: number;
  upper_80: number;
  lower_95: number;
  upper_95: number;
  actual_close?: number | null;
  actual_return?: number | null;
  abs_error?: number | null;
  pct_error?: number | null;
  direction_correct?: boolean | null;
  inside_80_band?: boolean | null;
  inside_95_band?: boolean | null;
  resolved_at?: string | null;
}

export interface ForecastRunDetail {
  id: string;
  ticker: string;
  model_version_id: number;
  created_at: string;
  anchor_date: string;
  anchor_close_price: number;
  horizon_days: number;
  confidence_score: number;
  regime_status: "NORMAL" | "ELEVATED_VOL" | "OOD_WARNING";
  confidence_metadata: {
    directional_accuracy?: number;
    picp_80?: number;
    picp_95?: number;
    mpiw_80_atr?: number;
    regime_vol_z?: number;
    ood_max_abs_z?: number;
    ood_features?: string[];
    component_scores?: {
      accuracy: number;
      calibration: number;
      tightness: number;
      regime: number;
    };
    weights?: {
      accuracy: number;
      calibration: number;
      tightness: number;
      regime: number;
    };
    date_realignments?: Array<{ step: number; projected: string; observed: string }>;
    backdate_model_leak_risk?: boolean;
    [key: string]: any;
  };
  resolution_status: "PENDING" | "PARTIALLY_RESOLVED" | "RESOLVED";
  is_seeded_demo: boolean;
  points: ForecastPointDetail[];
  history_bars?: OHLCVBar[];
}

export interface GhostRunPoint {
  step_ahead: number;
  target_trading_date: string;
  predicted_close: number;
  lower_80: number;
  upper_80: number;
  actual_close?: number | null;
  inside_80_band?: boolean | null;
}

export interface GhostRun {
  run_id: string;
  anchor_date: string;
  anchor_close_price: number;
  points: GhostRunPoint[];
}

export interface LedgerStats {
  ticker?: string;
  window_days: number;
  resolved_count: number;
  mae_pct: number;
  directional_accuracy: number;
  coverage_80: number;
  coverage_95: number;
}

export interface ModelVersion {
  id?: number;
  ticker: string;
  version_tag: string;
  methodology_name: string;
  trained_at: string;
  train_start_date: string;
  train_end_date: string;
  horizon_days: number;
  walk_forward_mae: number;
  walk_forward_rmse: number;
  directional_accuracy: number;
  empirical_coverage_80: number;
  empirical_coverage_95?: number | null;
  mpiw_80_atr?: number | null;
  artifact_path: string;
  notebook_hash: string;
  metrics_json?: any;
  is_active: boolean;
}

export interface HealthResponse {
  status: string;
  db_backend: string;
  ml_exports_in_sync: boolean;
  methodology_name: string;
  disclaimer: string;
}

export interface RetrainStatus {
  job_id: string;
  ticker: string;
  stage: string;
  progress_fold?: number;
  total_folds?: number;
  diff?: {
    retrained: boolean;
    activated: boolean;
    activation_reason: string;
    new_version_tag: string;
    old?: Record<string, number>;
    new?: Record<string, number>;
    delta?: Record<string, number>;
    reason?: string;
  };
  error?: string;
}

