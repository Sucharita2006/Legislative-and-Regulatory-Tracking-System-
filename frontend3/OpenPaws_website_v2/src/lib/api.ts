import { SignJWT } from "jose";

function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

export const BACKEND_URL =
  normalizeUrl(process.env.BACKEND_URL) ??
  normalizeUrl(process.env.ALDF_BACKEND_URL) ??
  normalizeUrl(process.env.NEXT_PUBLIC_BACKEND_URL) ??
  "http://localhost:8000";

const SERVICE_JWT_SECRET = process.env.ALDF_SERVICE_JWT_SECRET;
const INTERNAL_API_KEY = process.env.ALDF_BACKEND_INTERNAL_KEY;
const SERVICE_JWT_TTL = "60s";

/**
 * Short-lived token proving this call came from our trusted Next.js server on
 * behalf of `email` (already authenticated via Supabase). Signed with the
 * secret shared with the ALDF backend's `require_service_jwt_for_email` /
 * `require_service_token` dependencies — must match the backend's
 * `SERVICE_JWT_SECRET`. Replaces the old static internal-key bearer token: a
 * fresh one is minted per call, it expires in a minute, and it's bound to a
 * specific user rather than being a bearer-anyone-can-replay secret.
 */
async function signServiceToken(email: string): Promise<string> {
  if (!SERVICE_JWT_SECRET) {
    throw new Error("ALDF_SERVICE_JWT_SECRET is not configured.");
  }
  return new SignJWT({ sub: email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SERVICE_JWT_TTL)
    .sign(new TextEncoder().encode(SERVICE_JWT_SECRET));
}

/**
 * Fetch a path on the ALDF backend, authenticated as `email` (the caller's
 * own Supabase session email — every call site must have already verified
 * this itself; this function does not check it).
 */
export async function apiFetch(
  path: string,
  email: string,
  options: RequestInit = {},
): Promise<Response> {
  const isInternalPath = path.startsWith("/digest/");
  const authHeader = isInternalPath
    ? `Bearer ${INTERNAL_API_KEY}`
    : `Bearer ${await signServiceToken(email)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: authHeader,
    ...(options.headers as Record<string, string>),
  };

  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });
}
