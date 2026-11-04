from __future__ import annotations

import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
import yfinance as yf
from backend.app.config import settings

CACHE_DIR = Path(settings.CACHE_DIR)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_TTL_SECONDS = 15 * 60  # 15 minutes


class DataUnavailableError(Exception):
    pass


class DataService:
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
                except Exception:
                    pass

        # Fetch from yfinance with retry
        last_exc = None
        for attempt in range(3):
            try:
                # History is cleaner for single ticker than download
                ticker_obj = yf.Ticker(t)
                hist = ticker_obj.history(
                    start=start_str,
                    end=str(end) if end else None,
                    auto_adjust=auto_adjust,
                )
                if hist.empty:
                    # Fallback to yf.download
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

                # Save cache
                try:
                    df.to_parquet(cache_file)
                except Exception:
                    pass

                return df
            except Exception as e:
                last_exc = e
                time.sleep(0.5 * (2**attempt))

        raise DataUnavailableError(f"Failed to fetch market data for {t}: {last_exc}") from last_exc


data_service = DataService()

