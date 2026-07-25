import os
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json

class Settings(BaseSettings):
    CONGRESS_API_KEY: str
    DATABASE_URL: str

    # OpenRouter (OpenAI-compatible) settings for AI processing pipelines.
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Scanning pipeline LLM (Gemini via OpenRouter)
    SCANNING_LLM_MODEL: str = Field(
        default="google/gemini-2.5-flash",
        validation_alias=AliasChoices("SCANNING_LLM_MODEL", "LLM_MODEL", "OPENROUTER_MODEL"),
    )

    # Email Digest generation LLM (Claude Opus via OpenRouter)
    DIGEST_LLM_MODEL: str = Field(
        default="anthropic/claude-3-opus",
        validation_alias=AliasChoices("DIGEST_LLM_MODEL"),
    )

    # Alias for backward compatibility
    @property
    def LLM_MODEL(self) -> str:
        return self.SCANNING_LLM_MODEL

    # Optional list of fallback model names (tried in order) if the primary
    # `SCANNING_LLM_MODEL` fails (e.g. provider/model EOL). To avoid strict JSON parsing
    # failures from empty/Railway values, accept a raw string in the env and
    # normalize it after Settings is created. The env can be either a JSON
    # array like '["gpt-4o-mini"]' or a comma-separated string 'gpt-4o-mini,gpt-4o'.
    FALLBACK_LLM_MODELS: str = Field(default="")

    REDIS_URL: str = "redis://localhost:6379"

    # Auth / JWT — required, no insecure default. Must be a long random
    # string, set independently in every environment (local .env, Railway).
    SECRET_KEY: str

    # Shared secret required to call admin/pipeline-trigger endpoints (backfill,
    # purge, AI reprocessing, digest sends). Empty means those routes are locked
    # (fail closed) until an operator configures this.
    INTERNAL_API_KEY: str = ""

    # Shared secret used to verify short-lived service JWTs the Next.js
    # frontend signs per-request for the user-scoped /users/* routes. Separate
    # from SECRET_KEY (this backend's own /auth/login tokens) so a leak of one
    # doesn't compromise the other. Empty means those routes are locked (fail
    # closed) until an operator configures this.
    SERVICE_JWT_SECRET: str = ""

    # Email / SMTP (for verification emails)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # Backend public URL (used in verification email links — must be the Railway URL in production)
    BACKEND_URL: str = "http://localhost:8000"

    # Email Digest pipeline configuration
    DIGEST_MAX_ITEMS: int = 10
    DIGEST_WINDOW_DAILY_HOURS: int = 24
    DIGEST_WINDOW_WEEKLY_DAYS: int = 7

    # Frontend base URL (used in post-verification redirects)
    FRONTEND_URL: str = "http://localhost:5173"

    # Rate limiting for AI-costing search endpoints (per identity per minute).
    RATE_LIMIT_SEARCH_PER_MINUTE: int = 20

    # Allow reading from a .env file relative to the project root
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Reject the old placeholder value and anything too short to be a real
# secret, in case someone copies the historical insecure default back in.
_INSECURE_SECRET_KEYS = {"change-me-in-production-use-a-long-random-string"}
if settings.SECRET_KEY in _INSECURE_SECRET_KEYS or len(settings.SECRET_KEY) < 16:
    raise RuntimeError(
        "SECRET_KEY is missing or insecure. Set a long random value via the "
        "SECRET_KEY environment variable in every environment (it must not "
        "be the old placeholder default)."
    )

# Normalize `FALLBACK_LLM_MODELS` into a runtime list. Support JSON array
# or comma-separated env value. If empty, result will be an empty list.
raw_fb = settings.FALLBACK_LLM_MODELS or ""
try:
    parsed = json.loads(raw_fb) if raw_fb else []
    if isinstance(parsed, list):
        settings.FALLBACK_LLM_MODELS = [str(x) for x in parsed]
    elif isinstance(parsed, str) and parsed:
        settings.FALLBACK_LLM_MODELS = [parsed]
    else:
        settings.FALLBACK_LLM_MODELS = []
except Exception:
    # Fallback to comma-split parsing
    settings.FALLBACK_LLM_MODELS = [s.strip() for s in raw_fb.split(",") if s.strip()]
