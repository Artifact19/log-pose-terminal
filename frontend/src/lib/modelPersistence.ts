import type { ModelVersion } from "../types";
import { generateMockActiveModel, toLocalDateStr } from "./mockEngine";

export function getStoredModels(ticker: string): ModelVersion[] {
  const t = ticker.toUpperCase();
  const key = `logpose_models_${t}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Automatically upgrade any legacy placeholder model that had the shared 2.14 MAE
        if (parsed.length === 1 && parsed[0].version_tag === "v20261108T180000Z") {
          const updatedInitial = generateMockActiveModel(t);
          localStorage.setItem(key, JSON.stringify([updatedInitial]));
          return [updatedInitial];
        }
        return parsed;
      }
    }
  } catch {}

  // Initialize with active baseline model version
  const initial = generateMockActiveModel(t);
  try {
    localStorage.setItem(key, JSON.stringify([initial]));
  } catch {}
  return [initial];
}

export function saveRetrainedModel(ticker: string, diff: any): ModelVersion {
  const t = ticker.toUpperCase();
  const models = getStoredModels(t);
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const vTag =
    diff?.new?.version_tag ||
    `v${toLocalDateStr(now).replace(/-/g, "")}T${timeStr}Z`;

  // Archive any currently active model
  const archived = models.map((m) => ({ ...m, is_active: false }));

  const newModel: ModelVersion = {
    id: Date.now(),
    ticker: t,
    version_tag: vTag,
    methodology_name: "XGBoostDirectMultiHorizon",
    trained_at: now.toISOString(),
    train_start_date: "2019-01-01",
    train_end_date: toLocalDateStr(now),
    horizon_days: 20,
    walk_forward_mae: diff?.new?.walk_forward_mae ?? 1.82,
    walk_forward_rmse: 0.028,
    directional_accuracy: diff?.new?.directional_accuracy ?? 0.564,
    empirical_coverage_80: diff?.new?.empirical_coverage_80 ?? 0.812,
    empirical_coverage_95: 0.954,
    mpiw_80_atr: 0.064,
    notebook_hash: Math.random().toString(36).substring(2, 12),
    artifact_path: `./artifacts/${t}/bundle.joblib`,
    is_active: true,
  };

  const updated = [newModel, ...archived];
  try {
    localStorage.setItem(`logpose_models_${t}`, JSON.stringify(updated));
  } catch {}

  return newModel;
}

