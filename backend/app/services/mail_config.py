"""Shared SMTP connection config, used by every email sender in the app
(verification emails in email_service.py, digest emails via
email_delivery_service.py). Split out from email_service.py, which is really
about composing verification emails specifically — a reader looking for the
shared mail config there, or expecting it in the "delivery" module instead,
would have been misled either way.
"""
from fastapi_mail import ConnectionConfig
from ..config import settings


def get_mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.SMTP_USER,
        MAIL_PASSWORD=settings.SMTP_PASSWORD,
        MAIL_FROM=settings.SMTP_FROM,
        MAIL_PORT=settings.SMTP_PORT,
        MAIL_SERVER=settings.SMTP_HOST,
        MAIL_FROM_NAME="ALDF Legislative Tracker",
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )
