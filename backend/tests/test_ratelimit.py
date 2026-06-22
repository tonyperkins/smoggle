"""
test_ratelimit.py — tests for the in-process token-bucket rate limiter.
"""
import time

from backend.ratelimit import RateLimiter


def test_allows_within_burst():
    rl = RateLimiter(capacity=5, refill_per_sec=1)
    for _ in range(5):
        assert rl.allow("1.2.3.4") is True


def test_blocks_after_burst_exhausted():
    rl = RateLimiter(capacity=3, refill_per_sec=0.1)
    for _ in range(3):
        assert rl.allow("client1") is True
    assert rl.allow("client1") is False


def test_refills_over_time():
    rl = RateLimiter(capacity=2, refill_per_sec=100)  # fast refill
    assert rl.allow("c") is True
    assert rl.allow("c") is True
    assert rl.allow("c") is False
    time.sleep(0.05)  # 50ms → 5 tokens refilled
    assert rl.allow("c") is True


def test_separate_keys_independent():
    rl = RateLimiter(capacity=2, refill_per_sec=0)
    assert rl.allow("a") is True
    assert rl.allow("a") is True
    assert rl.allow("a") is False
    # "b" has its own bucket
    assert rl.allow("b") is True
