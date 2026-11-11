import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    def __init__(self):
        self.DATABASE_URL: str = os.getenv("DATABASE_URL", "")
        self.ARTIFACT_DIR: str = os.getenv("ARTIFACT_DIR", str(ROOT_DIR / "artifacts"))
        self.CACHE_DIR: str = os.getenv("CACHE_DIR", str(ROOT_DIR / "cache"))
        self.DEFAULT_HORIZON: int = int(os.getenv("DEFAULT_HORIZON", "5"))
        self.MAX_HORIZON: int = int(os.getenv("MAX_HORIZON", "20"))
        self.DEFAULT_TRAIN_YEARS: int = int(os.getenv("DEFAULT_TRAIN_YEARS", "8"))
        self.RETRAIN_COVERAGE_FLOOR: float = float(os.getenv("RETRAIN_COVERAGE_FLOOR", "0.65"))
        self.RETRAIN_LOOKBACK_DAYS: int = int(os.getenv("RETRAIN_LOOKBACK_DAYS", "10"))
        self.CORS_ORIGINS: str = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:8000,https://log-pose-terminal.vercel.app",
        )
        self.CORS_ORIGIN_REGEX: str = os.getenv(
            "CORS_ORIGIN_REGEX", r"^https://.*\.vercel\.app$"
        )
        self.ENV: str = os.getenv("ENV", "production")
        self.ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "arnavraut4567@gmail.com")
        self.SUPABASE_URL: str = os.getenv("SUPABASE_URL", os.getenv("VITE_SUPABASE_URL", ""))
        self.SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
        supported_tickers_raw = os.getenv(
            "SUPPORTED_TICKERS", "AAPL,NVDA,MSFT,SPY,RELIANCE.NS,TCS.NS"
        )
        self.SUPPORTED_TICKERS: list[str] = [
            t.strip().upper() for t in supported_tickers_raw.split(",") if t.strip()
        ]
        self.DISCLAIMER: str = (
            "Log Pose Terminal is for research and forward-testing "
            "purposes only. Not financial advice."
        )


settings = Settings()
