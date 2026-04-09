import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listKits } from "./api";
import type { KitSummary } from "./types";
import { useToast } from "./useToast";
import PrimaryFlowBanner from "./components/PrimaryFlowBanner";
import { statusKind } from "./kitUiFormatters";
import { logger } from "./logger";

export default function Dashboard() {
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const { toasts, push } = useToast();

  useEffect(() => {
    listKits()
      .then(setKits)
      .catch((e) => {
        logger.error(e);
        push("Could not load the list", "error");
      });
  }, [push]);

  const stats = useMemo(() => {
    if (!kits?.length) {
      return {
        total: 0,
        successRate: 0,
        done: 0,
        barPct: 0,
      };
    }
    const done = kits.filter((k) => statusKind(k.status_badge) === "done").length;
    const rate = Math.round((done / kits.length) * 1000) / 10;
    const barPct = Math.min(100, Math.max(8, (kits.length % 17) + 35));
    return {
      total: kits.length,
      successRate: rate,
      done,
      barPct,
    };
  }, [kits]);

  return (
    <>
      <div className="toast-host fixed bottom-4 end-4 z-[100] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-brand-sand/30 bg-earth-card px-4 py-2 text-sm text-on-surface shadow-sm dark:border-outline/30 dark:bg-surface-container-high"
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>

      <section className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-12 md:gap-6">
        <div>
          <h2 className="headline mb-2 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">Dashboard</h2>
          <p className="text-base text-brand-muted dark:text-on-surface-variant md:text-lg">Open past kits quickly, or start a new campaign from the wizard.</p>
        </div>
        <div className="flex w-full gap-3 sm:w-auto sm:gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-brand-sand/30 bg-earth-card px-4 py-2 dark:border-outline/30 dark:bg-surface-container-high">
            <div className="h-2 w-2 animate-pulse rounded-full bg-tertiary shadow-[0_0_8px_rgb(var(--c-tertiary)/0.55)]" />
            <span className="font-manrope text-sm font-semibold tracking-tight">Records: {kits?.length ?? "…"}</span>
          </div>
        </div>
      </section>

      <section className="mb-10 overflow-hidden rounded-3xl border border-brand-sand/30 bg-earth-alt p-5 sm:p-6 md:p-10 dark:border-outline/30 dark:bg-surface-container-low">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Start here</p>
            <h3 className="headline mt-2 text-xl font-extrabold text-on-surface sm:text-2xl md:text-3xl">New campaign</h3>
            <p className="mt-2 text-brand-muted dark:text-on-surface-variant">
              Pick a flow — social, offer, or deep content — then generate your kit in minutes.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/wizard/social"
                className="rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:bg-surface-container-highest"
              >
                Social
              </Link>
              <Link
                to="/wizard/offer"
                className="rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:bg-surface-container-highest"
              >
                Offer
              </Link>
              <Link
                to="/wizard/deep"
                className="rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:bg-surface-container-highest"
              >
                Deep
              </Link>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Link
              to="/wizard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary px-6 py-3 font-headline text-xs font-bold uppercase tracking-widest text-white shadow-sm transition hover:bg-brand-primary/90 hover:scale-[1.02] sm:w-auto sm:px-8 sm:py-4 sm:text-sm dark:bg-primary dark:text-on-primary focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                rocket_launch
              </span>
              Start new campaign
            </Link>
          </div>
        </div>
      </section>

      <PrimaryFlowBanner className="mb-8" />

      <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <div className="group relative overflow-hidden rounded-3xl border border-brand-sand/30 bg-earth-card p-8 transition-transform duration-500 hover:scale-[1.01] dark:border-outline/30 dark:bg-surface-container-low">
          <div className="absolute -end-16 -top-16 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-primary/10 p-3">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  inventory_2
                </span>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-tertiary">Total</span>
            </div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Kit count</p>
            <h3 className="headline text-5xl font-extrabold tracking-tighter text-on-surface">{stats.total}</h3>
            <div className="mt-6 flex h-12 items-end gap-1">
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-primary/20">
                <div
                  className="absolute inset-y-0 start-0 bg-primary shadow-[0_0_15px_rgb(var(--c-primary)/0.55)]"
                  style={{ width: `${stats.barPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl border border-brand-sand/30 bg-earth-card p-8 transition-transform duration-500 hover:scale-[1.01] dark:border-outline/30 dark:bg-surface-container-low">
          <div className="absolute -end-16 -top-16 h-32 w-32 rounded-full bg-tertiary/5 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-2xl bg-tertiary/10 p-3">
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-tertiary">Complete</span>
            </div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Success rate</p>
            <h3 className="headline text-5xl font-extrabold tracking-tighter text-on-surface">
              {kits?.length ? `${stats.successRate}%` : "—"}
            </h3>
            <p className="mt-4 text-xs text-on-surface-variant">
              Delivered successfully: {stats.done} of {stats.total || 0}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-8">
        <div className="group relative rounded-3xl border border-brand-sand/30 bg-earth-card p-6 md:p-10 dark:border-outline/30 dark:bg-surface-container-low">
          <div className="absolute end-10 top-10 opacity-10 transition-opacity group-hover:opacity-20">
            <span className="material-symbols-outlined text-8xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_fix_high
            </span>
          </div>
          <h4 className="headline mb-4 text-2xl font-bold">Start from the wizard</h4>
          <p className="mb-6 max-w-2xl text-brand-muted dark:text-on-surface-variant">
            Enter brand details, choose the right wizard path, and generate your full content plan from one clear flow.
          </p>
          <Link
            to="/wizard"
            className="inline-flex items-center gap-2 rounded-lg px-1 text-xs font-bold uppercase tracking-widest text-primary transition-all hover:gap-4 focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Open wizard
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>

      <div className="fixed bottom-4 end-4 z-50 sm:bottom-6 sm:end-6 md:bottom-10 md:end-10">
        <Link
          to="/wizard"
          className="flex items-center gap-2 rounded-full bg-brand-primary px-4 py-3 text-sm font-headline font-bold text-white shadow-sm transition-all hover:scale-105 hover:bg-brand-primary/90 sm:gap-3 sm:px-6 sm:py-4 sm:text-base dark:bg-primary dark:text-on-primary active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 700" }}>
            add
          </span>
          Create new kit
        </Link>
      </div>
    </>
  );
}
