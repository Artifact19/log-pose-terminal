from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx
import pandas as pd
import yfinance as yf
from backend.app.config import settings

logger = logging.getLogger("data_service")

CACHE_DIR = Path(settings.CACHE_DIR)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_TTL_SECONDS = 15 * 60  # 15 minutes


class DataUnavailableError(Exception):
    pass


class DataService:
    def _fetch_via_yahoo_chart_api(
        self,
        ticker: str,
        start_date: str | date,
        end_date: Optional[str | date] = None,
    ) -> pd.DataFrame:
        """Fallback direct call to Yahoo Chart API with browser User-Agent for cloud IPs."""
        t = ticker.upper()
        p1 = int(datetime.combine(pd.to_datetime(start_date).date(), datetime.min.time()).timestamp())
        p2 = (
            int(datetime.combine(pd.to_datetime(end_date).date(), datetime.max.time()).timestamp())
            if end_date and str(end_date) != "latest"
            else int(time.time() + 86400)
        )

        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{t}?period1={p1}&period2={p2}&interval=1d"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "*/*",
        }

        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code != 200:
                raise DataUnavailableError(f"Yahoo Chart API returned status {resp.status_code}")
            data = resp.json()

        result = data.get("chart", {}).get("result", [{}])[0]
        if not result:
            raise DataUnavailableError(f"No chart data returned by Yahoo Chart API for {t}")

        timestamps = result.get("timestamp", [])
        quote = result.get("indicators", {}).get("quote", [{}])[0]
        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])

        rows = []
        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            o = opens[i] if i < len(opens) else None
            h = highs[i] if i < len(highs) else None
            l = lows[i] if i < len(lows) else None
            v = volumes[i] if i < len(volumes) else None
            if c is None or o is None:
                continue
            dt = datetime.utcfromtimestamp(ts).date()
            rows.append({
                "Date": pd.to_datetime(dt),
                "Open": float(o),
                "High": float(h) if h is not None else float(o),
                "Low": float(l) if l is not None else float(o),
                "Close": float(c),
                "Volume": float(v) if v is not None else 0.0,
            })

        if not rows:
            raise DataUnavailableError(f"No valid OHLCV rows parsed for {t}")

        df = pd.DataFrame(rows).set_index("Date").sort_index()
        df.index = pd.DatetimeIndex(df.index).tz_localize(None).normalize()
        df = df[~df.index.duplicated(keep="last")]
        return df

    def fetch_ohlcv(
        self,
        ticker: str,
        start: str | date,
        end: Optional[str | date] = None,
        auto_adjust: bool = True,
        force: bool = False,
    ) -> pd.DataFrame:
        t = ticker.upper()
        start_str = str(start)
        end_str = str(end) if end else "latest"
        cache_key = f"{t}_{start_str}_{end_str}_{auto_adjust}.parquet".replace(":", "-")
        cache_file = CACHE_DIR / cache_key

        # Check cache if not forcing refresh
        if not force and cache_file.exists():
            mtime = cache_file.stat().st_mtime
            if time.time() - mtime < CACHE_TTL_SECONDS:
                try:
                    df = pd.read_parquet(cache_file)
                    if not df.empty:
                        return df
                except Exception as cache_read_err:
                    logger.debug(f"Cache read error for {cache_file}: {cache_read_err}")

        # Fetch from yfinance with retry
        last_exc = None
        for attempt in range(3):
            try:
                ticker_obj = yf.Ticker(t)
                hist = ticker_obj.history(
                    start=start_str,
                    end=str(end) if end else None,
                    auto_adjust=auto_adjust,
                )
                if hist.empty:
                    hist = yf.download(
                        t,
                        start=start_str,
                        end=str(end) if end else None,
                        auto_adjust=auto_adjust,
                        progress=False,
                    )
                if isinstance(hist.columns, pd.MultiIndex):
                    hist.columns = hist.columns.get_level_values(0)

                required = ["Open", "High", "Low", "Close", "Volume"]
                if not all(col in hist.columns for col in required):
                    raise DataUnavailableError(f"Missing required OHLCV columns for {t}: {hist.columns}")

                df = hist[required].dropna(subset=["Close"]).copy()
                if df.empty:
                    raise DataUnavailableError(f"No price data available for {t}")

                # Normalize index to tz-naive, ascending DatetimeIndex
                df.index = pd.DatetimeIndex(df.index).tz_localize(None).normalize()
                df = df[~df.index.duplicated(keep="last")].sort_index()

                # Drop incomplete intraday bar if exchange regular session has not closed yet
                from backend.app.services.calendar_service import is_session_closed
                if not df.empty:
                    latest_session = df.index[-1].date()
                    if not is_session_closed(t, latest_session):
                        logger.info(
                            f"Dropping incomplete intraday bar for {t} on {latest_session} "
                            f"because exchange regular session has not officially closed."
                        )
                        df = df.iloc[:-1].copy()

                try:
                    df.to_parquet(cache_file)
                except Exception as cache_err:
                    logger.debug(f"Failed to cache parquet file: {cache_err}")

                return df
            except Exception as e:
                last_exc = e
                time.sleep(0.5 * (2**attempt))

        logger.warning(f"yfinance failed for {t} ({last_exc}), trying direct Yahoo chart API fallback...")
        try:
            df = self._fetch_via_yahoo_chart_api(t, start_str, end)
            from backend.app.services.calendar_service import is_session_closed
            if not df.empty:
                latest_session = df.index[-1].date()
                if not is_session_closed(t, latest_session):
                    logger.info(
                        f"Dropping incomplete intraday bar for {t} on {latest_session} "
                        f"because exchange regular session has not officially closed."
                    )
                    df = df.iloc[:-1].copy()

            try:
                df.to_parquet(cache_file)
            except Exception as cache_err:
                logger.debug(f"Failed to cache fallback parquet file: {cache_err}")
            return df
        except Exception as fallback_exc:
            raise DataUnavailableError(
                f"Failed to fetch market data for {t} via yfinance and chart fallback: {fallback_exc}"
            ) from fallback_exc


data_service = DataService()
