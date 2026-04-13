import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { KitSummary } from "../types";
import { briefBrand, briefIndustry, filterKitsByQuery } from "../kitSearchUtils";
import { useRecentSearches } from "./hooks/useRecentSearches";

export default function GlobalSearchOverlay({
  open,
  onClose,
  kits,
  query,
  onQueryChange,
}: {
  open: boolean;
  onClose: () => void;
  kits: KitSummary[] | null;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = kits ? filterKitsByQuery(kits, query) : [];
  const { recent, pushRecent } = useRecentSearches();

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-surface/80 px-4 pb-12 pt-24 backdrop-blur-md dark:bg-earth-darkBg/85"
      role="dialog"
      aria-modal="true"
      aria-label="Search kits"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-4xl flex-col gap-4" onMouseDown={(e) => e.stopPropagation()}>
        <div className="glass-panel glow-focus rounded-2xl border border-outline-variant/30 p-2 shadow-2xl dark:border-muted/45 dark:bg-surface-container-high/90">
          <div className="flex h-14 items-center gap-4 px-4">
            <span className="material-symbols-outlined text-tertiary">search</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="font-headline w-full rounded-uniform border-none bg-transparent text-xl font-medium text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary/45"
              placeholder="Search kits, brands, or status…"
              aria-label="Search query"
            />
            <kbd className="hidden items-center justify-center rounded-md border border-outline-variant/20 bg-surface-container-highest px-2 py-1 text-[10px] font-bold tracking-widest text-on-surface-variant md:flex dark:border-muted/45 dark:bg-earth-darkBg/80">
              ESC
            </kbd>
          </div>
        </div>

        <div className="glass-panel mb-12 overflow-hidden rounded-uniform border border-outline-variant/30 shadow-2xl dark:border-muted/45 dark:bg-surface-container-high/90">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="space-y-8 border-outline-variant/25 p-8 lg:col-span-4 lg:border-e">
              <section>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant">Recent searches</h3>
                <div className="space-y-2">
                  {recent.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">No recent searches yet.</p>
                  ) : (
                    recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => onQueryChange(r)}
                        className="group flex w-full items-center gap-3 rounded-xl p-3 text-start transition-all hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">history</span>
                        <span className="text-sm font-medium">{r}</span>
                      </button>
                    ))
                  )}
                </div>
              </section>
              <section>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant">Quick filters</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onQueryChange("done")}
                    className="cursor-pointer rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/45"
                  >
                    Completed
                  </button>
                  <button
                    type="button"
                    onClick={() => onQueryChange("run")}
                    className="cursor-pointer rounded-full border border-outline-variant/20 bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-all hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    Running
                  </button>
                </div>
              </section>
            </div>

            <div className="bg-surface-container-low/30 p-8 lg:col-span-8 dark:bg-earth-darkBg/45">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-bold text-on-surface">
                  Results{" "}
                  <span className="ml-2 font-normal text-on-surface-variant">
                    ({kits ? filtered.length : "…"})
                  </span>
                </h3>
              </div>

              {!kits && (
                <p className="text-sm text-on-surface-variant">Loading kits…</p>
              )}

              {kits && filtered.length === 0 && query.trim() && (
                <div className="flex flex-col items-center py-12 text-center">
                  <span className="material-symbols-outlined mb-4 text-4xl text-on-surface-variant/40">search_off</span>
                  <h3 className="font-headline mb-2 text-xl font-extrabold text-on-surface">No kits found</h3>
                  <p className="mb-6 max-w-sm text-on-surface-variant">Try another brand name, id, or status keyword.</p>
                  <button
                    type="button"
                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    onClick={() => onQueryChange("")}
                  >
                    Clear search
                  </button>
                </div>
              )}

              {kits && filtered.length > 0 && (
                <div className="space-y-4">
                  {filtered.slice(0, 12).map((k) => {
                    const brand = briefBrand(k.brief_json) || k.id;
                    const ind = briefIndustry(k.brief_json);
                    const dt = new Date(k.created_at);
                    return (
                      <Link
                        key={k.id}
                        to={"/kits/" + k.id}
                        onClick={() => {
                          pushRecent(query || brand);
                          onClose();
                        }}
                        className="group relative flex cursor-pointer items-center gap-4 rounded-2xl border border-transparent bg-surface-container-high/40 p-4 transition-all hover:border-primary/20 hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-surface-container-high/70 dark:hover:bg-surface-container-high"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                          <span className="material-symbols-outlined text-2xl text-on-primary">auto_fix_high</span>
                        </div>
                        <div className="flex-1">
                          <div className="mb-0.5 flex items-center justify-between">
                            <span className="font-headline font-bold text-on-surface">{brand}</span>
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary dark:bg-primary/20 dark:text-secondary">
                              {k.status_badge}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                            <span>{ind}</span>
                            <span className="h-1 w-1 rounded-full bg-outline-variant/40" />
                            <span dir="ltr">{k.id.slice(0, 8)}…</span>
                            <span className="h-1 w-1 rounded-full bg-outline-variant/40" />
                            <span>{dt.toLocaleDateString()}</span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100">
                          arrow_forward_ios
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {kits && query.trim() && filtered.length > 0 && (
                <button
                  type="button"
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/20 py-3 text-sm font-bold text-primary transition-all hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/45"
                  onClick={() => pushRecent(query)}
                >
                  Save “{query.trim()}” to recent
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 border-t border-outline-variant/10 bg-surface-container-highest/50 px-8 py-3 dark:border-muted/30 dark:bg-earth-darkBg/55">
            <div className="flex items-center gap-2 text-[10px] font-medium text-on-surface-variant">
              <kbd className="rounded border border-outline-variant/20 bg-surface-container px-1.5 py-0.5">esc</kbd>
              <span>to close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

