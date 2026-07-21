"""
test_internal_auth.py

Validates the `require_internal_key` dependency that guards admin/pipeline
endpoints (backfill, purge, AI reprocessing, digest sends) and the `/users/*`
resource (profile, prompts, review-bills, tags):
  1. Requests are rejected with 503 when INTERNAL_API_KEY isn't configured.
  2. Requests without a valid Authorization header are rejected with 401.
  3. Requests with the correct `Bearer <key>` header are allowed through.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import MagicMock
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db
from backend.app.config import settings


class TestInternalAuth(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        app.dependency_overrides[get_db] = lambda: MagicMock()
        self._original_key = settings.INTERNAL_API_KEY

    def tearDown(self):
        app.dependency_overrides.clear()
        settings.INTERNAL_API_KEY = self._original_key

    def test_locked_when_key_not_configured(self):
        settings.INTERNAL_API_KEY = ""
        response = self.client.post("/admin/clear-all-data")
        self.assertEqual(response.status_code, 503)

    def test_rejects_missing_authorization_header(self):
        settings.INTERNAL_API_KEY = "correct-key"
        response = self.client.post("/admin/clear-all-data")
        self.assertEqual(response.status_code, 401)

    def test_rejects_wrong_key(self):
        settings.INTERNAL_API_KEY = "correct-key"
        response = self.client.post(
            "/admin/clear-all-data",
            headers={"Authorization": "Bearer wrong-key"},
        )
        self.assertEqual(response.status_code, 401)

    def test_accepts_correct_key(self):
        settings.INTERNAL_API_KEY = "correct-key"
        response = self.client.post(
            "/admin/clear-all-data",
            headers={"Authorization": "Bearer correct-key"},
        )
        self.assertEqual(response.status_code, 200)

    def test_users_routes_require_key(self):
        """Spot-check a representative sample of the /users/* family — this
        resource is a common place to add a new route and forget the
        dependency, so cover more than one endpoint."""
        settings.INTERNAL_API_KEY = "correct-key"
        protected_calls = [
            ("GET", "/users/someone@example.com"),
            ("GET", "/users/someone@example.com/prompts"),
            ("GET", "/users/someone@example.com/tags"),
            ("POST", "/users/someone@example.com/bills/119-HR-1/tags"),
        ]
        for method, url in protected_calls:
            with self.subTest(method=method, url=url):
                response = self.client.request(method, url)
                self.assertEqual(
                    response.status_code, 401,
                    f"{method} {url} should require the internal key",
                )

    def test_users_route_accepts_correct_key(self):
        settings.INTERNAL_API_KEY = "correct-key"
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[get_db] = lambda: mock_db
        response = self.client.get(
            "/users/someone@example.com",
            headers={"Authorization": "Bearer correct-key"},
        )
        # Auth passed; a 404 here means it reached real business logic
        # (no matching profile in the mocked DB), not the auth dependency.
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
