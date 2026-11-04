import React from "react";

interface ConfidenceGaugeProps {
  score: number; // 0 - 100
  regime: "NORMAL" | "ELEVATED_VOL" | "OOD_WARNING";
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({ score, regime }) => {
  const clampedScore = Math.min(100, Math.max(0, score));

  // Determine color scheme
  let colorClass = "#1E824C"; // Green (>65)
  let bgTint = "bg-emerald-50 text-emerald-800 border-emerald-200";
  let regimeLabel = "Normal Market Conditions";

  if (clampedScore < 40) {
    colorClass = "#C84B31"; // Terracotta Red (<40)
    bgTint = "bg-red-50 text-red-800 border-red-200";
  } else if (clampedScore <= 65) {
    colorClass = "#D97706"; // Amber (40-65)
    bgTint = "bg-amber-50 text-amber-800 border-amber-200";
  }

  if (regime === "ELEVATED_VOL") {
    regimeLabel = "High Market Volatility";
    bgTint = "bg-amber-50 text-amber-800 border-amber-200";
  } else if (regime === "OOD_WARNING") {
    regimeLabel = "Unusual Market Shift";
    bgTint = "bg-red-50 text-red-800 border-red-200";
  }

  // SVG Gauge Calculations
  const radius = 70;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // Half-circle
  const strokeDashoffset = circumference * (1 - clampedScore / 100);

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-44 h-24 flex items-center justify-center">
        <svg viewBox="0 0 160 90" className="w-full h-full overflow-visible">
          {/* Background Track */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="#EFE6D9"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Value Arc */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke={colorClass}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute bottom-0 text-center">
          <div className="text-3xl font-bold font-mono tracking-tight text-ink-primary">
            {score.toFixed(1)}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Confidence / 100
          </div>
        </div>
      </div>

      {/* Regime badge */}
      <div className="mt-2">
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${bgTint}`}>
          {regimeLabel}
        </span>
      </div>
    </div>
  );
};
