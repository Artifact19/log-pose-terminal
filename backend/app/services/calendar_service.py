from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import pandas as pd

logger = logging.getLogger("calendar_service")


def exchange_for(ticker: str) -> str:
    t = ticker.upper()
    if t.endswith(".NS"):
        return "XNSE"
    if t.endswith(".BO"):
        return "XBOM"
    return "XNYS"


def is_session_closed(
    ticker: str,
    target_date: date,
    current_time: Optional[datetime] = None,
) -> bool:
    """Returns True if the market regular session on target_date has officially closed."""
    now_utc = current_time or datetime.now(timezone.utc)
    target_d = pd.to_datetime(target_date).date()
    today_d = now_utc.date()

    if target_d < today_d:
        return True
    if target_d > today_d:
        return False

    # target_d == today_d
    try:
        import pandas_market_calendars as mcal

        cal = mcal.get_calendar(exchange_for(ticker))
        sched = cal.schedule(start_date=target_d, end_date=target_d)
        if sched.empty:
            # Market was closed today (holiday or weekend)
            return True
        close_time_utc = sched.iloc[0]["market_close"].to_pydatetime()
        return now_utc >= close_time_utc
    except Exception as e:
        logger.warning(f"Could not verify market close schedule for {ticker}: {e}")
        # Conservative heuristics if mcal fails:
        # NSE regular session closes at 15:30 IST (10:00 UTC)
        # US markets close at 16:00 ET (20:00 or 21:00 UTC)
        if ticker.upper().endswith(".NS"):
            return now_utc.hour > 10 or (now_utc.hour == 10 and now_utc.minute >= 30)
        return now_utc.hour >= 21


def project_trading_dates(ticker: str, anchor: date, horizon: int) -> list[date]:
    """Next `horizon` sessions strictly after `anchor`."""
    try:
        import pandas_market_calendars as mcal

        cal = mcal.get_calendar(exchange_for(ticker))
        sched = cal.schedule(
            start_date=anchor + timedelta(days=1),
            end_date=anchor + timedelta(days=horizon * 3 + 14),
        )
        days = [d.date() for d in sched.index]
    except Exception as e:
        logger.warning(
            f"Market calendar lookup failed for {ticker}: {e}, falling back to weekday schedule"
        )
        days = [
            d.date()
            for d in pd.bdate_range(anchor + timedelta(days=1), periods=horizon * 3 + 14)
        ]
    return days[:horizon]


def realized_sessions_after(anchor: date, observed_index: pd.DatetimeIndex) -> list[date]:
    """Observed trading sessions strictly after the anchor, ascending."""
    idx = pd.DatetimeIndex(observed_index).tz_localize(None).normalize()
    return [d.date() for d in idx[idx > pd.Timestamp(anchor)].sort_values().unique()]
