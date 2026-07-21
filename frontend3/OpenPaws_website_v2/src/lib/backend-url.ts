// Client-safe: only references NEXT_PUBLIC_ env vars which are inlined at build time.
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.NEXT_PUBLIC_ALDF_BACKEND_URL ??
  "http://localhost:8000";
