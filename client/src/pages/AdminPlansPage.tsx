import { useMemo, useState } from "react";
import { getAdminUserPlans, updateAdminUserPlan, type AdminPlanSubscription } from "../api";

const planOptions = [
  { value: "free", label: "Free" },
  { value: "creator_pro", label: "Creator Pro" },
  { value: "agency", label: "Agency" },
] as const;

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
] as const;

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function AdminPlansPage() {
  const [apiSecret, setApiSecret] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    user: { id: string; supabase_user_id: string; email: string; display_name: string };
    subscriptions: AdminPlanSubscription[];
  } | null>(null);

  const [planCode, setPlanCode] = useState<"free" | "creator_pro" | "agency">("free");
  const [planStatus, setPlanStatus] = useState<"active" | "trialing" | "cancelled" | "expired">("active");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const latest = useMemo(() => snapshot?.subscriptions[0] ?? null, [snapshot]);

  const loadPlans = async () => {
    if (!apiSecret.trim() || !userId.trim()) {
      setMessage("API secret and user id are required.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const data = await getAdminUserPlans(userId.trim(), apiSecret.trim());
      setSnapshot(data);
      if (data.subscriptions[0]) {
        const current = data.subscriptions[0];
        setPlanCode(current.plan_code);
        setPlanStatus(current.status);
        setPeriodStart(current.period_start.slice(0, 16));
        setPeriodEnd(current.period_end ? current.period_end.slice(0, 16) : "");
      }
    } catch (e) {
      setSnapshot(null);
      setMessage(e instanceof Error ? e.message : "Failed to load plans.");
    } finally {
      setLoading(false);
    }
  };

  const applyPlan = async () => {
    if (!apiSecret.trim() || !userId.trim()) {
      setMessage("API secret and user id are required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateAdminUserPlan(userId.trim(), apiSecret.trim(), {
        plan_code: planCode,
        status: planStatus,
        period_start: periodStart ? new Date(periodStart).toISOString() : undefined,
        period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
      });
      setMessage("Plan updated successfully.");
      await loadPlans();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to update plan.");
    } finally {
      setSaving(false);
    }
  };

  const applyQuickPlan = async (nextPlan: "creator_pro" | "agency") => {
    setPlanCode(nextPlan);
    setPlanStatus("active");
    setPeriodStart("");
    setPeriodEnd("");
    if (!apiSecret.trim() || !userId.trim()) {
      setMessage("API secret and user id are required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateAdminUserPlan(userId.trim(), apiSecret.trim(), {
        plan_code: nextPlan,
        status: "active",
      });
      setMessage(`Quick upgrade applied: ${nextPlan}.`);
      await loadPlans();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to apply quick upgrade.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="headline text-3xl font-black tracking-tight text-on-surface sm:text-4xl">Plan Management</h1>
        <p className="mt-2 max-w-3xl text-brand-muted dark:text-on-surface-variant">
          Simple admin tool to view and update a user's subscription plan using the existing backend admin endpoint.
        </p>
      </header>

      {message && (
        <div className="rounded-xl border border-brand-sand/30 bg-earth-card px-4 py-3 text-sm text-brand-muted dark:border-outline/30 dark:bg-surface-container-low dark:text-on-surface-variant">
          {message}
        </div>
      )}

      <div className="rounded-uniform border border-brand-sand/30 bg-earth-card p-4 sm:p-6 dark:border-outline/30 dark:bg-surface-container-low">
        <h2 className="headline mb-4 text-xl font-bold">Lookup user</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            API Secret
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
              placeholder="API_SECRET"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            User ID
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
              placeholder="internal user id"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadPlans()}
              disabled={loading}
              className="h-[40px] w-full rounded-xl bg-brand-primary px-4 text-sm font-bold text-white disabled:opacity-60 dark:bg-primary dark:text-on-primary"
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-on-surface-variant">
          Security note: API secret is kept in session memory only and is never stored in localStorage.
        </p>
      </div>

      {snapshot && (
        <>
          <div className="rounded-uniform border border-brand-sand/30 bg-earth-card p-4 sm:p-6 dark:border-outline/30 dark:bg-surface-container-low">
            <h2 className="headline mb-3 text-xl font-bold">User</h2>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p><strong>ID:</strong> {snapshot.user.id}</p>
              <p><strong>Supabase ID:</strong> {snapshot.user.supabase_user_id}</p>
              <p><strong>Email:</strong> {snapshot.user.email || "—"}</p>
              <p><strong>Name:</strong> {snapshot.user.display_name || "—"}</p>
            </div>
          </div>

          <div className="rounded-uniform border border-brand-sand/30 bg-earth-card p-4 sm:p-6 dark:border-outline/30 dark:bg-surface-container-low">
            <h2 className="headline mb-4 text-xl font-bold">Update plan</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Plan
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value as typeof planCode)}
                  className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
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
                  className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
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
                  className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Period end (optional)
                <input
                  type="datetime-local"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void applyPlan()}
                disabled={saving}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60 dark:bg-primary dark:text-on-primary"
              >
                {saving ? "Saving..." : "Apply plan"}
              </button>
              {latest && (
                <p className="text-xs text-on-surface-variant">
                  Current latest: <strong>{latest.plan_code}</strong> / <strong>{latest.status}</strong>
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-outline/20 pt-4">
              <button
                type="button"
                onClick={() => void applyQuickPlan("creator_pro")}
                disabled={saving}
                className="rounded-xl border border-outline/30 bg-surface-container-high px-4 py-2 text-sm font-bold text-on-surface disabled:opacity-60 dark:bg-surface-container-high"
              >
                Quick Upgrade → Creator Pro
              </button>
              <button
                type="button"
                onClick={() => void applyQuickPlan("agency")}
                disabled={saving}
                className="rounded-xl border border-outline/30 bg-surface-container-high px-4 py-2 text-sm font-bold text-on-surface disabled:opacity-60 dark:bg-surface-container-high"
              >
                Quick Upgrade → Agency
              </button>
            </div>
          </div>

          <div className="rounded-uniform border border-brand-sand/30 bg-earth-card p-4 sm:p-6 dark:border-outline/30 dark:bg-surface-container-low">
            <h2 className="headline mb-4 text-xl font-bold">History</h2>
            {snapshot.subscriptions.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No subscriptions found.</p>
            ) : (
              <div className="overflow-auto">
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
            )}
          </div>
        </>
      )}
    </section>
  );
}
