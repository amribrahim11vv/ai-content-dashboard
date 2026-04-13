import { getDeviceId } from "../lib/deviceId";
import { apiUrl, ApiError, buildHeaders, parseErrorMessage } from "./httpClient";

export type EntitlementsResponse = {
  authenticated: boolean;
  user_id: string | null;
  email: string;
  display_name: string;
  plan_code: "free" | "creator_pro" | "agency";
  usage: {
    period_key: string;
    kits_used: number;
    retry_used: number;
    regenerate_used: number;
  };
};

export async function getEntitlements(): Promise<EntitlementsResponse> {
  const res = await fetch(apiUrl("/api/auth/me"), {
    headers: buildHeaders(),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to load entitlements"), res.status);
  return res.json() as Promise<EntitlementsResponse>;
}

export async function syncAuthDevice(deviceId = getDeviceId()) {
  const res = await fetch(apiUrl("/api/auth/sync"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ device_id: deviceId }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to sync account"), res.status);
  return res.json() as Promise<{ ok: true }>;
}
