"""
test_update_user_validation.py

Regression test for a validation gap found in a follow-up audit: PUT
/users/{email} accepted any JSON value for review_bills — the field the new
"Tracked bills" UI writes to — with no check it was even a list. A malformed
payload (e.g. a string or object) would silently corrupt downstream logic in
digest_service.py, which assumes review_bills is a list of strings.
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

from datetime import datetime

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db
from backend.app.config import settings
from backend.app.services.auth import require_internal_key


class FakeProfile:
    def __init__(self):
        self.id = "00000000-0000-0000-0000-000000000000"
        self.email = "user@example.com"
        self.full_name = None
        self.scope = "federal"
        self.review_bills = []
        self.prompts = []
        self.is_verified = True
        self.is_admin = False
        self.created_at = datetime(2026, 1, 1)
        self.updated_at = datetime(2026, 1, 1)


class TestUpdateUserReviewBillsValidation(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.mock_db = MagicMock()
        self.profile = FakeProfile()
        self.mock_db.query.return_value.filter.return_value.first.return_value = self.profile
        from backend.app.services.auth import require_service_jwt_for_email
        app.dependency_overrides[get_db] = lambda: self.mock_db
        app.dependency_overrides[require_internal_key] = lambda: None
        app.dependency_overrides[require_service_jwt_for_email] = lambda: {"sub": "user@example.com"}

    def tearDown(self):
        app.dependency_overrides.clear()

    def _put(self, review_bills):
        return self.client.put(
            "/users/user@example.com",
            json={"review_bills": review_bills},
        )

    def test_rejects_non_list_value(self):
        response = self._put("119-HR-1")  # a string, not a list
        self.assertEqual(response.status_code, 400)

    def test_rejects_list_with_non_string_entries(self):
        response = self._put([{"source_id": "119-HR-1"}])
        self.assertEqual(response.status_code, 400)

    def test_rejects_oversized_list(self):
        response = self._put([f"119-HR-{i}" for i in range(501)])
        self.assertEqual(response.status_code, 400)

    def test_rejects_overly_long_entry(self):
        response = self._put(["x" * 101])
        self.assertEqual(response.status_code, 400)

    def test_accepts_valid_list(self):
        response = self._put(["119-HR-1", "119-S-2"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.profile.review_bills, ["119-HR-1", "119-S-2"])


if __name__ == "__main__":
    unittest.main()
