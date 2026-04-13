import { apiUrl, ApiError, parseErrorMessage } from "./httpClient";

export type AdminPlanSubscription = {
  id: string;
  plan_code: "free" | "creator_pro" | "agency";
  status: "active" | "trialing" | "cancelled" | "expired";
  period_start: string;
  period_end: string | null;
  updated_at: string;
};

export type AdminPlanSnapshot = {
  user: {
    id: string;
    supabase_user_id: string;
    email: string;
    display_name: string;
  };
  subscriptions: AdminPlanSubscription[];
};

type UpdatePayload = {
  plan_code: "free" | "creator_pro" | "agency";
  status: "active" | "trialing" | "cancelled" | "expired";
  period_start?: string;
  period_end?: string | null;
};

function adminHeaders(apiSecret: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiSecret.trim()}`,
  };
}

export async function getAdminUserPlans(userId: string, apiSecret: string): Promise<AdminPlanSnapshot> {
  const res = await fetch(apiUrl(`/api/admin/plans/${encodeURIComponent(userId)}`), {
    headers: adminHeaders(apiSecret),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to load user plans"), res.status);
  return res.json() as Promise<AdminPlanSnapshot>;
}

export async function updateAdminUserPlan(userId: string, apiSecret: string, payload: UpdatePayload): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/plans/${encodeURIComponent(userId)}`), {
    method: "PUT",
    headers: adminHeaders(apiSecret),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to update user plan"), res.status);
}
