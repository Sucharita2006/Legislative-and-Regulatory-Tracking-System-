import os
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json

class Settings(BaseSettings):
    CONGRESS_API_KEY: str
    DATABASE_URL: str

    # OpenRouter (OpenAI-compatible) settings for the AI processing pipeline.
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    LLM_MODEL: str = Field(
        
        default="anthropic/claude-sonnet-4.5",
        validation_alias=AliasChoices("LLM_MODEL", "OPENROUTER_MODEL"),
    )

    # Optional list of fallback model names (tried in order) if the primary
    # `LLM_MODEL` fails (e.g. provider/model EOL). To avoid strict JSON parsing
    # failures from empty/Railway values, accept a raw string in the env and
    # normalize it after Settings is created. The env can be either a JSON
    # array like '["gpt-4o-mini"]' or a comma-separated string 'gpt-4o-mini,gpt-4o'.
    FALLBACK_LLM_MODELS: str = Field(default="")

    REDIS_URL: str = "redis://localhost:6379"

    # Auth / JWT
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"

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

    # Frontend base URL (used in verification email links)
    FRONTEND_URL: str = "http://localhost:5173"

    # Allow reading from a .env file relative to the project root
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

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
