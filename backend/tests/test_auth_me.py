"""
test_auth_me.py

Validates GET /auth/me:
  1. Missing/malformed Authorization header -> 401.
  2. Invalid or garbage token -> 401.
  3. Valid token but no matching profile -> 404.
  4. Valid token with a matching profile -> 200 with the profile payload.
"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime
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
from backend.app.services.auth import create_access_token


class FakeProfile:
    def __init__(self, email: str):
        self.id = "00000000-0000-0000-0000-000000000000"
        self.email = email
        self.full_name = "Test User"
        self.scope = "federal"
        self.review_bills = []
        self.prompts = []
        self.is_verified = True
        self.is_admin = False
        self.created_at = datetime(2026, 1, 1)
        self.updated_at = datetime(2026, 1, 1)


class TestAuthMe(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_rejects_missing_header(self):
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_rejects_malformed_header(self):
        response = self.client.get("/auth/me", headers={"Authorization": "Token abc"})
        self.assertEqual(response.status_code, 401)

    def test_rejects_invalid_token(self):
        response = self.client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
        self.assertEqual(response.status_code, 401)

    def test_valid_token_no_matching_profile(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[get_db] = lambda: mock_db

        token = create_access_token({"sub": "ghost@example.com"})
        response = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(response.status_code, 404)

    def test_valid_token_returns_profile(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = FakeProfile("user@example.com")
        app.dependency_overrides[get_db] = lambda: mock_db

        token = create_access_token({"sub": "user@example.com"})
        response = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "user@example.com")


if __name__ == "__main__":
    unittest.main()
