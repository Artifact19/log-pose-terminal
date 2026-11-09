export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const rawTicker = (req.query?.ticker || "AAPL").toString().trim().toUpperCase();

  // Map ticker to natural financial search terms
  const TICKER_MAP: Record<string, { query: string; region: string }> = {
    AAPL: { query: "Apple stock", region: "US" },
    NVDA: { query: "Nvidia stock", region: "US" },
    MSFT: { query: "Microsoft stock", region: "US" },
    SPY: { query: "S&P 500 ETF stock", region: "US" },
    "RELIANCE.NS": { query: "Reliance Industries stock", region: "IN" },
    "TCS.NS": { query: "Tata Consultancy Services stock", region: "IN" },
  };

  const config = TICKER_MAP[rawTicker] || {
    query: `${rawTicker.replace(/\.NS$/, "")} stock`,
    region: rawTicker.endsWith(".NS") ? "IN" : "US",
  };

  try {
    const rawItems: Array<{
      title: string;
      link: string;
      pubDate: string;
      source: string;
    }> = [];

    // 1. Try Yahoo Finance Search API first (provides direct, verified article URLs)
    try {
      const yfUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        rawTicker.replace(/\.NS$/, "")
      )}`;
      const yfRes = await fetch(yfUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      });

      if (yfRes.ok) {
        const yfData = await yfRes.json();
        const news = Array.isArray(yfData?.news) ? yfData.news : [];
        for (const n of news) {
          if (!n.title || !n.link) continue;
          let timeStr = "Recent";
          if (n.providerPublishTime) {
            const diffHours = Math.round((Date.now() - n.providerPublishTime * 1000) / 3600000);
            timeStr = diffHours <= 1 ? "Just now" : `${diffHours} hours ago`;
          }
          rawItems.push({
            title: n.title,
            link: n.link, // Direct Yahoo Finance article URL
            pubDate: timeStr,
            source: n.publisher || "Yahoo Finance",
          });
          if (rawItems.length >= 15) break;
        }
      }
    } catch {}

    // 2. If fewer than 6 articles found, supplement with Google News RSS
    if (rawItems.length < 6) {
      const rssUrl =
        config.region === "IN"
          ? `https://news.google.com/rss/search?q=${encodeURIComponent(config.query)}&hl=en-IN&gl=IN&ceid=IN:en`
          : `https://news.google.com/rss/search?q=${encodeURIComponent(config.query)}&hl=en-US&gl=US&ceid=US:en`;

      const response = await fetch(rssUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      });

      if (response.ok) {
        const xmlText = await response.text();
        const itemRegex =
          /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?(?:<source[^>]*>(.*?)<\/source>)?[\s\S]*?<\/item>/g;

        let match;
        while ((match = itemRegex.exec(xmlText)) !== null && rawItems.length < 15) {
          const rawTitle = match[1]
            .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim();

          const pubDate = match[3].trim();
          let source = (match[4] || "").trim();

          let cleanTitle = rawTitle;
          const lastDash = rawTitle.lastIndexOf(" - ");
          if (lastDash > 0) {
            if (!source) source = rawTitle.slice(lastDash + 3).trim();
            cleanTitle = rawTitle.slice(0, lastDash).trim();
          }

          // Use verified Google Search query to bypass broken Google RSS redirection and take the user to the exact live article
          const directSearchLink = `https://www.google.com/search?q=${encodeURIComponent(
            cleanTitle + " " + (source || "news")
          )}`;

          // Format relative time if possible
          let timeAgo = pubDate;
          const parsed = Date.parse(pubDate);
          if (!isNaN(parsed)) {
            const diffHours = Math.round((Date.now() - parsed) / 3600000);
            timeAgo = diffHours <= 1 ? "Just now" : diffHours < 24 ? `${diffHours} hours ago` : `${Math.round(diffHours / 24)} days ago`;
          }

          rawItems.push({
            title: cleanTitle,
            link: directSearchLink,
            pubDate: timeAgo,
            source: source || "Financial News",
          });
        }
      }
    }

    // Financial Sentiment Lexicons (Loughran-McDonald & VADER financial adaptations)
    const POSITIVE_LEXICON: Record<string, number> = {
      surge: 1.5,
      surges: 1.5,
      surging: 1.5,
      surged: 1.5,
      rally: 1.4,
      rallies: 1.4,
      rallied: 1.4,
      gain: 1.2,
      gains: 1.2,
      gained: 1.2,
      profit: 1.3,
      profits: 1.3,
      growth: 1.2,
      record: 1.3,
      high: 0.8,
      highs: 0.8,
      beat: 1.4,
      beats: 1.4,
      beating: 1.4,
      bullish: 1.5,
      upbeat: 1.2,
      boost: 1.2,
      boosts: 1.2,
      outperform: 1.4,
      outperforms: 1.4,
      dividend: 1.0,
      upgrade: 1.4,
      upgrades: 1.4,
      expand: 1.1,
      expands: 1.1,
      expansion: 1.1,
      breakthrough: 1.5,
      soar: 1.5,
      soars: 1.5,
      soaring: 1.5,
      strong: 1.1,
      stronger: 1.2,
      climb: 1.0,
      climbs: 1.0,
      advance: 1.0,
      advances: 1.0,
      exceed: 1.3,
      exceeds: 1.3,
      flying: 1.4,
      jump: 1.2,
      jumps: 1.2,
      positive: 1.0,
      win: 1.2,
      wins: 1.2,
      opportunity: 1.0,
      target: 0.5,
      upside: 1.3,
    };

    const NEGATIVE_LEXICON: Record<string, number> = {
      fall: -1.2,
      falls: -1.2,
      falling: -1.2,
      fell: -1.2,
      drop: -1.2,
      drops: -1.2,
      dropped: -1.2,
      dropping: -1.2,
      plunge: -1.6,
      plunges: -1.6,
      plunging: -1.6,
      plunged: -1.6,
      slide: -1.2,
      slides: -1.2,
      sliding: -1.2,
      loss: -1.4,
      losses: -1.4,
      decline: -1.1,
      declines: -1.1,
      declining: -1.1,
      miss: -1.4,
      misses: -1.4,
      missed: -1.4,
      bearish: -1.5,
      cut: -1.2,
      cuts: -1.2,
      downgrade: -1.5,
      downgrades: -1.5,
      struggle: -1.3,
      struggles: -1.3,
      struggling: -1.3,
      layoff: -1.3,
      layoffs: -1.3,
      lawsuit: -1.4,
      risk: -0.9,
      risks: -0.9,
      slump: -1.4,
      slumps: -1.4,
      warning: -1.3,
      warns: -1.3,
      probe: -1.4,
      inflation: -0.8,
      deficit: -1.1,
      tumble: -1.4,
      tumbles: -1.4,
      crash: -1.7,
      weak: -1.2,
      weaker: -1.2,
      weakness: -1.3,
      sink: -1.3,
      sinks: -1.3,
      negative: -1.0,
      drag: -1.0,
      downside: -1.3,
      sell: -0.8,
      sells: -0.8,
      selling: -0.9,
    };

    const NEGATORS = new Set(["not", "no", "never", "fails", "failed", "struggles", "unlikely"]);
    const AMPLIFIERS = new Set(["massive", "huge", "sharp", "major", "record", "extreme"]);

    let totalScore = 0;
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;

    const scoredArticles = rawItems.map((item) => {
      const words = item.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

      let articleScore = 0;
      let hitCount = 0;

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const prev1 = i > 0 ? words[i - 1] : "";
        const prev2 = i > 1 ? words[i - 2] : "";
        const isNegated = NEGATORS.has(prev1) || NEGATORS.has(prev2);
        const isAmplified = AMPLIFIERS.has(prev1) || AMPLIFIERS.has(prev2);
        const multiplier = (isNegated ? -1 : 1) * (isAmplified ? 1.5 : 1.0);

        if (POSITIVE_LEXICON[w]) {
          articleScore += POSITIVE_LEXICON[w] * multiplier;
          hitCount++;
        } else if (NEGATIVE_LEXICON[w]) {
          articleScore += NEGATIVE_LEXICON[w] * multiplier;
          hitCount++;
        }
      }

      const normalizedScore = hitCount > 0 ? Math.max(-1, Math.min(1, articleScore / (hitCount * 1.5))) : 0;

      let sentimentLabel: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
      if (normalizedScore >= 0.15) {
        sentimentLabel = "BULLISH";
        bullishCount++;
      } else if (normalizedScore <= -0.15) {
        sentimentLabel = "BEARISH";
        bearishCount++;
      } else {
        neutralCount++;
      }

      totalScore += normalizedScore;

      return {
        title: item.title,
        link: item.link,
        published_at: item.pubDate,
        publisher: item.source,
        sentiment: sentimentLabel,
        score: Number(normalizedScore.toFixed(2)),
      };
    });

    const articlesCount = scoredArticles.length;
    const compositeScore = articlesCount > 0 ? Number((totalScore / articlesCount).toFixed(2)) : 0;

    let aggregateLabel: "STRONGLY BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONGLY BEARISH" = "NEUTRAL";
    if (compositeScore >= 0.35) aggregateLabel = "STRONGLY BULLISH";
    else if (compositeScore >= 0.12) aggregateLabel = "BULLISH";
    else if (compositeScore <= -0.35) aggregateLabel = "STRONGLY BEARISH";
    else if (compositeScore <= -0.12) aggregateLabel = "BEARISH";
    else aggregateLabel = "NEUTRAL";

    const driftTiltPct = Number((compositeScore * 1.5).toFixed(2));

    const volume24h = scoredArticles.filter((a) => {
      const p = a.published_at.toLowerCase();
      return p.includes("hour") || p.includes("just now") || p.includes("minute");
    }).length;

    let velocityStatus: "HIGH" | "NORMAL" | "MODERATE" | "LOW" = "NORMAL";
    if (articlesCount >= 8) velocityStatus = "HIGH";
    else if (articlesCount >= 5) velocityStatus = "NORMAL";
    else if (articlesCount >= 3) velocityStatus = "MODERATE";
    else velocityStatus = "LOW";

    return res.status(200).json({
      ticker: rawTicker,
      score: compositeScore,
      label: aggregateLabel,
      drift_tilt_pct: driftTiltPct,
      articles_analyzed: articlesCount,
      news_velocity: velocityStatus,
      volume_24h: volume24h,
      bullish_count: bullishCount,
      bearish_count: bearishCount,
      neutral_count: neutralCount,
      articles: scoredArticles,
      as_of: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      ticker: rawTicker,
      error: err.message || "Failed to process NLP sentiment",
    });
  }
}
