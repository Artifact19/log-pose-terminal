import { useState, useEffect, useRef } from "react";

export interface ForecastProgressState {
  progress: number;
  stage: string;
}

export function useForecastProgress(
  isLoading: boolean,
  isError: boolean = false,
  isSuccess: boolean = false
): ForecastProgressState {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const intervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    // If an error occurred or loading was cancelled, clear immediately
    if (isError) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setProgress(0);
      setStage("");
      return;
    }

    // When loading finishes (or success)
    if (!isLoading) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (isSuccess) {
        setProgress(100);
        setStage("Forecast finalized successfully!");
        timeoutRef.current = setTimeout(() => {
          setProgress(0);
          setStage("");
        }, 600);
      } else {
        setProgress(0);
        setStage("");
      }
      return;
    }

    // Loading started: reset and animate
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setProgress(10);
    setStage("Syncing market data & daily closes...");

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;

      if (elapsed < 400) {
        const p = Math.min(25, Math.round(10 + (elapsed / 400) * 15));
        setProgress(p);
        setStage("Syncing market data & daily closes...");
      } else if (elapsed < 1000) {
        const p = Math.min(55, Math.round(25 + ((elapsed - 400) / 600) * 30));
        setProgress(p);
        setStage("Extracting temporal features & momentum...");
      } else if (elapsed < 2000) {
        const p = Math.min(80, Math.round(55 + ((elapsed - 1000) / 1000) * 25));
        setProgress(p);
        setStage("Executing multi-horizon XGBoost models...");
      } else if (elapsed < 3200) {
        const p = Math.min(94, Math.round(80 + ((elapsed - 2000) / 1200) * 14));
        setProgress(p);
        setStage("Calibrating 80% & 95% conformal bounds...");
      } else {
        // Slow creep up to 98% while waiting for API
        setProgress((prev) => (prev < 98 ? prev + 1 : 98));
        setStage("Finalizing projection trajectory...");
      }
    }, 70);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoading, isError, isSuccess]);

  return { progress, stage };
}
