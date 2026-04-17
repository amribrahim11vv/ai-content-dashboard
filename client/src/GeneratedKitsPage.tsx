import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listKits } from "./api";
import type { KitSummary } from "./types";
import { useCompactTable } from "./layout/compactTableContext";
import { briefBrand, briefIndustry } from "./kitSearchUtils";
import { statusKind } from "./kitUiFormatters";

function initials(name: string, id: string): string {
  const s = name.trim() || id;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return s.slice(0, 2).toUpperCase() || "—";
}

function formatTokens(total?: number): string {
  const value = typeof total === "number" ? total : 0;
  return value.toLocaleString();
}

export default function GeneratedKitsPage({ adminMode = false }: { adminMode?: boolean }) {
  const compactTable = useCompactTable();
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const thPad = compactTable ? "px-4 py-3" : "px-6 py-4";
  const tdPad = compactTable ? "px-4 py-3" : "px-6 py-5";
  const avSize = compactTable ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-sm";

  useEffect(() => {
    listKits(adminMode)
      .then(setKits)
      .catch((e) => setErr(String(e)));
  }, [adminMode]);

  const latestKits = useMemo(() => (kits?.length ? kits.slice(0, 5) : []), [kits]);
  const kitDetailsBase = adminMode ? "/admin/kits/" : "/kits/";

  return (
    <>
      <section className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Generated Kits
          </h2>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">Browse and open your previously generated content kits.</p>
        </div>
        <Link
          to="/wizard"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 sm:w-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Kit
        </Link>
      </section>

      {latestKits.length > 0 && (
        <section className="mb-12" aria-labelledby="latest-kits-heading">
          <div className="mb-4">
            <h3 id="latest-kits-heading" className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Recent Work
            </h3>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {latestKits.map((k) => {
              const brand = briefBrand(k.brief_json);
              const ind = briefIndustry(k.brief_json);
              const ini = initials(brand, k.id);
              const dt = new Date(k.created_at);
              return (
                <li key={k.id}>
                  <Link
                    to={kitDetailsBase + k.id}
                    className="flex h-full flex-col rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-5 shadow-sm transition-all hover:border-gray-300 dark:hover:border-white/20 hover:shadow-md"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white border border-gray-200 dark:border-white/5">
                        {ini}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">{brand || "Untitled Kit"}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{ind}</p>
                      </div>
                    </div>
                    <p className="mt-auto text-[11px] font-medium text-gray-400 dark:text-gray-500">
                      {dt.toLocaleDateString()} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {adminMode && (
                      <p className="mt-2 inline-flex w-fit rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:border-white/10 dark:text-gray-300">
                        Tokens: {formatTokens(k.total_tokens)}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#161616] px-6 py-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Kits</h3>
        </div>
        <div className="overflow-x-auto">
          {err && (
            <p className="px-6 py-8 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              Error: {err}
            </p>
          )}
          {!kits && !err && <div className="px-6 py-10 animate-pulse flex space-x-4">
            <div className="h-4 w-1/4 bg-gray-200 dark:bg-white/5 rounded"></div>
          </div>}
          {kits && kits.length === 0 && !err && (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
               <span className="material-symbols-outlined text-[48px] text-gray-300 dark:text-white/10 mb-4">inventory_2</span>
               <p className="text-sm font-medium text-gray-900 dark:text-white">No kits generated yet</p>
               <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Launch a new campaign to see it here.</p>
            </div>
          )}
          {kits && kits.length > 0 && (
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-[#161616]">
                  <th className={thPad + " text-start font-medium"}>Brand</th>
                  <th className={thPad + " text-start font-medium"}>Industry</th>
                  <th className={thPad + " text-start font-medium"}>Date</th>
                  <th className={thPad + " text-start font-medium"}>Status</th>
                  {adminMode && <th className={thPad + " text-start font-medium"}>Tokens</th>}
                  <th className={thPad + " text-end font-medium"}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {kits.map((k) => {
                  const brand = briefBrand(k.brief_json);
                  const ind = briefIndustry(k.brief_json);
                  const ini = initials(brand, k.id);
                  const sk = statusKind(k.status_badge);
                  const dt = new Date(k.created_at);
                  return (
                    <tr key={k.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] group">
                      <td className={tdPad}>
                        <div className={"flex items-center " + (compactTable ? "gap-3" : "gap-4")}>
                          <div
                            className={
                              "flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5 " +
                              avSize
                            }
                          >
                            <span className="font-semibold">{ini}</span>
                          </div>
                          <div>
                            <p className={(compactTable ? "text-sm" : "text-base") + " font-semibold text-gray-900 dark:text-white"}>
                              {brand || "Untitled"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5" dir="ltr">
                              {k.id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={tdPad}>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{ind}</span>
                      </td>
                      <td className={tdPad}>
                        <div className="text-sm">
                          <p className="text-gray-900 dark:text-gray-300">{dt.toLocaleDateString()}</p>
                          {!compactTable && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">{dt.toLocaleTimeString()}</p>}
                        </div>
                      </td>
                      <td className={tdPad}>
                        {sk === "done" && (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {k.status_badge}
                          </span>
                        )}
                        {sk === "running" && (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200/50 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                            {k.status_badge}
                          </span>
                        )}
                        {sk === "failed" && (
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200/50 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            {k.status_badge}
                          </span>
                        )}
                      </td>
                      {adminMode && (
                        <td className={tdPad}>
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {formatTokens(k.total_tokens)}
                          </span>
                        </td>
                      )}
                      <td className={tdPad + " text-end"}>
                        <Link
                          to={kitDetailsBase + k.id}
                          className={
                            "inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 font-medium text-gray-900 dark:text-white transition-all hover:bg-gray-50 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 " +
                            (compactTable ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm")
                          }
                        >
                          View details
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
