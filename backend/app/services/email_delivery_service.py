"""
Email Delivery Service — Phase 2B

Handles SMTP transport delivery using the project's configured mail settings.
"""
from __future__ import annotations

from fastapi_mail import FastMail, MessageSchema, MessageType
from .mail_config import get_mail_config

async def send_html_email(email_to: str, subject: str, html_content: str) -> None:
    """
    Accepts recipient information, subject header, and rendered HTML body,
    and delivers the message via the configured SMTP server.
    """
    message = MessageSchema(
        subject=subject,
        recipients=[email_to],
        body=html_content,
        subtype=MessageType.html,
    )

    fm = FastMail(get_mail_config())
    await fm.send_message(message)
