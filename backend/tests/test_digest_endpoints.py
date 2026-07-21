"""
test_digest_endpoints.py

Validates:
  1. POST /digest/send/daily compiles and sends daily digests.
  2. POST /digest/send/weekly compiles and sends weekly digests.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from pathlib import Path

# Allow imports from project root
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db
from backend.app.services.auth import require_internal_key

class TestDigestEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.mock_db = MagicMock()
        app.dependency_overrides[get_db] = lambda: self.mock_db
        # These routes require an internal API key in production; bypass it
        # here since these tests are about the digest pipeline, not auth.
        app.dependency_overrides[require_internal_key] = lambda: None

    def tearDown(self):
        app.dependency_overrides.clear()

    @patch("backend.app.main.SessionLocal")
    @patch("backend.app.services.digest_service.compile_digests")
    @patch("backend.app.services.email_render_service.render_digest_html")
    @patch("backend.app.services.email_delivery_service.send_html_email", new_callable=AsyncMock)
    def test_trigger_daily_digest(self, mock_send_email, mock_render, mock_compile, mock_session_local):
        # 1. Setup mock payloads
        mock_session_local.return_value = self.mock_db
        mock_compile.return_value = [
            {
                "recipient": {"email": "user1@example.com"},
                "digest_metadata": {"generated_at": "2026-06-15T00:00:00"}
            }
        ]
        mock_render.return_value = "<html>Daily Digest</html>"

        # 2. Call endpoint
        response = self.client.post("/digest/send/daily")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Daily digest email sending started in background."})

        # 3. Check bg task results
        mock_compile.assert_called_once_with(self.mock_db, "daily")
        mock_render.assert_called_once()
        mock_send_email.assert_called_once_with("user1@example.com", "ALDF Daily Digest — 2026-06-15", "<html>Daily Digest</html>")

    @patch("backend.app.main.SessionLocal")
    @patch("backend.app.services.digest_service.compile_digests")
    @patch("backend.app.services.email_render_service.render_digest_html")
    @patch("backend.app.services.email_delivery_service.send_html_email", new_callable=AsyncMock)
    def test_trigger_weekly_digest(self, mock_send_email, mock_render, mock_compile, mock_session_local):
        # 1. Setup mock payloads
        mock_session_local.return_value = self.mock_db
        mock_compile.return_value = [
            {
                "recipient": {"email": "user2@example.com"},
                "digest_metadata": {"generated_at": "2026-06-15T00:00:00"}
            }
        ]
        mock_render.return_value = "<html>Weekly Digest</html>"

        # 2. Call endpoint
        response = self.client.post("/digest/send/weekly")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Weekly digest email sending started in background."})

        # 3. Check bg task results (run sync by TestClient)
        mock_compile.assert_called_once_with(self.mock_db, "weekly")
        mock_render.assert_called_once()
        mock_send_email.assert_called_once_with("user2@example.com", "ALDF Weekly Digest — 2026-06-15", "<html>Weekly Digest</html>")

    @patch("backend.app.services.digest_service.compile_single_digest")
    @patch("backend.app.services.email_render_service.render_digest_html")
    @patch("backend.app.services.email_delivery_service.send_html_email", new_callable=AsyncMock)
    def test_send_test_digest_success(self, mock_send_email, mock_render, mock_compile_single):
        # 1. Setup mocks
        mock_compile_single.return_value = {
            "recipient": {"email": "testuser@example.com"},
            "digest_metadata": {"generated_at": "2026-06-15T00:00:00"}
        }
        mock_render.return_value = "<html>Test Digest</html>"

        # 2. Call endpoint
        response = self.client.post("/digest/send-test?email=testuser@example.com&frequency=daily")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Test email sent successfully to testuser@example.com."})

        # 3. Check mocks
        mock_compile_single.assert_called_once_with(self.mock_db, "testuser@example.com", "daily", prompt_id=None)
        mock_render.assert_called_once()
        mock_send_email.assert_called_once_with("testuser@example.com", "ALDF Test Daily Briefing", "<html>Test Digest</html>")

    @patch("backend.app.services.digest_service.compile_single_digest")
    def test_send_test_digest_user_not_found(self, mock_compile_single):
        mock_compile_single.return_value = None

        response = self.client.post("/digest/send-test?email=nonexistent@example.com&frequency=daily")
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found or has no tracking interests", response.json()["detail"])

if __name__ == "__main__":
    unittest.main()
