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
        self.DEFAULT_TRAIN_YEARS: int = int(os.getenv("DEFAULT_TRAIN_YEARS", "8"))
        self.RETRAIN_COVERAGE_FLOOR: float = float(os.getenv("RETRAIN_COVERAGE_FLOOR", "0.65"))
        self.RETRAIN_LOOKBACK_DAYS: int = int(os.getenv("RETRAIN_LOOKBACK_DAYS", "10"))
        self.CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
        self.ENV: str = os.getenv("ENV", "dev")
        self.DISCLAIMER: str = (
            "Log Pose Terminal is for research and forward-testing "
            "purposes only. Not financial advice."
        )


settings = Settings()
