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

class TestDigestEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.mock_db = MagicMock()
        app.dependency_overrides[get_db] = lambda: self.mock_db

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

if __name__ == "__main__":
    unittest.main()
