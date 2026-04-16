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
        setPlanCode(current.plan_code as any);
        setPlanStatus(current.status as any);
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
      if (!isUnauthorizedErrorMessage(text)) {
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
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Plan Management</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Search users instantly, update roles, and manage subscriptions from one unified workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((v) => v + 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm transition hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </header>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-sm flex items-center gap-2 ${
          message.tone === 'success' ? 'border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 
          message.tone === 'error' ? 'border-red-200/50 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' :
          'border-blue-200/50 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
        }`}>
           <span className="material-symbols-outlined text-[18px]">
             {message.tone === 'success' ? 'check_circle' : message.tone === 'error' ? 'error' : 'info'}
           </span>
           {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-4 sm:p-5 shadow-sm">
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Search Users By Email
              <input
                value={usersQuery}
                onChange={(e) => {
                  setUsersQuery(e.target.value);
                  setUsersPage(1);
                }}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white/30 focus:outline-none transition-all shadow-sm"
                placeholder="name@example.com"
                aria-label="Search users by email"
              />
            </label>

            <div className="grid gap-2 pt-4 border-t border-gray-100 dark:border-white/5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Quick Role Change By Email
                <input
                  value={roleEmail}
                  onChange={(e) => setRoleEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white/30 focus:outline-none transition-all shadow-sm"
                  placeholder="admin@example.com"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void applyRoleByEmail(true)}
                  disabled={roleSaving}
                  className="flex-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black px-3 py-2 text-xs font-bold disabled:opacity-60 hover:opacity-90 transition-opacity shadow-sm"
                >
                  Make Admin
                </button>
                <button
                  type="button"
                  onClick={() => void applyRoleByEmail(false)}
                  disabled={roleSaving}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111] px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 disabled:opacity-60 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors shadow-sm"
                >
                  Remove Admin
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black overflow-hidden shadow-sm">
            <div className="border-b border-gray-200 dark:border-white/10 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-white/5">
              Users {usersLoading ? "(loading...)" : `(${usersTotal})`}
            </div>
            <div className="max-h-[520px] overflow-auto custom-scrollbar">
              {users.length === 0 && !usersLoading ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No users found.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                  {users.map((u) => {
                    const active = selectedUserId === u.id;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className={`w-full px-4 py-3 text-left transition-colors ${
                            active ? "bg-white dark:bg-[#1a1a1a] border-l-2 border-l-gray-900 dark:border-l-white" : "hover:bg-white/60 dark:hover:bg-[#141414] border-l-2 border-l-transparent"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{u.email || "—"}</p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{u.display_name || "No name"}</p>
                              <p className="mt-1 truncate font-mono text-[10px] text-gray-400 dark:text-gray-500">{u.id}</p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                                u.is_admin ? "bg-gray-900 dark:bg-white text-white dark:text-black" : "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400"
                              }`}
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
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-white/10 px-3 py-2 text-xs bg-white/50 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                disabled={usersPage <= 1 || usersLoading}
                className="rounded border border-gray-200 dark:border-white/10 px-2 py-1 font-semibold disabled:opacity-50 hover:bg-white dark:hover:bg-white/5"
              >
                Previous
              </button>
              <span className="text-gray-500 dark:text-gray-400 font-medium">
                Page {usersPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))}
                disabled={usersPage >= totalPages || usersLoading}
                className="rounded border border-gray-200 dark:border-white/10 px-2 py-1 font-semibold disabled:opacity-50 hover:bg-white dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {!selectedUserId ? (
            <div className="rounded-xl border border-blue-200/50 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-700 dark:text-blue-400 shadow-sm flex items-center gap-2">
               <span className="material-symbols-outlined text-[18px]">info</span>
               Select a user from the list to view role, subscription and history.
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-500">Selected User</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {snapshot?.user.email || selectedUser?.email || "Loading user..."}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{snapshot?.user.display_name || selectedUser?.display_name || "—"}</p>
                <p className="mt-1.5 font-mono text-[11px] text-gray-400 dark:text-gray-500">{selectedUserId}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => void toggleRole(selectedUserId, true)}
                  disabled={roleSaving || snapshot?.user.is_admin === true}
                  className="rounded-xl bg-gray-900 dark:bg-white px-4 py-2 text-sm font-bold text-white dark:text-black shadow-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  Make Admin
                </button>
                <button
                  type="button"
                  onClick={() => void toggleRole(selectedUserId, false)}
                  disabled={roleSaving || snapshot?.user.is_admin === false}
                  className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111] px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 shadow-sm disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  Remove Admin
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Update Plan</h3>
            {snapshotLoading ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading current plan...</p> : null}
            {planLoadError ? <p className="text-sm text-red-500">{planLoadError}</p> : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Plan
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value as typeof planCode)}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-3 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-gray-900 dark:focus:ring-white/30 focus:outline-none"
                >
                  {planOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Status
                <select
                  value={planStatus}
                  onChange={(e) => setPlanStatus(e.target.value as typeof planStatus)}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-3 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-gray-900 dark:focus:ring-white/30 focus:outline-none"
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Period Start (optional)
                <input
                  type="datetime-local"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-gray-900 dark:focus:ring-white/30 focus:outline-none"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Period End (optional)
                <input
                  type="datetime-local"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-gray-900 dark:focus:ring-white/30 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-gray-100 dark:border-white/10 pt-5">
              <button
                type="button"
                onClick={() => void applyPlan()}
                disabled={savingPlan || !selectedUserId}
                className="rounded-xl bg-gray-900 dark:bg-white px-5 py-2.5 text-sm font-bold text-white dark:text-black shadow-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {savingPlan ? "Saving..." : "Apply Plan"}
              </button>
              <button
                type="button"
                onClick={() => void applyQuickPlan("early_adopter")}
                disabled={savingPlan || !selectedUserId}
                className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 shadow-sm disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                Quick Upgrade → Early Adopter
              </button>
              {latest ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Current latest: <strong className="text-gray-900 dark:text-white">{latest.plan_code}</strong> / <strong className="text-gray-900 dark:text-white">{latest.status}</strong>
                </p>
              ) : null}
            </div>
          </div>

          <details className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-4 sm:p-5 shadow-sm group">
            <summary className="cursor-pointer text-sm font-bold text-gray-900 dark:text-white select-none list-none flex items-center justify-between">
              Advanced: Lookup by User ID
              <span className="material-symbols-outlined text-gray-400 group-open:-scale-100 transition-transform">expand_more</span>
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={advancedUserId}
                onChange={(e) => setAdvancedUserId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-gray-900 dark:focus:ring-white/30 focus:outline-none"
                placeholder="internal user id"
              />
              <button
                type="button"
                onClick={() => {
                  const id = advancedUserId.trim();
                  if (!id) return;
                  setSelectedUserId(id);
                }}
                className="rounded-xl bg-gray-900 dark:bg-white px-5 py-2 text-sm font-bold text-white dark:text-black shadow-sm hover:opacity-90"
              >
                Open User
              </button>
            </div>
          </details>

          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-0 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-white/5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Subscription History</h3>
            </div>
            <div className="p-0">
              {snapshotLoading ? (
                <p className="p-5 text-sm text-gray-500 dark:text-gray-400">Loading history...</p>
              ) : snapshot?.subscriptions.length ? (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-black/50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-5 py-3">Plan</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Start</th>
                        <th className="px-5 py-3">End</th>
                        <th className="px-5 py-3">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {snapshot.subscriptions.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{s.plan_code}</td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                             <span className={`inline-flex px-2 rounded-full text-[10px] font-bold uppercase ${
                               s.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                             }`}>
                               {s.status}
                             </span>
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-400 font-mono text-[11px]">{fmtDate(s.period_start)}</td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-400 font-mono text-[11px]">{fmtDate(s.period_end)}</td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-400 font-mono text-[11px]">{fmtDate(s.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-5 text-sm text-gray-500 dark:text-gray-400">No subscriptions found for this user.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
