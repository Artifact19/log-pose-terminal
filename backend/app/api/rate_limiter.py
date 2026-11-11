import time
from collections import defaultdict
from threading import Lock
from fastapi import Request, HTTPException, status


class SimpleRateLimiter:
    """Sliding-window in-memory per-IP rate limiter."""

    def __init__(self, requests_per_minute: int = 30):
        self.rpm = requests_per_minute
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.lock = Lock()

    def __call__(self, request: Request):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"

        now = time.time()
        window_start = now - 60.0

        with self.lock:
            timestamps = [t for t in self.requests[ip] if t > window_start]
            if len(timestamps) >= self.rpm:
                retry_after = int(60.0 - (now - timestamps[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded ({self.rpm} requests/minute). Please try again in {retry_after}s.",
                    headers={"Retry-After": str(retry_after)},
                )
            timestamps.append(now)
            self.requests[ip] = timestamps


rate_limit_forecast = SimpleRateLimiter(requests_per_minute=30)
rate_limit_reconcile = SimpleRateLimiter(requests_per_minute=30)
