from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query
import pandas as pd
from backend.app.schemas.api import MarketBarsResponse, OHLCVBar
from backend.app.services.data_service import data_service

router = APIRouter()


@router.get("/market/{ticker}/bars", response_model=MarketBarsResponse)
def get_market_bars(
    ticker: str,
    days: int = Query(default=250, ge=10, le=1000),
):
    t = ticker.upper()
    start_date = date.today() - timedelta(days=days * 2)
    try:
        df = data_service.fetch_ohlcv(t, start=start_date, auto_adjust=True)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Data unavailable for {t}: {e}")

    tail = df.tail(days)
    bars = []
    for idx, row in tail.iterrows():
        bars.append(
            OHLCVBar(
                date=str(pd.Timestamp(idx).date()),
                open=round(float(row["Open"]), 4),
                high=round(float(row["High"]), 4),
                low=round(float(row["Low"]), 4),
                close=round(float(row["Close"]), 4),
                volume=round(float(row["Volume"]), 2),
            )
        )

    last_bar_date = bars[-1].date if bars else None
    is_stale = False
    if last_bar_date:
        d = date.fromisoformat(last_bar_date)
        is_stale = (date.today() - d).days > 4

    return MarketBarsResponse(
        ticker=t,
        bars=bars,
        last_bar_date=last_bar_date,
        is_stale=is_stale,
    )

