import { useState, useEffect } from "react";

export interface ExchangeClockState {
  timeStr: string;
  status: "OPEN" | "CLOSED" | "PRE_MARKET" | "AFTER_HOURS";
  statusText: string;
}

export function getExchangeCurrentTime(timezone: string): ExchangeClockState {
  const isET = timezone === "ET";
  const tz = isET ? "America/New_York" : "Asia/Kolkata";
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekday = getPart("weekday");
  const hour = parseInt(getPart("hour"), 10);
  const min = parseInt(getPart("minute"), 10);
  const sec = getPart("second");

  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const timeStr = `${displayHour}:${min.toString().padStart(2, "0")}:${sec} ${ampm} ${timezone}`;

  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (isWeekend) {
    return { timeStr, status: "CLOSED", statusText: "Weekend Closed" };
  }

  const timeDec = hour + min / 60;

  if (isET) {
    // US Market (NYSE/NASDAQ)
    // Regular: 9:30 - 16:00 ET
    // Pre-Market: 4:00 - 9:30 ET
    // After-Hours: 16:00 - 20:00 ET
    if (timeDec >= 9.5 && timeDec < 16.0) {
      return { timeStr, status: "OPEN", statusText: "Market Open" };
    } else if (timeDec >= 4.0 && timeDec < 9.5) {
      return { timeStr, status: "PRE_MARKET", statusText: "Pre-Market" };
    } else if (timeDec >= 16.0 && timeDec < 20.0) {
      return { timeStr, status: "AFTER_HOURS", statusText: "After-Hours" };
    } else {
      return { timeStr, status: "CLOSED", statusText: "Market Closed" };
    }
  } else {
    // Indian Market (NSE/BSE)
    // Regular: 9:15 - 15:30 IST
    // Pre-Market: 9:00 - 9:15 IST
    if (timeDec >= 9.25 && timeDec < 15.5) {
      return { timeStr, status: "OPEN", statusText: "Market Open" };
    } else if (timeDec >= 9.0 && timeDec < 9.25) {
      return { timeStr, status: "PRE_MARKET", statusText: "Pre-Market" };
    } else {
      return { timeStr, status: "CLOSED", statusText: "Market Closed" };
    }
  }
}

export function useExchangeClock(timezone: string): ExchangeClockState {
  const [clock, setClock] = useState<ExchangeClockState>(() => getExchangeCurrentTime(timezone));

  useEffect(() => {
    // Immediately compute on timezone switch
    setClock(getExchangeCurrentTime(timezone));

    const intervalId = setInterval(() => {
      setClock(getExchangeCurrentTime(timezone));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timezone]);

  return clock;
}

