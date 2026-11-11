#!/usr/bin/env python
"""Pre-trains active models for all tickers in SUPPORTED_TICKERS.

Usage:
    python scripts/pretrain_models.py [--force] [--horizon 5]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.app.config import settings
from backend.app.db import init_db
from backend.app.services.retrain_service import retrain_service


def main():
    parser = argparse.ArgumentParser(description="Pre-train models for all supported tickers.")
    parser.add_argument("--force", action="store_true", help="Force retrain even if model is up to date.")
    parser.add_argument("--horizon", type=int, default=settings.DEFAULT_HORIZON, help="Forecast horizon (default 5).")
    args = parser.parse_args()

    init_db()
    tickers = settings.SUPPORTED_TICKERS
    print(f"[pretrain] Starting pre-training for {len(tickers)} tickers: {tickers}")

    for t in tickers:
        print(f"\n[pretrain] Processing {t} (horizon={args.horizon}, force={args.force})...")
        try:
            diff = retrain_service.trigger_retrain(
                ticker=t,
                force=args.force,
                horizon=args.horizon,
                sync=True,  # synchronous execution for CLI script
            )
            print(f"[pretrain] SUCCESS for {t}: retrained={diff.get('retrained')}, activated={diff.get('activated')}")
        except Exception as e:
            print(f"[pretrain] ERROR training {t}: {e}")

    print("\n[pretrain] All supported tickers processed.")


if __name__ == "__main__":
    main()
