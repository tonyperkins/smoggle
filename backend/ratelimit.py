"""
ratelimit.py — tiny in-process token-bucket rate limiter keyed by client IP.

Smoggle runs as a single container on a trusted private network, so a per-process
in-memory limiter is sufficient (no shared store needed). Used to blunt brute
force against auth and to cap expensive SSH probe endpoints.
"""
import threading
import time

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Token bucket: `capacity` burst, refilling at `refill_per_sec` tokens/sec."""

    def __init__(self, capacity: int, refill_per_sec: float):
        self.capacity = capacity
        self.rate = refill_per_sec
        self._tokens: dict[str, float] = {}
        self._last: dict[str, float] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Consume one token for `key`. Returns False if the bucket is empty."""
        now = time.monotonic()
        with self._lock:
            tokens = self._tokens.get(key, float(self.capacity))
            last = self._last.get(key, now)
            tokens = min(self.capacity, tokens + (now - last) * self.rate)
            if tokens < 1.0:
                self._tokens[key] = tokens
                self._last[key] = now
                return False
            self._tokens[key] = tokens - 1.0
            self._last[key] = now
            return True


def client_ip(request: Request) -> str:
    return request.client.host if request and request.client else "unknown"


# Failed-auth attempts: ~10 burst, refilling 1 every 6s (10/min sustained).
auth_failures = RateLimiter(capacity=10, refill_per_sec=10 / 60)

# Expensive SSH probes (test-connection / test-sudo): 10 burst, ~1/3s sustained.
probes = RateLimiter(capacity=10, refill_per_sec=20 / 60)


def limit_probes(request: Request) -> None:
    """FastAPI dependency: rate-limit expensive SSH probe endpoints by client IP."""
    if not probes.allow(client_ip(request)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests — slow down.",
        )
