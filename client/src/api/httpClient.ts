import { getDeviceId } from "../lib/deviceId";
import { getAccessToken } from "../lib/authToken";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const base = import.meta.env.VITE_API_URL ?? "";
const apiSecret = String(import.meta.env.VITE_API_SECRET ?? "").trim();
const supabaseConfigured =
  String(import.meta.env.VITE_SUPABASE_URL ?? "").trim().length > 0 &&
  String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim().length > 0;

export function buildHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getAccessToken();
  // Only allow API secret fallback in environments without Supabase auth configured.
  // When Supabase is configured, routes like /api/auth/sync must receive a real user JWT.
  const fallbackToken = !supabaseConfigured ? apiSecret : "";
  const authorization = token || fallbackToken ? `Bearer ${token || fallbackToken}` : undefined;
  return {
    "Content-Type": "application/json",
    "X-Device-ID": getDeviceId(),
    ...(authorization ? { Authorization: authorization } : {}),
    ...extra,
  };
}

export function apiUrl(path: string) {
  return `${base}${path}`;
}

export async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const j = await res.json().catch(() => ({}));
  return (j as { error?: string }).error ?? fallback;
}
