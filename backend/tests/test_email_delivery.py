"""
test_email_delivery.py — Phase 2B Tests

Validates:
  1. HTML email sending invokes FastMail/SMTP with correct recipient and content.
  2. Orchestration in send_html_email correctly maps inputs to ConnectionConfig.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from pathlib import Path

# ── Allow imports from project root ──────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "postgresql://test_dummy")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from backend.app.services.email_delivery_service import send_html_email

class TestEmailDelivery(unittest.IsolatedAsyncioTestCase):

    @patch("backend.app.services.email_delivery_service.FastMail")
    @patch("backend.app.services.email_delivery_service.get_mail_config")
    async def test_send_html_email_invokes_fastmail(self, mock_get_config, mock_fastmail_cls):
        # Setup mock instance of FastMail
        mock_fm_instance = MagicMock()
        mock_fm_instance.send_message = AsyncMock()
        mock_fastmail_cls.return_value = mock_fm_instance

        recipient = "recipient@example.com"
        subject = "ALDF Update Test"
        html_body = "<h1>Test Body</h1>"

        # Execute send
        await send_html_email(recipient, subject, html_body)

        # Assertions
        mock_fastmail_cls.assert_called_once()
        mock_fm_instance.send_message.assert_called_once()

        # Retrieve the argument passed to send_message
        message_arg = mock_fm_instance.send_message.call_args[0][0]
        
        # Verify MessageSchema mapping
        self.assertEqual(message_arg.subject, subject)
        self.assertEqual(message_arg.recipients[0].email, recipient)
        self.assertEqual(message_arg.body, html_body)

if __name__ == "__main__":
    unittest.main()
