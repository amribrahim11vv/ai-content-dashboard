import { apiUrl, ApiError, buildHeaders, parseErrorMessage } from "./httpClient";

export type AdminPlanSubscription = {
  id: string;
  plan_code: "starter" | "early_adopter" | "admin_unlimited";
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
    is_admin: boolean;
  };
  subscriptions: AdminPlanSubscription[];
};

type UpdatePayload = {
  plan_code: "starter" | "early_adopter" | "admin_unlimited";
  status: "active" | "trialing" | "cancelled" | "expired";
  period_start?: string;
  period_end?: string | null;
};

export type AdminUserItem = {
  id: string;
  supabase_user_id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
};

export type AdminUsersResponse = {
  users: AdminUserItem[];
  page: number;
  page_size: number;
  total: number;
};

export async function getAdminUserPlans(userId: string): Promise<AdminPlanSnapshot> {
  const res = await fetch(apiUrl(`/api/admin/plans/${encodeURIComponent(userId)}`), {
    headers: buildHeaders(),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to load user plans"), res.status);
  return res.json() as Promise<AdminPlanSnapshot>;
}

export async function updateAdminUserPlan(userId: string, payload: UpdatePayload): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/plans/${encodeURIComponent(userId)}`), {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to update user plan"), res.status);
}

export async function listAdminUsers(query = "", page = 1, signal?: AbortSignal): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(apiUrl(`/api/admin/users${suffix}`), {
    headers: buildHeaders(),
    signal,
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to load users"), res.status);
  return res.json() as Promise<AdminUsersResponse>;
}

export async function updateAdminUserRole(userId: string, isAdmin: boolean): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(userId)}/role`), {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify({ is_admin: isAdmin }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to update user role"), res.status);
}

export async function updateAdminUserRoleByEmail(email: string, isAdmin: boolean): Promise<{ user_id: string }> {
  const res = await fetch(apiUrl("/api/admin/users/promote-by-email"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ email, is_admin: isAdmin }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to update role by email"), res.status);
  return res.json() as Promise<{ user_id: string }>;
}
