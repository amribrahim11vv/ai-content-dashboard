import { useEffect, useMemo, useState } from "react";
import { listKits } from "../api";
import type { KitSummary } from "../types";

function statusKind(badge: string): "done" | "running" | "failed" {
  const b = badge.toLowerCase();
  if (b.includes("fail")) return "failed";
  if (b.includes("run")) return "running";
  return "done";
}

export default function AnalyticsPage() {
  const [kits, setKits] = useState<KitSummary[] | null>(null);

  useEffect(() => {
    listKits().then(setKits).catch(() => setKits([]));
  }, []);

  const stats = useMemo(() => {
    if (!kits?.length) {
      return { total: 0, successRate: 0, failed: 0, running: 0, models: 0 };
    }
    const done = kits.filter((k) => statusKind(k.status_badge) === "done").length;
    const failed = kits.filter((k) => statusKind(k.status_badge) === "failed").length;
    const running = kits.filter((k) => statusKind(k.status_badge) === "running").length;
    const models = new Set(kits.map((k) => k.model_used).filter(Boolean)).size;
    return {
      total: kits.length,
      successRate: Math.round((done / kits.length) * 1000) / 10,
      failed,
      running,
      models,
    };
  }, [kits]);

  return (
    <>
      <div className="mb-10">
        <h1 className="headline text-4xl font-black tracking-tight text-on-surface md:text-5xl">Neural Analytics</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Live signals derived from your kits plus the Stitch neural dashboard layout.
        </p>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="glass-panel rounded-2xl border border-outline-variant/25 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total kits</p>
          <p className="headline mt-2 text-4xl font-black text-on-surface">{kits ? stats.total : "…"}</p>
        </div>
        <div className="glass-panel rounded-2xl border border-tertiary/20 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-tertiary">Success rate</p>
          <p className="headline mt-2 text-4xl font-black text-on-surface">
            {kits?.length ? `${stats.successRate}%` : "—"}
          </p>
        </div>
        <div className="glass-panel rounded-2xl border border-error/20 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-error">Failed</p>
          <p className="headline mt-2 text-4xl font-black text-error">{kits ? stats.failed : "…"}</p>
        </div>
        <div className="glass-panel rounded-2xl border border-secondary/20 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">In flight</p>
          <p className="headline mt-2 text-4xl font-black text-on-surface">{kits ? stats.running : "…"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel lg:col-span-2 rounded-uniform border border-outline-variant/25 p-8">
          <h2 className="headline mb-6 text-xl font-bold">Engagement pulse</h2>
          <div className="flex h-48 items-end gap-2">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-lg bg-primary/40" style={{ height: `${h}%` }} />
            ))}
          </div>
          <p className="mt-4 text-sm text-on-surface-variant">Decorative chart — connect metrics when available.</p>
        </div>
        <div className="glass-panel rounded-uniform border border-outline-variant/25 p-8">
          <h2 className="headline mb-4 text-xl font-bold">Model mix</h2>
          <p className="text-sm text-on-surface-variant">
            Distinct <code className="text-primary">model_used</code> values:{" "}
            <span className="font-bold text-on-surface">{kits ? stats.models : "…"}</span>
          </p>
          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Pipeline health</span>
              <span className="font-bold text-primary">Stable</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full w-3/4 rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
