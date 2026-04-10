import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useNavigate } from "react-router-dom";
import { generateKit, listPromptCatalogIndustries } from "../../api";
import { BRIEF_LIMITS, briefSchema, initialBriefForm } from "../../briefSchema";
import { isWizardDirty, parseWizardDraft } from "../../wizardDraft";
import type { BriefForm } from "../../types";
import { emitWizardEvent, getWizardTypeFromDraftKey } from "../../lib/wizardAnalytics";
import { BrandStep, AudienceStep, ChannelsStep, OfferStep, CreativeStep, VolumeStep } from "./WizardSteps";

type StepId = "brand" | "audience" | "channels" | "offer" | "creative" | "volume";

// Removed selection state

type WizardCoreProps = {
  draftKey: string;
  title: string;
  subtitle: string;
  routeHint: string;
  stepOrder: StepId[];
  stepTitles: Record<StepId, string>;
  stepFields?: Partial<Record<StepId, (keyof BriefForm)[]>>;
  defaults?: Partial<BriefForm>;
  /** Per-path validation (required fields). Defaults to full briefSchema. */
  formSchema?: z.ZodType<BriefForm, z.ZodTypeDef, unknown>;
};

const LIMITS = BRIEF_LIMITS;
const FALLBACK_INDUSTRY_OPTIONS: { slug: string; name: string }[] = (
  ["ecommerce", "real-estate", "restaurants", "clinics", "education", "general"] as const
).map((slug) => ({ slug, name: slug.replace(/-/g, " ") }));
const WAITING_STAGES = [
  {
    title: "Analyzing your brand",
    hint: "Reading your core inputs and campaign intent to build the right direction.",
  },
  {
    title: "Crafting high-converting hooks",
    hint: "Generating social and messaging angles based on your selected flow.",
  },
  {
    title: "Preparing your visual prompts",
    hint: "Structuring creative outputs and finalizing your kit delivery payload.",
  },
] as const;

const STEP_FIELDS: Record<StepId, (keyof BriefForm)[]> = {
  brand: ["brand_name", "industry"],
  audience: ["target_audience", "main_goal"],
  channels: ["platforms", "brand_tone", "brand_colors"],
  offer: ["offer", "competitors"],
  creative: ["visual_notes", "campaign_duration", "budget_level", "best_content_types"],
  volume: [],
};

function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const btnPrimary =
  "rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 font-bold text-on-primary-container shadow-lg shadow-primary/15 transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 dark:from-brand-primary dark:to-brand-accent dark:text-brand-darkText";
const btnSecondary =
  "rounded-xl border border-outline/30 bg-surface-container-high px-5 py-3 font-semibold text-on-surface transition hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-muted/40 dark:bg-earth-darkCard dark:text-brand-darkText";

export default function WizardCore(props: WizardCoreProps) {
  const nav = useNavigate();
  const maxStep = props.stepOrder.length - 1;
  const wizardType = useMemo(() => getWizardTypeFromDraftKey(props.draftKey), [props.draftKey]);
  const mergedDefaults = useMemo(() => ({ ...initialBriefForm(), ...(props.defaults ?? {}) }), [props.defaults]);
  const stepFieldMap = useMemo(() => ({ ...STEP_FIELDS, ...(props.stepFields ?? {}) }), [props.stepFields]);
  const zodSchema = props.formSchema ?? briefSchema;
  const zodResolverMemo = useMemo(() => zodResolver(zodSchema), [zodSchema]);
  const [industryOptions, setIndustryOptions] = useState<{ slug: string; name: string }[]>(FALLBACK_INDUSTRY_OPTIONS);

  useEffect(() => {
    listPromptCatalogIndustries()
      .then((d) => {
        if (d.items.length) {
          setIndustryOptions(d.items.map((i) => ({ slug: i.slug, name: i.name })));
        }
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);

  const initialState = useMemo(() => {
    try {
      const raw = localStorage.getItem(props.draftKey);
      if (!raw) return { step: 0, form: mergedDefaults, hadDraft: false };
      const parsed = parseWizardDraft(raw, LIMITS, maxStep);
      if (!parsed) return { step: 0, form: mergedDefaults, hadDraft: false };
      return { step: parsed.step, form: { ...mergedDefaults, ...parsed.form }, hadDraft: true };
    } catch {
      return { step: 0, form: mergedDefaults, hadDraft: false };
    }
  }, [mergedDefaults, props.draftKey, maxStep]);

  const [step, setStep] = useState(initialState.step);
  const [showDraftBanner, setShowDraftBanner] = useState(initialState.hadDraft);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const methods = useForm<BriefForm>({
    resolver: zodResolverMemo,
    defaultValues: initialState.form,
    mode: "onTouched",
  });
  const { watch, reset, getValues, trigger, handleSubmit } = methods;

  function showField(step: string, key: keyof BriefForm): boolean {
    if (step === "volume") {
      return (["num_posts", "num_image_designs", "num_video_prompts", "email"] as const).some((k) => k === key);
    }
    const keys = stepFieldMap[step as StepId] ?? STEP_FIELDS[step as StepId];
    if (!keys.length) return true;
    return keys.includes(key);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const fn = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    const sub = watch(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        try {
          const form = getValues();
          if (!isWizardDirty(form, step, LIMITS)) {
            localStorage.removeItem(props.draftKey);
            return;
          }
          localStorage.setItem(props.draftKey, JSON.stringify({ step, form }));
        } catch {
          // ignore
        }
      }, 400);
    });
    return () => {
      sub.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [watch, getValues, step, props.draftKey]);

  useEffect(() => {
    if (!loading || reduceMotion) return;
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % WAITING_STAGES.length), 4500);
    return () => clearInterval(id);
  }, [loading, reduceMotion]);

  useEffect(() => {
    emitWizardEvent({
      name: "wizard_started",
      wizard_type: wizardType,
      draft_key: props.draftKey,
      restored_draft: initialState.hadDraft,
      elapsed_time_ms: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = props.stepOrder[step];
    emitWizardEvent({
      name: "wizard_step_viewed",
      wizard_type: wizardType,
      draft_key: props.draftKey,
      step_index: step,
      step_id: current,
      total_steps: maxStep + 1,
      elapsed_time_ms: Date.now() - startedAtRef.current,
    });
  }, [step, props.draftKey, props.stepOrder, maxStep, wizardType]);

  const clearDraft = () => {
    localStorage.removeItem(props.draftKey);
    reset(mergedDefaults);
    setStep(0);
    setShowDraftBanner(false);
  };

  // Cleaned up unused toggle and sync effects
  const next = async () => {
    const current = props.stepOrder[step]!;
    const keys = stepFieldMap[current] ?? [];
    if (keys.length) {
      const ok = await trigger([...keys]);
      if (!ok) {
        emitWizardEvent({
          name: "wizard_step_validation_failed",
          wizard_type: wizardType,
          draft_key: props.draftKey,
          step_index: step,
          step_id: current,
          validation_state: "failed",
          elapsed_time_ms: Date.now() - startedAtRef.current,
        });
        return;
      }
    }
    emitWizardEvent({
      name: "wizard_step_next_clicked",
      wizard_type: wizardType,
      draft_key: props.draftKey,
      step_index: step,
      step_id: current,
      validation_state: "passed",
      elapsed_time_ms: Date.now() - startedAtRef.current,
    });
    setStep((s) => Math.min(maxStep, s + 1));
  };

  const onValidSubmit = async (form: BriefForm) => {
    setErr(null);
    setLoading(true);
    emitWizardEvent({
      name: "wizard_generate_clicked",
      wizard_type: wizardType,
      draft_key: props.draftKey,
      step_index: step,
      step_id: props.stepOrder[step],
      elapsed_time_ms: Date.now() - startedAtRef.current,
    });
    try {
      const payload = {
        ...form,
        num_posts: clamp(form.num_posts, LIMITS.num_posts.min, LIMITS.num_posts.max),
        num_image_designs: clamp(form.num_image_designs, LIMITS.num_image_designs.min, LIMITS.num_image_designs.max),
        num_video_prompts: clamp(form.num_video_prompts, LIMITS.num_video_prompts.min, LIMITS.num_video_prompts.max),
      };
      const kit = await generateKit(payload, idempotencyKey);
      localStorage.removeItem(props.draftKey);
      emitWizardEvent({
        name: "kit_created_success",
        wizard_type: wizardType,
        draft_key: props.draftKey,
        kit_id: kit.id,
        elapsed_time_ms: Date.now() - startedAtRef.current,
      });
      nav(`/kits/${kit.id}`);
    } catch (e) {
      setErr(String(e));
      emitWizardEvent({
        name: "kit_created_failed",
        wizard_type: wizardType,
        draft_key: props.draftKey,
        error: String(e),
        elapsed_time_ms: Date.now() - startedAtRef.current,
      });
    } finally {
      setLoading(false);
    }
  };

  const currentStep = props.stepOrder[step]!;
  const isFinalStep = step === maxStep;
  const brandNameValue = watch("brand_name");
  const industryValue = watch("industry");
  const mainGoalValue = watch("main_goal");
  const audienceValue = watch("target_audience");
  const canShowValuePreview =
    step >= 1 &&
    Boolean(brandNameValue?.trim()) &&
    Boolean(industryValue?.trim()) &&
    (Boolean(mainGoalValue?.trim()) || Boolean(audienceValue?.trim()));

  return (
    <div className="mx-auto w-full max-w-6xl px-2 sm:px-4">
      <div className="mb-8 md:mb-10">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl md:text-4xl">{props.title}</h2>
        <p className="mt-2 max-w-3xl text-on-surface-variant">{props.subtitle}</p>
      </div>

      {showDraftBanner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tertiary/25 bg-tertiary/10 px-4 py-3 text-sm text-on-surface dark:border-brand-sand/40 dark:bg-brand-sand/10 dark:text-brand-darkText">
          <span>Restored a saved draft for this path.</span>
          <button type="button" className={btnSecondary + " py-2 text-sm"} onClick={clearDraft}>
            Clear draft
          </button>
        </div>
      )}

      <div className="wizard-root overflow-hidden rounded-2xl border border-outline/30 bg-surface-container-low sm:rounded-3xl dark:border-brand-muted/40 dark:bg-earth-darkCard/75" aria-busy={loading}>
        <div className={cn("wizard-body-wrap relative !rounded-3xl", loading && "wizard-body-wrap--loading")}>
          <div className="wizard-body p-4 sm:p-6 md:p-8">
            {canShowValuePreview && (
              <div className="mb-5 rounded-xl border border-secondary/30 bg-secondary/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">Early value preview</p>
                <h3 className="mt-1 text-sm font-semibold text-on-surface">
                  You are building a {wizardType} kit for {brandNameValue}
                </h3>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Industry: {industryValue}. Primary direction: {(mainGoalValue || audienceValue || "audience-led growth").slice(0, 120)}.
                </p>
              </div>
            )}

            <div className="mb-6 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:mb-8 sm:flex-wrap sm:overflow-visible">
              {props.stepOrder.map((id, i) => (
                <span
                  key={id}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    i === step
                      ? "border-primary/30 bg-primary/20 text-primary dark:border-brand-primary/45 dark:bg-brand-primary/15 dark:text-brand-darkText"
                      : "border-transparent bg-surface-container-lowest text-on-surface-variant dark:bg-earth-darkBg/55 dark:text-brand-darkText/70"
                  )}
                >
                  {i + 1}. {props.stepTitles[id]}
                </span>
              ))}
            </div>

            {currentStep === "brand" && <BrandStep form={methods} showField={showField} industryOptions={industryOptions} />}
            {currentStep === "audience" && <AudienceStep form={methods} showField={showField} />}
            {currentStep === "channels" && <ChannelsStep form={methods} showField={showField} />}
            {currentStep === "offer" && <OfferStep form={methods} showField={showField} />}
            {currentStep === "creative" && <CreativeStep form={methods} showField={showField} />}
            {currentStep === "volume" && <VolumeStep form={methods} showField={showField} />}

            {err && <p className="mt-4 text-error dark:text-brand-accent">{err}</p>}

            {isFinalStep && !loading && (
              <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 p-4 dark:border-brand-primary/40 dark:bg-brand-primary/15">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-on-surface">Ready to generate your kit</p>
                  <p className="text-xs text-on-surface-variant">
                    Takes around 10-30 seconds. Your draft stays saved, and you can edit after generation.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" className={btnSecondary + " w-full sm:w-auto"} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading}>
                Back
              </button>
              {step < maxStep ? (
                <button type="button" className={btnPrimary + " w-full sm:w-auto"} onClick={() => void next()} disabled={loading}>
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className={btnPrimary + " w-full sm:w-auto"}
                  onClick={handleSubmit(onValidSubmit)}
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate my kit now"}
                </button>
              )}
            </div>
          </div>

          {loading && (
            <div className="wizard-loading-overlay" role="status" aria-live="polite">
              <div className="wizard-indeterminate-track" aria-hidden>
                <div className="wizard-indeterminate-bar" />
              </div>
              <h3>{WAITING_STAGES[tipIndex]!.title}</h3>
              <p className="wizard-loading-hint">{WAITING_STAGES[tipIndex]!.hint}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

