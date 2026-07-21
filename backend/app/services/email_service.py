from fastapi_mail import FastMail, MessageSchema, MessageType
from ..config import settings
from .mail_config import get_mail_config


_VALID_ORIGINS = {"frontend", "frontend3"}


async def send_verification_email(email: str, token: str, origin: str = "frontend"):
    """Send an email verification link to the user."""
    # origin comes straight from the /auth/signup request body and gets
    # interpolated unescaped into this email's HTML below (both as an href
    # attribute and as visible text) — constrain it to the known-safe values
    # /auth/verify actually understands, rather than trusting arbitrary input.
    if origin not in _VALID_ORIGINS:
        origin = "frontend"
    verify_url = f"{settings.BACKEND_URL}/auth/verify/{token}?origin={origin}"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #fff; margin: 0; padding: 0; }}
        .container {{ max-width: 560px; margin: 40px auto; background: #121212; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; }}
        .header {{ background: #006C67; padding: 32px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 22px; color: #fff; font-weight: 700; letter-spacing: 0.5px; }}
        .body {{ padding: 40px 32px; }}
        .body p {{ color: #a1a1aa; line-height: 1.7; margin: 0 0 20px; }}
        .btn {{ display: inline-block; background: #006C67; color: #fff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 16px 0; }}
        .footer {{ padding: 20px 32px; border-top: 1px solid #27272a; text-align: center; }}
        .footer p {{ color: #52525b; font-size: 12px; margin: 0; }}
        .token-note {{ background: #1a1a1a; border: 1px solid #27272a; border-radius: 6px; padding: 12px; font-size: 12px; color: #71717a; word-break: break-all; margin-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚖️ ALDF Legislative Tracker</h1>
        </div>
        <div class="body">
          <p>Hi there,</p>
          <p>Thanks for signing up! Please verify your email address to activate your account and gain access to your command center dashboard.</p>
          <p style="text-align:center;">
            <a href="{verify_url}" class="btn">Verify Email Address →</a>
          </p>
          <p>This link will expire in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
          <div class="token-note">
            If the button doesn't work, copy and paste this link into your browser:<br>{verify_url}
          </div>
        </div>
        <div class="footer">
          <p>Animal Legal Defense Fund — Legislative Tracking System</p>
        </div>
      </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="Verify your ALDF account",
        recipients=[email],
        body=html_body,
        subtype=MessageType.html,
    )

    fm = FastMail(get_mail_config())
    await fm.send_message(message)
