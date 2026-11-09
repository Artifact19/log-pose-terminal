export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const ticker = (req.query?.ticker || "AAPL").toString().toUpperCase();
  const days = parseInt(req.query?.days || "250", 10);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`;
    const yfRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
      },
    });

    if (!yfRes.ok) {
      return res.status(yfRes.status).json({ detail: `Yahoo Finance API returned ${yfRes.status}` });
    }

    const data = await yfRes.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return res.status(404).json({ detail: "No chart data returned by Yahoo Finance" });
    }

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens: (number | null)[] = quote.open || [];
    const highs: (number | null)[] = quote.high || [];
    const lows: (number | null)[] = quote.low || [];
    const closes: (number | null)[] = quote.close || [];
    const volumes: (number | null)[] = quote.volume || [];

    const bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null || opens[i] == null) continue;
      const d = new Date(timestamps[i] * 1000);
      const dateStr = d.toISOString().split("T")[0];
      bars.push({
        date: dateStr,
        open: Number(opens[i]!.toFixed(2)),
        high: Number(highs[i]!.toFixed(2)),
        low: Number(lows[i]!.toFixed(2)),
        close: Number(closes[i]!.toFixed(2)),
        volume: volumes[i] || 0,
      });
    }

    const sliced = bars.slice(-days);
    const lastBarDate = sliced.length > 0 ? sliced[sliced.length - 1].date : null;

    return res.status(200).json({
      ticker,
      bars: sliced,
      last_bar_date: lastBarDate,
      is_stale: false,
    });
  } catch (err: any) {
    return res.status(500).json({ detail: err.message });
  }
}

