import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listKits } from "./api";
import type { KitSummary } from "./types";
import { useCompactTable } from "./layout/compactTableContext";

function briefBrand(json: string): string {
  try {
    const o = JSON.parse(json) as { brand_name?: string };
    return o.brand_name ?? "";
  } catch {
    return "";
  }
}

function briefIndustry(json: string): string {
  try {
    const o = JSON.parse(json) as { industry?: string };
    return o.industry ?? "—";
  } catch {
    return "—";
  }
}

function initials(name: string, id: string): string {
  const s = name.trim() || id;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return s.slice(0, 2).toUpperCase() || "—";
}

function statusKind(badge: string): "done" | "running" | "failed" {
  const b = badge.toLowerCase();
  if (b.includes("fail")) return "failed";
  if (b.includes("run")) return "running";
  return "done";
}

export default function GeneratedKitsPage({ adminMode = false }: { adminMode?: boolean }) {
  const compactTable = useCompactTable();
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const thPad = compactTable ? "px-3 py-2 sm:px-6" : "px-4 py-3 sm:px-8 sm:py-4";
  const tdPad = compactTable ? "px-3 py-2.5 sm:px-6 sm:py-3" : "px-4 py-4 sm:px-8 sm:py-6";
  const avSize = compactTable ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-sm";

  useEffect(() => {
    listKits()
      .then(setKits)
      .catch((e) => setErr(String(e)));
  }, []);

  const latestKits = useMemo(() => (kits?.length ? kits.slice(0, 5) : []), [kits]);
  const kitDetailsBase = adminMode ? "/admin/kits/" : "/kits/";

  return (
    <>
      <section className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10 sm:gap-6">
        <div>
          <h2 className="headline mb-2 text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl md:text-5xl">
            Generated kits
          </h2>
          <p className="text-base text-brand-muted dark:text-on-surface-variant sm:text-lg">Browse and open your previously generated content kits.</p>
        </div>
        <Link
          to="/wizard"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:scale-[1.02] hover:bg-brand-primary/90 sm:w-auto sm:px-6 sm:text-sm dark:bg-primary dark:text-on-primary"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New kit
        </Link>
      </section>

      {latestKits.length > 0 && (
        <section className="mb-12" aria-labelledby="latest-kits-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h3 id="latest-kits-heading" className="font-headline text-xl font-bold text-on-surface">
              Latest kits
            </h3>
          </div>
          <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {latestKits.map((k) => {
              const brand = briefBrand(k.brief_json);
              const ind = briefIndustry(k.brief_json);
              const ini = initials(brand, k.id);
              const dt = new Date(k.created_at);
              return (
                <li key={k.id}>
                  <Link
                    to={kitDetailsBase + k.id}
                    className="flex h-full flex-col rounded-2xl border border-brand-sand/30 bg-earth-card p-4 transition hover:border-brand-primary/35 hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-low dark:hover:bg-surface-container-high"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-sand/40 bg-brand-sand/20 text-xs font-bold dark:border-outline/40 dark:bg-surface-container-highest/40">
                        {ini}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-on-surface">{brand || "Kit"}</p>
                        <p className="truncate text-xs text-on-surface-variant">{ind}</p>
                      </div>
                    </div>
                    <p className="mt-auto text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                      {dt.toLocaleDateString()} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-brand-sand/30 bg-earth-card p-1 dark:border-outline/30 dark:bg-surface-container-low">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-earth-alt px-4 py-4 sm:px-8 sm:py-6 dark:bg-surface-container-high/30">
          <h3 className="font-manrope text-lg font-bold sm:text-xl">All generated kits</h3>
        </div>
        <div className="overflow-x-auto">
          {err && (
            <p className="px-4 py-6 text-error sm:px-8" role="alert">
              {err}
            </p>
          )}
          {!kits && !err && <p className="px-4 py-6 text-on-surface-variant sm:px-8">Loading…</p>}
          {kits && kits.length === 0 && !err && (
            <p className="px-4 py-10 text-sm text-on-surface-variant sm:px-8">No kits yet. Start from the wizard.</p>
          )}
          {kits && kits.length > 0 && (
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="border-b border-outline/25 text-xs font-extrabold uppercase tracking-[0.16em] text-on-surface">
                  <th className={thPad + " text-start"}>Brand</th>
                  <th className={thPad + " text-start"}>Industry</th>
                  <th className={thPad + " text-start"}>Date</th>
                  <th className={thPad + " text-start"}>Status</th>
                  <th className={thPad + " text-end"}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/20">
                {kits.map((k) => {
                  const brand = briefBrand(k.brief_json);
                  const ind = briefIndustry(k.brief_json);
                  const ini = initials(brand, k.id);
                  const sk = statusKind(k.status_badge);
                  const dt = new Date(k.created_at);
                  return (
                    <tr key={k.id} className="transition-colors hover:bg-surface-container-high/35">
                      <td className={tdPad + " text-sm"}>
                        <div className={"flex items-center " + (compactTable ? "gap-3" : "gap-4")}>
                          <div
                            className={
                              "flex items-center justify-center rounded-lg border border-tertiary/35 bg-gradient-to-br from-tertiary/30 to-tertiary/10 " +
                              avSize
                            }
                          >
                            <span className="font-bold text-on-surface">{ini}</span>
                          </div>
                          <div>
                            <p className={(compactTable ? "text-xs" : "text-sm") + " font-bold text-on-surface"}>
                              {brand || k.id}
                            </p>
                            <p className="text-xs text-on-surface-variant" dir="ltr">
                              {k.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={tdPad + " text-sm"}>
                        <span className="block text-sm font-semibold text-on-surface">{ind}</span>
                      </td>
                      <td className={tdPad + " text-sm"}>
                        <div className="text-sm">
                          <p className="text-on-surface">{dt.toLocaleDateString()}</p>
                          {!compactTable && <p className="mt-0.5 text-on-surface-variant">{dt.toLocaleTimeString()}</p>}
                        </div>
                      </td>
                      <td className={tdPad + " text-sm"}>
                        {sk === "done" && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-primary dark:border-primary/20 dark:bg-primary/10 dark:text-primary">
                            <span className="h-1 w-1 rounded-full bg-tertiary" />
                            {k.status_badge}
                          </span>
                        )}
                        {sk === "running" && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-brand-sand/40 bg-brand-sand/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-muted dark:border-outline/40 dark:bg-surface-container-highest dark:text-on-surface-variant">
                            <span className="h-1 w-1 animate-pulse rounded-full bg-brand-muted dark:bg-on-surface-variant" />
                            {k.status_badge}
                          </span>
                        )}
                        {sk === "failed" && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-brand-accent/20 bg-brand-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-accent dark:border-error/20 dark:bg-error-container/20 dark:text-error">
                            <span className="h-1 w-1 rounded-full bg-error" />
                            {k.status_badge}
                          </span>
                        )}
                      </td>
                      <td className={tdPad + " text-end"}>
                        <Link
                          to={kitDetailsBase + k.id}
                          className={
                            "rounded-lg bg-brand-primary/10 font-bold uppercase tracking-widest text-brand-primary transition-all hover:bg-brand-primary hover:text-white dark:bg-primary/10 dark:text-primary dark:hover:bg-primary dark:hover:text-on-primary " +
                            (compactTable ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm")
                          }
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

