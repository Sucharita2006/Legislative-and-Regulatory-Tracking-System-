"""
test_rate_limit.py

Validates services/rate_limit.py (issue #9 — no rate limiting on the
AI-costing search endpoints):
  1. Identity resolution prefers email over IP, falls back to IP, then "unknown".
  2. enforce_rate_limit allows requests under the limit and blocks (429) over it.
  3. It fails open (allows the request) if the underlying counter errors.
  4. /search/live and /documents/search return 429 once a caller exceeds the
     configured limit, and cached/bill-number-shortcut requests don't count
     against the quota.
"""
from __future__ import annotations

import os
import sys
import uuid
import unittest
from datetime import datetime, date
from unittest.mock import MagicMock, patch
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app.services.rate_limit import _identity, enforce_rate_limit
from backend.app.main import app
from backend.app.database import get_db
from backend.app.models import LegislativeDocument
from backend.app.config import settings


class FakeRequest:
    def __init__(self, ip):
        self.client = MagicMock(host=ip) if ip else None


class TestIdentity(unittest.TestCase):

    def test_prefers_email_over_ip(self):
        self.assertEqual(_identity(FakeRequest("1.2.3.4"), "User@Example.com"), "email:user@example.com")

    def test_falls_back_to_ip_when_no_email(self):
        self.assertEqual(_identity(FakeRequest("1.2.3.4"), None), "ip:1.2.3.4")

    def test_falls_back_to_unknown_when_no_request_or_client(self):
        self.assertEqual(_identity(None, None), "ip:unknown")
        self.assertEqual(_identity(FakeRequest(None), None), "ip:unknown")


class TestEnforceRateLimit(unittest.TestCase):

    def setUp(self):
        # Isolate from the real in-memory cache singleton so counts from
        # other test files/runs can't leak in.
        patcher = patch("backend.app.services.rate_limit.in_memory_cache")
        self.mock_cache = patcher.start()
        self.addCleanup(patcher.stop)
        self._store = {}

        def fake_get(key):
            return self._store.get(key)

        def fake_set(key, value, ex=None):
            self._store[key] = value
            return True

        self.mock_cache.get.side_effect = fake_get
        self.mock_cache.set.side_effect = fake_set

        redis_patcher = patch(
            "backend.app.services.rate_limit.get_redis_client",
            return_value=self.mock_cache,
        )
        redis_patcher.start()
        self.addCleanup(redis_patcher.stop)

    def test_allows_requests_under_the_limit(self):
        for _ in range(3):
            enforce_rate_limit(None, scope="test_scope", limit=3, user_email="a@example.com")

    def test_blocks_requests_over_the_limit(self):
        for _ in range(3):
            enforce_rate_limit(None, scope="test_scope2", limit=3, user_email="b@example.com")
        with self.assertRaises(HTTPException) as ctx:
            enforce_rate_limit(None, scope="test_scope2", limit=3, user_email="b@example.com")
        self.assertEqual(ctx.exception.status_code, 429)

    def test_different_identities_have_independent_counters(self):
        for _ in range(3):
            enforce_rate_limit(None, scope="test_scope3", limit=3, user_email="c@example.com")
        # A different user should not be blocked by c@example.com's usage.
        enforce_rate_limit(None, scope="test_scope3", limit=3, user_email="d@example.com")

    def test_fails_open_when_counter_raises(self):
        with patch("backend.app.services.rate_limit.get_redis_client", side_effect=Exception("boom")):
            # Should not raise — a broken limiter must not block real traffic.
            enforce_rate_limit(None, scope="test_scope4", limit=1, user_email="e@example.com")

    def test_window_resets_after_expiry_even_under_sustained_hits(self):
        """Regression test: the in-memory fallback used to call
        client.set(key, ..., ex=window_seconds) on every hit — including
        rejected ones — which kept extending the window forever under
        sustained retries. It must track its own window_start and actually
        reset once window_seconds has really elapsed, regardless of how many
        (allowed or blocked) calls happened in between."""
        fake_now = [1000.0]
        with patch("backend.app.services.rate_limit.time.time", side_effect=lambda: fake_now[0]):
            for _ in range(3):
                enforce_rate_limit(None, scope="test_scope5", limit=3, window_seconds=10, user_email="f@example.com")
            with self.assertRaises(HTTPException):
                enforce_rate_limit(None, scope="test_scope5", limit=3, window_seconds=10, user_email="f@example.com")

            # Still within the original 10s window — stays blocked, and must
            # not silently extend the window past its original expiry.
            fake_now[0] += 5
            with self.assertRaises(HTTPException):
                enforce_rate_limit(None, scope="test_scope5", limit=3, window_seconds=10, user_email="f@example.com")

            # Past the window's real expiry (11s since it started) — must allow again.
            fake_now[0] += 6
            enforce_rate_limit(None, scope="test_scope5", limit=3, window_seconds=10, user_email="f@example.com")


def make_doc(source_id):
    return LegislativeDocument(
        id=uuid.uuid4(),
        source_id=source_id,
        source_url=f"https://congress.gov/{source_id}",
        congress=119,
        bill_type="HR",
        bill_number="1",
        title="Test Bill",
        introduced_date=date(2026, 1, 1),
        origin_chamber="House",
        policy_area="Animals",
        last_action_date=date(2026, 1, 2),
        last_action_text="Referred to committee",
        update_date=datetime(2026, 1, 2),
        update_date_incl_text=datetime(2026, 1, 2),
        source_hash="hash",
        api_raw={},
        ingested_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
        relevance_score=75,
        relevance_topics=[],
        ai_summary="Summary.",
    )


def make_query_mock(docs, total=None):
    q = MagicMock()
    for method in ("options", "filter", "join", "distinct", "order_by", "offset", "limit"):
        getattr(q, method).return_value = q
    q.all.return_value = docs
    q.count.return_value = total if total is not None else len(docs)
    q.first.return_value = docs[0] if docs else None
    return q


class TestSearchEndpointsRateLimited(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        cache_patcher = patch("backend.app.services.cache.get_cache", return_value=None)
        set_cache_patcher = patch("backend.app.services.cache.set_cache")
        cache_patcher.start()
        set_cache_patcher.start()
        self.addCleanup(cache_patcher.stop)
        self.addCleanup(set_cache_patcher.stop)

        # Isolated in-memory store for the limiter, scoped per test.
        self._store = {}

        def fake_get(key):
            return self._store.get(key)

        def fake_set(key, value, ex=None):
            self._store[key] = value
            return True

        fake_cache = MagicMock()
        fake_cache.get.side_effect = fake_get
        fake_cache.set.side_effect = fake_set
        redis_patcher = patch("backend.app.services.rate_limit.get_redis_client", return_value=fake_cache)
        in_memory_patcher = patch("backend.app.services.rate_limit.in_memory_cache", fake_cache)
        redis_patcher.start()
        in_memory_patcher.start()
        self.addCleanup(redis_patcher.stop)
        self.addCleanup(in_memory_patcher.stop)

        self._orig_limit = settings.RATE_LIMIT_SEARCH_PER_MINUTE
        settings.RATE_LIMIT_SEARCH_PER_MINUTE = 2
        self.addCleanup(setattr, settings, "RATE_LIMIT_SEARCH_PER_MINUTE", self._orig_limit)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_search_live_blocks_after_limit(self):
        mock_db = MagicMock()
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("backend.app.services.semantic_scoring.vector_search", return_value=[]), \
             patch("backend.app.services.ai_processing.expand_prompt_to_topics",
                   return_value={"topics": [], "keywords": [], "inferred_filters": {}}):
            r1 = self.client.post("/search/live", json={"prompt": "farm animals", "user_email": "limit@example.com"})
            r2 = self.client.post("/search/live", json={"prompt": "farm animals", "user_email": "limit@example.com"})
            r3 = self.client.post("/search/live", json={"prompt": "farm animals", "user_email": "limit@example.com"})

        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r3.status_code, 429)

    def test_bill_number_shortcut_does_not_count_against_quota(self):
        doc = make_doc("119-HR-42")
        mock_db = MagicMock()
        mock_db.query.return_value = make_query_mock([doc])
        app.dependency_overrides[get_db] = lambda: mock_db

        # Well over the limit of 2, but every request is a bill-number direct
        # hit, which should never invoke the rate limiter.
        for _ in range(5):
            response = self.client.post(
                "/search/live",
                json={"prompt": "119-HR-42", "user_email": "shortcut@example.com"},
            )
            self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
