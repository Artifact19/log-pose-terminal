import { useState, useEffect } from "react";

export interface ForecastProgressState {
  progress: number;
  stage: string;
}

export function useForecastProgress(isLoading: boolean): ForecastProgressState {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");

  useEffect(() => {
    if (!isLoading) {
      if (progress > 0) {
        setProgress(100);
        setStage("Finalizing projection trajectory...");
        const timer = setTimeout(() => {
          setProgress(0);
          setStage("");
        }, 500);
        return () => clearTimeout(timer);
      }
      return;
    }

    // Reset and initialize when loading begins
    setProgress(8);
    setStage("Syncing latest market settlement closes...");

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      if (elapsed < 400) {
        // Phase 1: Data sync (8% - 25%)
        const p = Math.min(25, Math.round(8 + (elapsed / 400) * 17));
        setProgress(p);
        setStage("Syncing latest market settlement closes...");
      } else if (elapsed < 900) {
        // Phase 2: Feature Engineering (25% - 55%)
        const p = Math.min(55, Math.round(25 + ((elapsed - 400) / 500) * 30));
        setProgress(p);
        setStage("Computing temporal features & rolling regimes...");
      } else if (elapsed < 1600) {
        // Phase 3: XGBoost Multi-Horizon Models (55% - 80%)
        const p = Math.min(80, Math.round(55 + ((elapsed - 900) / 700) * 25));
        setProgress(p);
        setStage("Executing multi-horizon XGBoost models...");
      } else if (elapsed < 2400) {
        // Phase 4: Conformal Calibration (80% - 94%)
        const p = Math.min(94, Math.round(80 + ((elapsed - 1600) / 800) * 14));
        setProgress(p);
        setStage("Calibrating 80% & 95% conformal bounds...");
      } else {
        // Phase 5: Asymptotic creep to 97% until response resolves
        setProgress((prev) => Math.min(97, prev + 1));
        setStage("Finalizing projection trajectory...");
      }
    }, 60);

    return () => clearInterval(interval);
  }, [isLoading]);

  return { progress, stage };
}
