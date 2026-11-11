from datetime import date, datetime, timezone
from unittest.mock import patch
import pandas as pd
import pytest

from backend.app.services.calendar_service import is_session_closed
from backend.app.services.data_service import data_service


def test_is_session_closed_past_date():
    assert is_session_closed("AAPL", date(2024, 1, 10)) is True


def test_is_session_closed_during_market_hours():
    # Simulate today during US market hours (14:00 UTC = 10:00 AM ET)
    fake_now = datetime(2024, 5, 8, 14, 0, tzinfo=timezone.utc)
    today = fake_now.date()
    with patch("backend.app.services.calendar_service.datetime") as mock_dt:
        mock_dt.now.return_value = fake_now
        mock_dt.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)
        closed = is_session_closed("AAPL", today)
        assert closed is False


def test_fetch_ohlcv_drops_unclosed_intraday_bar(tmp_path):
    today = date(2024, 5, 8)
    dates = pd.date_range("2024-05-01", "2024-05-08", freq="B")
    mock_df = pd.DataFrame(
        {
            "Open": [100.0] * len(dates),
            "High": [105.0] * len(dates),
            "Low": [99.0] * len(dates),
            "Close": [102.0] * len(dates),
            "Volume": [1000000] * len(dates),
        },
        index=dates,
    )

    with patch("yfinance.Ticker") as mock_ticker, \
         patch("backend.app.services.calendar_service.is_session_closed", return_value=False), \
         patch("backend.app.services.data_service.CACHE_DIR", tmp_path):
        
        instance = mock_ticker.return_value
        instance.history.return_value = mock_df.copy()

        df = data_service.fetch_ohlcv("AAPL", start="2024-05-01", force=True)
        # 2024-05-08 is unclosed, so it must be dropped
        assert df.index[-1].date() < today
        assert len(df) == len(dates) - 1
