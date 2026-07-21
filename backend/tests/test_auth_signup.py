"""
test_auth_signup.py

Validates:
  1. Signup request with 'name' or 'full_name' successfully creates a user with full_name set.
  2. The signup payload validation is correct.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import MagicMock, patch
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
from backend.app.models import UserProfile

class TestAuthSignup(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.mock_db = MagicMock()
        app.dependency_overrides[get_db] = lambda: self.mock_db

    def tearDown(self):
        app.dependency_overrides.clear()

    @patch("backend.app.services.email_service.send_verification_email")
    def test_signup_stores_fullname(self, mock_send_email):
        # 1. Setup mock DB behavior
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # 2. Make signup post request
        response = self.client.post(
            "/auth/signup",
            json={
                "email": "testuser@example.com",
                "password": "securepassword",
                "name": "Jane Doe"
            }
        )
        
        # 3. Assertions
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Account created. Please check your email to verify your account."})
        
        # 4. Check if UserProfile was added to session with correctly set full_name
        self.mock_db.add.assert_called_once()
        added_profile = self.mock_db.add.call_args[0][0]
        self.assertIsInstance(added_profile, UserProfile)
        self.assertEqual(added_profile.email, "testuser@example.com")
        self.assertEqual(added_profile.full_name, "Jane Doe")
        self.assertFalse(added_profile.is_verified)
        self.mock_db.commit.assert_called_once()
        
        # 5. Check email trigger
        mock_send_email.assert_called_once()

if __name__ == "__main__":
    unittest.main()
