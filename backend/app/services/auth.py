import bcrypt
import secrets
from fastapi import Header, HTTPException
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import uuid

from ..config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    # bcrypt requires bytes
    salt = bcrypt.gensalt()
    pwd_bytes = password.encode('utf-8')
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def generate_verification_token() -> str:
    return str(uuid.uuid4())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def require_internal_key(authorization: Optional[str] = Header(None)) -> None:
    """Dependency guarding admin/pipeline-trigger endpoints (backfill, purge,
    AI reprocessing, digest sends). Requires `Authorization: Bearer <key>`
    matching `settings.INTERNAL_API_KEY`.

    Fails closed: if the key isn't configured on the server, every protected
    route is rejected rather than left open.
    """
    if not settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="INTERNAL_API_KEY is not configured on this server; this endpoint is disabled.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    provided = authorization[len("Bearer "):].strip()
    if not secrets.compare_digest(provided, settings.INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid internal API key")


def _decode_service_jwt(authorization: Optional[str]) -> dict:
    if not settings.SERVICE_JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="SERVICE_JWT_SECRET is not configured on this server; this endpoint is disabled.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization[len("Bearer "):].strip()
    try:
        return jwt.decode(token, settings.SERVICE_JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired service token")


def require_service_token(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency guarding backend calls made by the trusted Next.js server on
    behalf of a specific user. Verifies a short-lived HS256 JWT the frontend
    signs with `settings.SERVICE_JWT_SECRET` and returns its claims (`sub` is
    the email the frontend already authenticated via Supabase).

    Use this directly only where there's no `{email}` path parameter to bind
    to (e.g. user creation, where the email is in the body) — the route must
    then compare `payload["sub"]` against the body's email itself. Routes with
    an `{email}` path parameter should use `require_service_jwt_for_email`
    instead, which enforces that binding automatically.
    """
    return _decode_service_jwt(authorization)


def require_service_jwt_for_email(email: str, authorization: Optional[str] = Header(None)) -> dict:
    """Like `require_service_token`, but also enforces that the JWT's `sub`
    claim matches the `{email}` path parameter, so a valid token minted for
    one user can't be replayed against another user's data — unlike
    `require_internal_key`, which lets any key holder act as any email."""
    payload = _decode_service_jwt(authorization)
    if str(payload.get("sub", "")).lower() != email.lower():
        raise HTTPException(status_code=403, detail="Token does not authorize this email")
    return payload
