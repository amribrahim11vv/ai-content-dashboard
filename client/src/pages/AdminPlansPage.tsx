import { useEffect, useMemo, useState } from "react";
import {
  getAdminUserPlans,
  listAdminUsers,
  updateAdminUserPlan,
  updateAdminUserRole,
  updateAdminUserRoleByEmail,
  type AdminPlanSubscription,
  type AdminUserItem,
} from "../api";
import { AdminNotice, AdminPageShell } from "../components/admin/AdminPageShell";
import { useAuth } from "../auth/AuthContext";

const planOptions = [
  { value: "starter", label: "Starter" },
  { value: "early_adopter", label: "Early Adopter" },
  { value: "admin_unlimited", label: "Admin Unlimited" },
] as const;

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
] as const;

type UiMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

function isUnauthorizedErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("unauthorized") || m.includes("auth token");
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function useDebouncedValue<T>(value: T, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, value]);
  return debounced;
}

export default function AdminPlansPage() {
  const { ready, session } = useAuth();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersQuery, setUsersQuery] = useState("");
  const debouncedQuery = useDebouncedValue(usersQuery.trim(), 400);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPageSize, setUsersPageSize] = useState(25);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [message, setMessage] = useState<UiMessage | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [roleEmail, setRoleEmail] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [planLoadError, setPlanLoadError] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    user: { id: string; supabase_user_id: string; email: string; display_name: string; is_admin: boolean };
    subscriptions: AdminPlanSubscription[];
  } | null>(null);

  const [planCode, setPlanCode] = useState<"starter" | "early_adopter" | "admin_unlimited">("starter");
  const [planStatus, setPlanStatus] = useState<"active" | "trialing" | "cancelled" | "expired">("active");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [advancedUserId, setAdvancedUserId] = useState("");

  const latest = useMemo(() => snapshot?.subscriptions[0] ?? null, [snapshot]);
  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) ?? null, [users, selectedUserId]);
  const totalPages = Math.max(1, Math.ceil(usersTotal / usersPageSize));

  const loadUsers = async (page: number, query: string, signal?: AbortSignal) => {
    setUsersLoading(true);
    try {
      const data = await listAdminUsers(query, page, signal);
      setMessage(null);
      setUsers(data.users);
      setUsersPage(data.page);
      setUsersPageSize(data.page_size);
      setUsersTotal(data.total);
      if (!selectedUserId && data.users[0]) {
        setSelectedUserId(data.users[0].id);
      } else if (selectedUserId && !data.users.some((u) => u.id === selectedUserId) && data.users[0]) {
        setSelectedUserId(data.users[0].id);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Failed to load users." });
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      setUsers([]);
      setSnapshot(null);
      setMessage({
        tone: "info",
        text: "Please sign in with your admin account first, then reopen Admin Plans.",
      });
      return;
    }
    const controller = new AbortController();
    void loadUsers(usersPage, debouncedQuery, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, debouncedQuery, usersPage, refreshKey]);

  const loadPlans = async (targetUserId: string) => {
    if (!targetUserId.trim()) return;
    setSnapshotLoading(true);
    setPlanLoadError(null);
    try {
      let data: Awaited<ReturnType<typeof getAdminUserPlans>> | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          data = await getAdminUserPlans(targetUserId);
          break;
        } catch (e) {
          const err = e instanceof Error ? e : new Error("Failed to load plans.");
          lastError = err;
          if (attempt === 0 && isUnauthorizedErrorMessage(err.message)) {
            await new Promise((resolve) => window.setTimeout(resolve, 350));
            continue;
          }
          throw err;
        }
      }

      if (!data) {
        throw lastError ?? new Error("Failed to load plans.");
      }
      setMessage(null);
      setSnapshot(data);
      if (data.subscriptions[0]) {
        const current = data.subscriptions[0];
        setPlanCode(current.plan_code);
        setPlanStatus(current.status);
        setPeriodStart(current.period_start.slice(0, 16));
        setPeriodEnd(current.period_end ? current.period_end.slice(0, 16) : "");
      } else {
        setPlanCode("starter");
        setPlanStatus("active");
        setPeriodStart("");
        setPeriodEnd("");
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : "Failed to load plans.";
      setPlanLoadError(text);
      if (!isUnauthorizedErrorMessage(text) || users.length === 0) {
        setSnapshot(null);
        setMessage({ tone: "error", text });
      }
    } finally {
      setSnapshotLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !session) return;
    if (!selectedUserId) return;
    void loadPlans(selectedUserId);
  }, [ready, session, selectedUserId]);

  const applyRoleByEmail = async (isAdmin: boolean) => {
    if (!roleEmail.trim()) {
      setMessage({ tone: "error", text: "Email is required." });
      return;
    }
    setRoleSaving(true);
    try {
      const data = await updateAdminUserRoleByEmail(roleEmail.trim(), isAdmin);
      setMessage({
        tone: "success",
        text: `Role updated for ${roleEmail.trim()} (${isAdmin ? "admin" : "user"}).`,
      });
      setSelectedUserId(data.user_id);
      setAdvancedUserId(data.user_id);
      setRefreshKey((v) => v + 1);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Failed to update role by email." });
    } finally {
      setRoleSaving(false);
    }
  };

  const toggleRole = async (targetUserId: string, isAdmin: boolean) => {
    setRoleSaving(true);
    try {
      await updateAdminUserRole(targetUserId, isAdmin);
      setMessage({ tone: "success", text: `Admin role ${isAdmin ? "enabled" : "removed"} successfully.` });
      setUsers((prev) => prev.map((u) => (u.id === targetUserId ? { ...u, is_admin: isAdmin } : u)));
      if (snapshot?.user.id === targetUserId) {
        setSnapshot({
          ...snapshot,
          user: {
            ...snapshot.user,
            is_admin: isAdmin,
          },
        });
      }
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Failed to update admin role." });
    } finally {
      setRoleSaving(false);
    }
  };

  const applyPlan = async () => {
    if (!selectedUserId) {
      setMessage({ tone: "error", text: "Select a user first." });
      return;
    }
    setSavingPlan(true);
    try {
      await updateAdminUserPlan(selectedUserId, {
        plan_code: planCode,
        status: planStatus,
        period_start: periodStart ? new Date(periodStart).toISOString() : undefined,
        period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
      });
      setMessage({ tone: "success", text: "Plan updated successfully." });
      await loadPlans(selectedUserId);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Failed to update plan." });
    } finally {
      setSavingPlan(false);
    }
  };

  const applyQuickPlan = async (nextPlan: "early_adopter") => {
    if (!selectedUserId) {
      setMessage({ tone: "error", text: "Select a user first." });
      return;
    }
    setSavingPlan(true);
    try {
      await updateAdminUserPlan(selectedUserId, {
        plan_code: nextPlan,
        status: "active",
      });
      setMessage({ tone: "success", text: `Quick upgrade applied: ${nextPlan}.` });
      await loadPlans(selectedUserId);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Failed to apply quick upgrade." });
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <AdminPageShell
      eyebrow="Plan operations"
      title="Plan Management"
      description="Search users instantly, select a user, then update role and plan from one unified workspace."
      actions={
        <button
          type="button"
          onClick={() => setRefreshKey((v) => v + 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-highest"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Refresh
        </button>
      }
    >
      {message ? <AdminNotice tone={message.tone}>{message.text}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-outline/30 bg-surface-container-low p-4 sm:p-5">
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Search users by email
              <input
                value={usersQuery}
                onChange={(e) => {
                  setUsersQuery(e.target.value);
                  setUsersPage(1);
                }}
                className="mt-2 w-full rounded-xl border border-outline/30 bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35"
                placeholder="name@example.com"
                aria-label="Search users by email"
              />
            </label>

            <div className="grid gap-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Quick role change by email
                <input
                  value={roleEmail}
                  onChange={(e) => setRoleEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-outline/30 bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35"
                  placeholder="admin@example.com"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void applyRoleByEmail(true)}
                  disabled={roleSaving}
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary disabled:opacity-60"
                >
                  Make admin
                </button>
                <button
                  type="button"
                  onClick={() => void applyRoleByEmail(false)}
                  disabled={roleSaving}
                  className="flex-1 rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-sm font-bold text-on-surface disabled:opacity-60"
                >
                  Remove admin
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-outline/20">
            <div className="border-b border-outline/20 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Users {usersLoading ? "(loading...)" : `(${usersTotal})`}
            </div>
            <div className="max-h-[520px] overflow-auto">
              {users.length === 0 && !usersLoading ? (
                <p className="px-3 py-4 text-sm text-on-surface-variant">No users found.</p>
              ) : (
                <ul className="divide-y divide-outline/15">
                  {users.map((u) => {
                    const active = selectedUserId === u.id;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className={[
                            "w-full px-3 py-3 text-left transition hover:bg-surface-container-high",
                            active ? "bg-primary/10" : "",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-on-surface">{u.email || "—"}</p>
                              <p className="truncate text-xs text-on-surface-variant">{u.display_name || "No name"}</p>
                              <p className="mt-1 truncate font-mono text-[10px] text-on-surface-variant">{u.id}</p>
                            </div>
                            <span
                              className={[
                                "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                                u.is_admin ? "bg-primary/15 text-primary" : "bg-surface-container-high text-on-surface-variant",
                              ].join(" ")}
                            >
                              {u.is_admin ? "Admin" : "User"}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-outline/20 px-3 py-2 text-xs">
              <button
                type="button"
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                disabled={usersPage <= 1 || usersLoading}
                className="rounded border border-outline/30 px-2 py-1 font-semibold disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-on-surface-variant">
                Page {usersPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))}
                disabled={usersPage >= totalPages || usersLoading}
                className="rounded border border-outline/30 px-2 py-1 font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {!selectedUserId ? (
            <AdminNotice tone="info">Select a user from the list to view role, subscription and history.</AdminNotice>
          ) : null}

          <div className="rounded-2xl border border-outline/30 bg-surface-container-low p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Selected user</p>
                <h2 className="mt-1 text-lg font-bold text-on-surface">
                  {snapshot?.user.email || selectedUser?.email || "Loading user..."}
                </h2>
                <p className="text-sm text-on-surface-variant">{snapshot?.user.display_name || selectedUser?.display_name || "—"}</p>
                <p className="mt-1 font-mono text-xs text-on-surface-variant">{selectedUserId}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void toggleRole(selectedUserId, true)}
                  disabled={roleSaving || snapshot?.user.is_admin === true}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
                >
                  Make admin
                </button>
                <button
                  type="button"
                  onClick={() => void toggleRole(selectedUserId, false)}
                  disabled={roleSaving || snapshot?.user.is_admin === false}
                  className="rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-sm font-bold text-on-surface disabled:opacity-50"
                >
                  Remove admin
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-outline/30 bg-surface-container-low p-4 sm:p-5">
            <h3 className="text-lg font-bold text-on-surface">Update plan</h3>
            {snapshotLoading ? <p className="mt-2 text-sm text-on-surface-variant">Loading current plan...</p> : null}
            {planLoadError ? <p className="mt-2 text-sm text-error">{planLoadError}</p> : null}

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Plan
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value as typeof planCode)}
                  className="mt-2 w-full rounded-xl border border-outline/30 bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35"
                >
                  {planOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Status
                <select
                  value={planStatus}
                  onChange={(e) => setPlanStatus(e.target.value as typeof planStatus)}
                  className="mt-2 w-full rounded-xl border border-outline/30 bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35"
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Period start (optional)
                <input
                  type="datetime-local"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-outline/30 bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Period end (optional)
                <input
                  type="datetime-local"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-outline/30 bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void applyPlan()}
                disabled={savingPlan || !selectedUserId}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-60"
              >
                {savingPlan ? "Saving..." : "Apply plan"}
              </button>
              <button
                type="button"
                onClick={() => void applyQuickPlan("early_adopter")}
                disabled={savingPlan || !selectedUserId}
                className="rounded-xl border border-outline/30 bg-surface-container-high px-4 py-2 text-sm font-bold text-on-surface disabled:opacity-60"
              >
                Quick Upgrade → Early Adopter
              </button>
              {latest ? (
                <p className="text-xs text-on-surface-variant">
                  Current latest: <strong>{latest.plan_code}</strong> / <strong>{latest.status}</strong>
                </p>
              ) : null}
            </div>
          </div>

          <details className="rounded-2xl border border-outline/30 bg-surface-container-low p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-bold text-on-surface">Advanced: Lookup by user ID</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={advancedUserId}
                onChange={(e) => setAdvancedUserId(e.target.value)}
                className="w-full rounded-xl border border-outline/30 bg-surface-container-high px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35"
                placeholder="internal user id"
              />
              <button
                type="button"
                onClick={() => {
                  const id = advancedUserId.trim();
                  if (!id) return;
                  setSelectedUserId(id);
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary"
              >
                Open user
              </button>
            </div>
          </details>

          <div className="rounded-2xl border border-outline/30 bg-surface-container-low p-4 sm:p-5">
            <h3 className="text-lg font-bold text-on-surface">Subscription history</h3>
            {snapshotLoading ? (
              <p className="mt-2 text-sm text-on-surface-variant">Loading history...</p>
            ) : snapshot?.subscriptions.length ? (
              <div className="mt-3 overflow-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline/25 text-xs uppercase tracking-wider text-on-surface-variant">
                      <th className="px-2 py-2">Plan</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Start</th>
                      <th className="px-2 py-2">End</th>
                      <th className="px-2 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.subscriptions.map((s) => (
                      <tr key={s.id} className="border-b border-outline/10">
                        <td className="px-2 py-2 font-semibold">{s.plan_code}</td>
                        <td className="px-2 py-2">{s.status}</td>
                        <td className="px-2 py-2">{fmtDate(s.period_start)}</td>
                        <td className="px-2 py-2">{fmtDate(s.period_end)}</td>
                        <td className="px-2 py-2">{fmtDate(s.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-on-surface-variant">No subscriptions found for this user.</p>
            )}
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

