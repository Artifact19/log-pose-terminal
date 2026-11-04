from __future__ import annotations

from datetime import date, timedelta
import pandas as pd


def exchange_for(ticker: str) -> str:
    t = ticker.upper()
    if t.endswith(".NS"):
        return "XNSE"
    if t.endswith(".BO"):
        return "XBOM"
    return "XNYS"


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
    except Exception:
        days = [
            d.date()
            for d in pd.bdate_range(anchor + timedelta(days=1), periods=horizon * 3 + 14)
        ]
    return days[:horizon]


def realized_sessions_after(anchor: date, observed_index: pd.DatetimeIndex) -> list[date]:
    """Observed trading sessions strictly after the anchor, ascending."""
    idx = pd.DatetimeIndex(observed_index).tz_localize(None).normalize()
    return [d.date() for d in idx[idx > pd.Timestamp(anchor)].sort_values().unique()]

