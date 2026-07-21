"""
test_job_lock.py

Validates services/job_lock.py (concurrency locks for expensive background
jobs) and its wiring into the admin/pipeline-trigger endpoints:
  1. try_acquire_lock/release_lock mechanics — acquire succeeds once, blocks
     a second acquire, frees up after release, independent scopes don't
     interfere, fails open on internal error.
  2. Each protected endpoint returns 409 when its scope's lock is already
     held, instead of silently starting a duplicate job.

Note: FastAPI's TestClient runs BackgroundTasks synchronously as part of
sending the response, so by the time a request returns, any lock acquired
*by that request's own background task* has already been released. To test
"endpoint respects an existing lock," each 409 test pre-acquires the lock
directly (simulating another job already running) rather than trying to
race two overlapping requests.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from fastapi.testclient import TestClient
from backend.app.services.job_lock import try_acquire_lock, release_lock
from backend.app.main import app
from backend.app.database import get_db
from backend.app.services.auth import require_internal_key


class TestJobLockMechanics(unittest.TestCase):

    def setUp(self):
        patcher = patch("backend.app.services.job_lock.in_memory_cache")
        self.mock_cache = patcher.start()
        self.addCleanup(patcher.stop)
        self._store = {}

        def fake_get(key):
            return self._store.get(key)

        def fake_set(key, value, ex=None):
            self._store[key] = value
            return True

        def fake_delete(*keys):
            count = 0
            for k in keys:
                if self._store.pop(k, None) is not None:
                    count += 1
            return count

        self.mock_cache.get.side_effect = fake_get
        self.mock_cache.set.side_effect = fake_set
        self.mock_cache.delete.side_effect = fake_delete

        redis_patcher = patch("backend.app.services.job_lock.get_redis_client", return_value=self.mock_cache)
        redis_patcher.start()
        self.addCleanup(redis_patcher.stop)

    def test_first_acquire_succeeds(self):
        self.assertTrue(try_acquire_lock("scope_a"))

    def test_second_acquire_blocked_while_held(self):
        self.assertTrue(try_acquire_lock("scope_b"))
        self.assertFalse(try_acquire_lock("scope_b"))

    def test_release_frees_the_lock_for_reacquisition(self):
        self.assertTrue(try_acquire_lock("scope_c"))
        self.assertFalse(try_acquire_lock("scope_c"))
        release_lock("scope_c")
        self.assertTrue(try_acquire_lock("scope_c"))

    def test_independent_scopes_do_not_interfere(self):
        self.assertTrue(try_acquire_lock("scope_d"))
        self.assertTrue(try_acquire_lock("scope_e"))

    def test_fails_open_when_backend_errors(self):
        with patch("backend.app.services.job_lock.get_redis_client", side_effect=Exception("boom")):
            self.assertTrue(try_acquire_lock("scope_f"))


class TestProtectedEndpointsReturn409WhenLocked(unittest.TestCase):
    """Each endpoint should reject with 409 if its job scope is already
    locked — using the real in-memory fallback client directly (Redis isn't
    running in this test environment), since these scope names don't
    collide with anything else in the test suite."""

    def setUp(self):
        self.client = TestClient(app)
        app.dependency_overrides[get_db] = lambda: MagicMock()
        # These tests are about the lock, not the internal-key auth layer.
        app.dependency_overrides[require_internal_key] = lambda: None

    def tearDown(self):
        app.dependency_overrides.clear()

    def _assert_409_while_locked(self, scope, method, url, **kwargs):
        self.assertTrue(try_acquire_lock(scope), f"setup: could not acquire {scope}")
        self.addCleanup(release_lock, scope)
        response = getattr(self.client, method)(url, **kwargs)
        self.assertEqual(response.status_code, 409, response.text)

    def test_sync_backfill_returns_409_when_locked(self):
        self._assert_409_while_locked("sync_backfill:119", "post", "/sync/backfill/119")

    def test_sync_backfill_actions_returns_409_when_locked(self):
        self._assert_409_while_locked("sync_backfill_actions", "post", "/sync/backfill-actions")

    def test_ai_backfill_returns_409_when_locked(self):
        self._assert_409_while_locked("ai_backfill", "post", "/ai/backfill")

    def test_digest_daily_returns_409_when_locked(self):
        self._assert_409_while_locked("digest_daily", "post", "/digest/send/daily")

    def test_digest_weekly_returns_409_when_locked(self):
        self._assert_409_while_locked("digest_weekly", "post", "/digest/send/weekly")

    def test_digest_send_test_returns_409_when_locked_for_same_recipient(self):
        self._assert_409_while_locked(
            "digest_send_test:dup@example.com:daily",
            "post",
            "/digest/send-test?email=dup@example.com&frequency=daily",
        )


class TestDailySyncSkipsWhenLocked(unittest.TestCase):
    """process_daily_sync() is triggered from two places (the /sync/daily
    endpoint and the APScheduler cron job), so its lock guard lives inside
    the worker itself rather than at the endpoint — verify it actually
    short-circuits before touching the DB when already locked."""

    def test_process_daily_sync_returns_early_without_opening_a_db_session(self):
        from backend.app.services.daily_sync import process_daily_sync

        self.assertTrue(try_acquire_lock("sync_daily"))
        self.addCleanup(release_lock, "sync_daily")

        with patch("backend.app.services.daily_sync.SessionLocal") as mock_session_local:
            process_daily_sync()  # must return immediately, not raise
            mock_session_local.assert_not_called()


class TestDailySyncReleasesLockOnSetupFailure(unittest.TestCase):
    """Regression test for a bug found in a follow-up audit: the lock used to
    be acquired before the try/finally that releases it, so if setup code
    (SessionLocal(), CongressAPIClient(), or the initial SyncLog commit)
    threw, the lock leaked for its full TTL even though nothing was actually
    running. Verify it's released even when setup fails."""

    def test_lock_released_when_session_local_raises(self):
        from backend.app.services.daily_sync import process_daily_sync

        with patch("backend.app.services.daily_sync.SessionLocal", side_effect=Exception("db unavailable")):
            with self.assertRaises(Exception):
                process_daily_sync()

        # The lock must not still be held — a fresh acquire should succeed.
        self.assertTrue(try_acquire_lock("sync_daily"))
        release_lock("sync_daily")


if __name__ == "__main__":
    unittest.main()
