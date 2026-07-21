"""
test_email_service.py

Regression test for a validation gap found in a follow-up audit:
send_verification_email() interpolated the `origin` request param (fully
client-controlled via /auth/signup's request body) directly, unescaped, into
raw HTML — both as an href attribute and as visible text. Verify it's now
constrained to the known-safe values /auth/verify actually understands.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "postgresql://test_dummy")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from backend.app.services.email_service import send_verification_email


class TestSendVerificationEmailOriginValidation(unittest.IsolatedAsyncioTestCase):

    async def _send_and_capture_body(self, origin):
        with patch("backend.app.services.email_service.FastMail") as mock_fastmail_cls:
            mock_fm_instance = MagicMock()
            mock_fm_instance.send_message = AsyncMock()
            mock_fastmail_cls.return_value = mock_fm_instance

            await send_verification_email("user@example.com", "sometoken", origin=origin)

            message_arg = mock_fm_instance.send_message.call_args[0][0]
            return message_arg.body

    async def test_malicious_origin_is_normalized_to_frontend(self):
        malicious = '"><script>alert(1)</script>'
        body = await self._send_and_capture_body(malicious)
        self.assertNotIn(malicious, body)
        self.assertIn("origin=frontend", body)
        self.assertNotIn("<script>", body)

    async def test_valid_frontend3_origin_passes_through(self):
        body = await self._send_and_capture_body("frontend3")
        self.assertIn("origin=frontend3", body)

    async def test_valid_frontend_origin_passes_through(self):
        body = await self._send_and_capture_body("frontend")
        self.assertIn("origin=frontend", body)

    async def test_unrecognized_origin_defaults_to_frontend(self):
        body = await self._send_and_capture_body("some-other-value")
        self.assertIn("origin=frontend", body)
        self.assertNotIn("origin=some-other-value", body)


if __name__ == "__main__":
    unittest.main()
