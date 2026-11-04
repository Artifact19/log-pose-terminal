from datetime import date
import pandas as pd
import pytest
from backend.app.services.calendar_service import project_trading_dates, realized_sessions_after


def test_friday_anchor_projects_to_monday():
    # 2024-05-10 is a Friday
    friday = date(2024, 5, 10)
    projected = project_trading_dates("AAPL", friday, horizon=3)

    # Next session must be Monday 2024-05-13
    assert len(projected) == 3
    assert projected[0] == date(2024, 5, 13)
    assert projected[1] == date(2024, 5, 14)
    assert projected[2] == date(2024, 5, 15)


def test_us_holiday_is_skipped():
    # 2024-07-03 is Wednesday before US Independence Day (Thursday July 4)
    wednesday = date(2024, 7, 3)
    projected = project_trading_dates("AAPL", wednesday, horizon=2)

    # Thursday July 4 is holiday; next session is Friday July 5
    assert len(projected) == 2
    assert projected[0] == date(2024, 7, 5)


def test_realized_sessions_after():
    anchor = date(2024, 1, 10)
    dates = pd.date_range("2024-01-08", "2024-01-18", freq="B")
    observed = realized_sessions_after(anchor, dates)

    # Must contain only sessions strictly after anchor (Jan 11 onwards)
    assert len(observed) > 0
    assert all(d > anchor for d in observed)
    assert observed[0] == date(2024, 1, 11)

