import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getKit, retryKit, ApiError } from "./api";
import type { KitSummary } from "./types";
import { useToast } from "./useToast";
import { emitWizardEvent } from "./lib/wizardAnalytics";

const LazyViewer = lazy(() => import("./KitViewer"));

function briefBrand(json: string): string {
  try {
    const o = JSON.parse(json) as { brand_name?: string };
    return o.brand_name ?? "";
  } catch {
    return "";
  }
}

function parseBriefJson(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseResultJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 font-semibold text-on-primary-container shadow-lg transition hover:shadow-[0_0_20px_rgb(var(--c-primary)/0.35)] focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 dark:from-brand-primary dark:to-brand-accent dark:text-brand-darkText";
const btnSecondary =
  "inline-flex items-center gap-2 rounded-xl border border-outline/30 bg-surface-container-high px-5 py-3 font-semibold text-on-surface transition hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-muted/45 dark:bg-earth-darkCard dark:text-brand-darkText";
const btnGhost =
  "rounded-lg px-1 text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:text-brand-sand";

export default function KitDetail({ showTechnical = false }: { showTechnical?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [kit, setKit] = useState<KitSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [conflict, setConflict] = useState(false);
  const { toasts, push } = useToast();

  const refreshKit = useCallback(() => {
    if (!id) return;
    setConflict(false);
    setErr(null);
    getKit(id)
      .then(setKit)
      .catch(() => setErr("Not found"));
  }, [id]);

  useEffect(() => {
    refreshKit();
  }, [refreshKit]);

  const copyCorrelation = async () => {
    if (!kit?.correlation_id) return;
    try {
      await navigator.clipboard.writeText(kit.correlation_id);
      push("Correlation ID copied", "info");
    } catch {
      push("Could not copy from the browser", "error");
    }
  };

  const copyResultJson = async () => {
    if (!kit?.result_json) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(kit.result_json, null, 2));
      push("Kit JSON copied", "info");
    } catch {
      push("Could not copy from the browser", "error");
    }
  };

  const doRetry = async () => {
    if (!kit) return;
    setConflict(false);
    setRetrying(true);
    try {
      const updated = await retryKit(kit.id, kit.brief_json, kit.row_version);
      setKit(updated);
      push("Retry started", "info");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
        push("Version conflict — refresh the page and try again.", "error");
      } else {
        push(e instanceof Error ? e.message : String(e), "error");
      }
    } finally {
      setRetrying(false);
    }
  };

  if (err || !id) {
    return (
      <div className="glass-panel rounded-3xl border border-outline/30 p-8 text-on-surface">
        <p className="mb-4">{err ?? "—"}</p>
        <Link to="/generated-kits" className={btnGhost + " inline-flex items-center gap-1"}>
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to generated kits
        </Link>
      </div>
    );
  }

  if (!kit) {
    return (
      <div className="glass-panel flex min-h-[40vh] items-center justify-center rounded-3xl border border-outline/30 p-12 text-on-surface-variant">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined animate-pulse text-4xl text-primary">hourglass_empty</span>
          Loading…
        </div>
      </div>
    );
  }

  const statusLower = kit.delivery_status.toLowerCase();
  const failed = statusLower.includes("failed_generation");
  const retryInProgress = statusLower.includes("retry_in_progress");
  const title = briefBrand(kit.brief_json) || kit.id;
  const brief = parseBriefJson(kit.brief_json);
  const result = parseResultJson(kit.result_json);
  const diagnosisPlan =
    result.diagnosis_plan && typeof result.diagnosis_plan === "object" && !Array.isArray(result.diagnosis_plan)
      ? (result.diagnosis_plan as Record<string, unknown>)
      : null;
  const narrativeSummary =
    typeof result.narrative_summary === "string" ? String(result.narrative_summary).trim() : "";
  const wizardType =
    brief.campaign_mode === "social" || brief.campaign_mode === "offer" || brief.campaign_mode === "deep"
      ? brief.campaign_mode
      : "unknown";
  const blocker = String(brief.diagnostic_primary_blocker ?? "").trim();
  const target = String(brief.diagnostic_revenue_goal ?? "").trim();
  const recommendation =
    blocker === "inconsistent-execution"
      ? "Start with Quick win and publish one output today to rebuild momentum."
      : blocker === "no-conversion"
      ? "Start with Optimization and regenerate conversion-focused outputs first."
      : blocker === "low-reach"
      ? "Start with Optimization and test new hooks/angles this week."
      : "Start with Scale and produce a second kit for another audience segment.";
  const twentyFourHourPlan =
    typeof diagnosisPlan?.quickWin24h === "string" && diagnosisPlan.quickWin24h.trim()
      ? diagnosisPlan.quickWin24h.trim()
      : target && target.includes("10000")
      ? "Next 24h: publish one hero piece and one authority support post."
      : "Next 24h: publish one quick-win item from this kit and collect response signals.";
  const sevenDayPlan =
    typeof diagnosisPlan?.focus7d === "string" && diagnosisPlan.focus7d.trim()
      ? diagnosisPlan.focus7d.trim()
      : "Next 7d: run 2-3 outputs, capture performance, then regenerate weak items using targeted feedback.";

  return (
    <>
      <div className="toast-host fixed bottom-4 end-4 z-[100] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-outline/30 bg-surface-container-high px-4 py-2 text-sm text-on-surface shadow-lg dark:border-brand-muted/45 dark:bg-earth-darkCard dark:text-brand-darkText"
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>

      <div className="mb-8 flex flex-col gap-5 md:mb-10 md:gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant dark:text-brand-darkText/75">
            <Link to="/generated-kits" className="hover:text-on-surface">
              Generated kits
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary">Kit details</span>
          </nav>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl md:text-4xl lg:text-5xl">
            {title}{" "}
            <span className="text-tertiary">Kit</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className="inline-flex rounded-full border px-3 py-1 text-xs font-bold"
              style={{
                background: kit.badge_palette.bg,
                color: kit.badge_palette.fg,
                borderColor: kit.badge_palette.border,
              }}
            >
              {kit.status_badge}
            </span>
            {showTechnical && kit.model_used ? (
              <span className="text-sm text-on-surface-variant">Model: {kit.model_used}</span>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-3 lg:w-auto">
          {showTechnical && kit.result_json ? (
            <button type="button" className={btnSecondary + " w-full sm:w-auto"} onClick={() => void copyResultJson()}>
              <span className="material-symbols-outlined text-lg">content_copy</span>
              Copy JSON
            </button>
          ) : null}
          {failed && !retryInProgress ? (
            <button type="button" className={btnPrimary + " w-full sm:w-auto"} disabled={retrying} onClick={() => void doRetry()}>
              <span className="material-symbols-outlined text-lg">refresh</span>
              {retrying ? "Regenerating…" : "Retry"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="glass-panel mb-8 space-y-6 rounded-3xl border border-outline/30 p-4 sm:p-6 md:p-8 dark:border-brand-muted/45 dark:bg-earth-darkCard/80">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Link to="/generated-kits" className={btnGhost + " inline-flex items-center gap-1"}>
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back
          </Link>
        </div>

        {retryInProgress && !retrying && (
          <p className="rounded-xl border border-tertiary/20 bg-tertiary/10 px-4 py-3 text-sm text-on-surface" role="status">
            Regenerating on the server… If you still see old data, refresh the page.
          </p>
        )}

        {showTechnical && kit.correlation_id ? (
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Correlation ID:</span>{" "}
            <code dir="ltr" className="rounded bg-surface-container-lowest px-2 py-0.5 text-xs text-tertiary">
              {kit.correlation_id}
            </code>{" "}
            <button type="button" className={btnGhost} onClick={() => void copyCorrelation()}>
              Copy
            </button>
          </p>
        ) : null}

        {kit.last_error && (
          <div className="rounded-2xl border border-error/30 bg-error/10 p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-error">Error details</div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-container-lowest p-4 text-xs text-on-surface" dir="ltr">
              {kit.last_error}
            </pre>
          </div>
        )}

        {conflict && (
          <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-4" role="alert">
            <p className="mb-3 text-sm text-on-surface">
              The record version changed (row_version). Refresh to load the latest state, then retry if needed.
            </p>
            <button type="button" className={btnPrimary} onClick={refreshKit}>
              Refresh from server
            </button>
          </div>
        )}
      </div>

      {kit.result_json && (
        <section className="mb-8 rounded-3xl border border-secondary/25 bg-secondary/10 p-4 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-secondary">Next best action</p>
          <h2 className="mt-1 font-headline text-xl font-extrabold text-on-surface sm:text-2xl">Choose your next move</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Your kit is ready. Pick the action that matches your readiness level and keep momentum.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-outline/25 bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Quick win</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">Use this kit immediately</p>
              <p className="mt-1 text-xs text-on-surface-variant">Copy your best post/video prompt and publish today.</p>
            </div>
            <div className="rounded-2xl border border-outline/25 bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Optimization</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">Regenerate weak items</p>
              <p className="mt-1 text-xs text-on-surface-variant">Use targeted feedback to improve individual outputs.</p>
            </div>
            <div className="rounded-2xl border border-outline/25 bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Scale</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">Create another kit</p>
              <p className="mt-1 text-xs text-on-surface-variant">Run a new angle for a second audience or offer.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/wizard"
              className={btnPrimary + " w-full justify-center sm:w-auto"}
              onClick={() =>
                emitWizardEvent({
                  name: "wizard_step_next_clicked",
                  wizard_type: wizardType,
                  draft_key: `kit:${kit.id}`,
                  step_id: "kit_handoff_create_another_kit",
                  validation_state: "passed",
                })
              }
            >
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
              Create another kit
            </Link>
            <Link
              to="/generated-kits"
              className={btnSecondary + " w-full justify-center sm:w-auto"}
              onClick={() =>
                emitWizardEvent({
                  name: "wizard_step_next_clicked",
                  wizard_type: wizardType,
                  draft_key: `kit:${kit.id}`,
                  step_id: "kit_handoff_open_generated_kits",
                  validation_state: "passed",
                })
              }
            >
              <span className="material-symbols-outlined text-lg">inventory_2</span>
              Open generated kits
            </Link>
            <Link
              to="/wizard/offer"
              className={btnSecondary + " w-full justify-center sm:w-auto"}
              onClick={() =>
                emitWizardEvent({
                  name: "wizard_step_next_clicked",
                  wizard_type: wizardType,
                  draft_key: `kit:${kit.id}`,
                  step_id: "kit_handoff_start_offer_campaign",
                  validation_state: "passed",
                })
              }
            >
              <span className="material-symbols-outlined text-lg">trending_up</span>
              Start Offer Campaign
            </Link>
            <Link
              to="/wizard/deep"
              className={btnSecondary + " w-full justify-center sm:w-auto"}
              onClick={() =>
                emitWizardEvent({
                  name: "wizard_step_next_clicked",
                  wizard_type: wizardType,
                  draft_key: `kit:${kit.id}`,
                  step_id: "kit_handoff_start_deep_content",
                  validation_state: "passed",
                })
              }
            >
              <span className="material-symbols-outlined text-lg">article</span>
              Deep Content
            </Link>
          </div>
          <div className="mt-4 rounded-xl border border-outline/25 bg-surface-container-low p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Recommended next move</p>
            <p className="mt-1 text-sm font-semibold text-on-surface">{recommendation}</p>
            {narrativeSummary ? (
              <p className="mt-2 text-xs text-on-surface-variant">{narrativeSummary}</p>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-outline/25 bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">24-hour plan</p>
              <p className="mt-1 text-xs text-on-surface-variant">{twentyFourHourPlan}</p>
            </div>
            <div className="rounded-xl border border-outline/25 bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">7-day plan</p>
              <p className="mt-1 text-xs text-on-surface-variant">{sevenDayPlan}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">
            Trust cue: Your current kit is saved and can be revisited anytime from Generated kits.
          </p>
        </section>
      )}

      {kit.result_json && (
        <Suspense
          fallback={
            <div className="glass-panel flex min-h-[200px] items-center justify-center rounded-3xl border border-outline/30 p-8 text-on-surface-variant">
              Loading viewer…
            </div>
          }
        >
          <LazyViewer kit={kit} onKitUpdate={setKit} showTechnical={showTechnical} />
        </Suspense>
      )}
    </>
  );
}
