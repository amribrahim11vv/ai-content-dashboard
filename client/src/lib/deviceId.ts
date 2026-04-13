const DEVICE_ID_KEY = "social_geni_device_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2; // 2 years

function parseCookie(name: string): string {
  const cookie = typeof document !== "undefined" ? document.cookie : "";
  if (!cookie) return "";
  const parts = cookie.split(";").map((s) => s.trim());
  const match = parts.find((entry) => entry.startsWith(`${name}=`));
  if (!match) return "";
  const raw = match.slice(name.length + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function getLocalStorageValue(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(key) ?? "");
  } catch {
    return "";
  }
}

function setLocalStorageValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage-denied contexts
  }
}

function newDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback UUID-ish generator for rare environments.
  const seed = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2).padEnd(32, "0").slice(0, 32);
  const hex = (seed + random).slice(0, 32).padEnd(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function getDeviceId(): string {
  const fromStorage = getLocalStorageValue(DEVICE_ID_KEY).trim();
  const fromCookie = parseCookie(DEVICE_ID_KEY).trim();
  const existing = fromStorage || fromCookie;
  if (existing) {
    if (!fromStorage) setLocalStorageValue(DEVICE_ID_KEY, existing);
    if (!fromCookie) setCookie(DEVICE_ID_KEY, existing);
    return existing;
  }

  const generated = newDeviceId();
  setLocalStorageValue(DEVICE_ID_KEY, generated);
  setCookie(DEVICE_ID_KEY, generated);
  return generated;
}

