export function fmtPrice(price: number | null | undefined, ticker?: string): string {
  if (price === null || price === undefined || isNaN(price)) return "—";
  const isINR = ticker?.toUpperCase().endsWith(".NS") || ticker?.toUpperCase().endsWith(".BO");
  const prefix = isINR ? "₹" : "$";
  return `${prefix}${price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtPct(val: number | null | undefined, signed: boolean = true): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const sign = signed && val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

export function fmtDate(dStr: string | null | undefined): string {
  if (!dStr) return "—";
  try {
    const d = new Date(dStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dStr;
  }
}

export function fmtNumber(val: number | null | undefined, decimals: number = 2): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return val.toFixed(decimals);
}

export interface MarketInfo {
  exchangeCode: string;
  exchangeName: string;
  marketRegion: string;
  timezone: string;
}

export function getMarketInfo(ticker?: string): MarketInfo {
  const t = (ticker || "").toUpperCase();
  if (t.endsWith(".NS")) {
    return {
      exchangeCode: "NSE India",
      exchangeName: "National Stock Exchange",
      marketRegion: "India",
      timezone: "IST",
    };
  }
  if (t.endsWith(".BO")) {
    return {
      exchangeCode: "BSE India",
      exchangeName: "Bombay Stock Exchange",
      marketRegion: "India",
      timezone: "IST",
    };
  }
  if (t.endsWith(".L")) {
    return {
      exchangeCode: "LSE UK",
      exchangeName: "London Stock Exchange",
      marketRegion: "UK",
      timezone: "GMT",
    };
  }
  if (t.endsWith(".TO")) {
    return {
      exchangeCode: "TSX Canada",
      exchangeName: "Toronto Stock Exchange",
      marketRegion: "Canada",
      timezone: "ET",
    };
  }
  return {
    exchangeCode: "US (NYSE/NASDAQ)",
    exchangeName: "US Market",
    marketRegion: "United States",
    timezone: "ET",
  };
}

