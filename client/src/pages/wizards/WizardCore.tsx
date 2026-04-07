import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useNavigate } from "react-router-dom";
import { generateKit, listPromptCatalogIndustries } from "../../api";
import { BRIEF_LIMITS, briefSchema, initialBriefForm } from "../../briefSchema";
import { isWizardDirty, parseWizardDraft } from "../../wizardDraft";
import type { BriefForm } from "../../types";

type StepId = "brand" | "audience" | "channels" | "offer" | "creative" | "volume";

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

const labelCls = "mb-2 ms-1 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant";
const fieldShell = "glow-focus rounded-xl bg-surface-container-lowest p-0.5";
const inputCls =
  "w-full rounded-lg border-none bg-transparent px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary/45";
const textareaCls = cn(inputCls, "min-h-[100px] resize-y");
const errCls = "mt-1 text-sm text-error";
const btnPrimary =
  "rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 font-bold text-on-primary-container shadow-lg shadow-primary/15 transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 dark:from-brand-primary dark:to-brand-accent dark:text-brand-darkText";
const btnSecondary =
  "rounded-xl border border-outline/30 bg-surface-container-high px-5 py-3 font-semibold text-on-surface transition hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-muted/40 dark:bg-earth-darkCard dark:text-brand-darkText";

export default function WizardCore(props: WizardCoreProps) {
  const nav = useNavigate();
  const maxStep = props.stepOrder.length - 1;
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
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const {
    register,
    control,
    watch,
    reset,
    getValues,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<BriefForm>({
    resolver: zodResolverMemo,
    defaultValues: initialState.form,
    mode: "onTouched",
  });

  function showField(step: StepId, key: keyof BriefForm): boolean {
    if (step === "volume") {
      return (["num_posts", "num_image_designs", "num_video_prompts", "email"] as const).some((k) => k === key);
    }
    const keys = stepFieldMap[step] ?? STEP_FIELDS[step];
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
    if (step < maxStep) setConfirmSubmit(false);
  }, [step, maxStep]);

  const clearDraft = () => {
    localStorage.removeItem(props.draftKey);
    reset(mergedDefaults);
    setStep(0);
    setShowDraftBanner(false);
  };

  const next = async () => {
    const current = props.stepOrder[step]!;
    const keys = stepFieldMap[current] ?? [];
    if (keys.length) {
      const ok = await trigger([...keys]);
      if (!ok) return;
    }
    setStep((s) => Math.min(maxStep, s + 1));
  };

  const onValidSubmit = async (form: BriefForm) => {
    setErr(null);
    setLoading(true);
    try {
      const payload = {
        ...form,
        num_posts: clamp(form.num_posts, LIMITS.num_posts.min, LIMITS.num_posts.max),
        num_image_designs: clamp(form.num_image_designs, LIMITS.num_image_designs.min, LIMITS.num_image_designs.max),
        num_video_prompts: clamp(form.num_video_prompts, LIMITS.num_video_prompts.min, LIMITS.num_video_prompts.max),
      };
      const kit = await generateKit(payload, idempotencyKey);
      localStorage.removeItem(props.draftKey);
      nav(`/kits/${kit.id}`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  const currentStep = props.stepOrder[step]!;
  const isFinalStep = step === maxStep;

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <div className="mb-10">
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">{props.title}</h2>
        <p className="mt-2 max-w-3xl text-on-surface-variant">{props.subtitle}</p>
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-on-surface dark:border-brand-primary/40 dark:bg-brand-primary/15">
          <p className="font-semibold">Flow</p>
          <p className="mt-1 text-on-surface-variant">
            Fill this path then click <strong>Generate kit</strong>. Output opens at <code>{props.routeHint}</code>.
          </p>
        </div>
      </div>

      {showDraftBanner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tertiary/25 bg-tertiary/10 px-4 py-3 text-sm text-on-surface dark:border-brand-sand/40 dark:bg-brand-sand/10 dark:text-brand-darkText">
          <span>Restored a saved draft for this path.</span>
          <button type="button" className={btnSecondary + " py-2 text-sm"} onClick={clearDraft}>
            Clear draft
          </button>
        </div>
      )}

      <div className="wizard-root overflow-hidden rounded-3xl border border-outline/30 bg-surface-container-low dark:border-brand-muted/40 dark:bg-earth-darkCard/75" aria-busy={loading}>
        <div className={cn("wizard-body-wrap relative !rounded-3xl", loading && "wizard-body-wrap--loading")}>
          <div className="wizard-body p-6 md:p-8">
            <div className="mb-8 flex flex-wrap gap-2">
              {props.stepOrder.map((id, i) => (
                <span
                  key={id}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    i === step
                      ? "border-primary/30 bg-primary/20 text-primary dark:border-brand-primary/45 dark:bg-brand-primary/15 dark:text-brand-darkText"
                      : "border-transparent bg-surface-container-lowest text-on-surface-variant dark:bg-earth-darkBg/55 dark:text-brand-darkText/70"
                  )}
                >
                  {i + 1}. {props.stepTitles[id]}
                </span>
              ))}
            </div>

            {currentStep === "brand" && (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="brand_name" className={labelCls}>Brand name</label>
                  <div className={fieldShell}><input id="brand_name" className={inputCls} {...register("brand_name")} /></div>
                  {errors.brand_name && <p className={errCls}>{errors.brand_name.message}</p>}
                </div>
                <div>
                  <label htmlFor="industry" className={labelCls}>Industry</label>
                  <div className={fieldShell}>
                    <select id="industry" className={inputCls} {...register("industry")}>
                      <option value="">Select industry…</option>
                      {industryOptions.map((i) => (
                        <option key={i.slug} value={i.slug}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.industry && <p className={errCls}>{errors.industry.message}</p>}
                </div>
              </div>
            )}

            {currentStep === "audience" && (
              <div className="space-y-6">
                {showField("audience", "target_audience") && (
                  <div>
                    <label htmlFor="target_audience" className={labelCls}>Target audience</label>
                    <div className={fieldShell}><textarea id="target_audience" className={textareaCls} {...register("target_audience")} /></div>
                    {errors.target_audience && <p className={errCls}>{errors.target_audience.message}</p>}
                  </div>
                )}
                {showField("audience", "main_goal") && (
                  <div>
                    <label htmlFor="main_goal" className={labelCls}>Main campaign goal</label>
                    <div className={fieldShell}><textarea id="main_goal" className={textareaCls} {...register("main_goal")} /></div>
                    {errors.main_goal && <p className={errCls}>{errors.main_goal.message}</p>}
                  </div>
                )}
              </div>
            )}

            {currentStep === "channels" && (
              <div className="space-y-6">
                {showField("channels", "platforms") && (
                  <div>
                    <label htmlFor="platforms" className={labelCls}>Active platforms</label>
                    <div className={fieldShell}><textarea id="platforms" className={textareaCls} {...register("platforms")} /></div>
                    {errors.platforms && <p className={errCls}>{errors.platforms.message}</p>}
                  </div>
                )}
                {(showField("channels", "brand_tone") || showField("channels", "brand_colors")) && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {showField("channels", "brand_tone") && (
                      <div>
                        <label htmlFor="brand_tone" className={labelCls}>Brand tone</label>
                        <div className={fieldShell}><input id="brand_tone" className={inputCls} {...register("brand_tone")} /></div>
                        {errors.brand_tone && <p className={errCls}>{errors.brand_tone.message}</p>}
                      </div>
                    )}
                    {showField("channels", "brand_colors") && (
                      <div>
                        <label htmlFor="brand_colors" className={labelCls}>Brand colors</label>
                        <div className={fieldShell}><input id="brand_colors" className={inputCls} {...register("brand_colors")} /></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentStep === "offer" && (
              <div className="space-y-6">
                {showField("offer", "offer") && (
                  <div>
                    <label htmlFor="offer" className={labelCls}>Offer / core message</label>
                    <div className={fieldShell}><textarea id="offer" className={textareaCls} {...register("offer")} /></div>
                    {errors.offer && <p className={errCls}>{errors.offer.message}</p>}
                  </div>
                )}
                {showField("offer", "competitors") && (
                  <div>
                    <label htmlFor="competitors" className={labelCls}>Competitors</label>
                    <div className={fieldShell}><textarea id="competitors" className={textareaCls} {...register("competitors")} /></div>
                  </div>
                )}
              </div>
            )}

            {currentStep === "creative" && (
              <div className="space-y-6">
                {showField("creative", "visual_notes") && (
                  <div>
                    <label htmlFor="visual_notes" className={labelCls}>Visual / creative notes</label>
                    <div className={fieldShell}><textarea id="visual_notes" className={textareaCls} {...register("visual_notes")} /></div>
                    {errors.visual_notes && <p className={errCls}>{errors.visual_notes.message}</p>}
                  </div>
                )}
                {(showField("creative", "campaign_duration") || showField("creative", "budget_level")) && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {showField("creative", "campaign_duration") && (
                      <div>
                        <label htmlFor="campaign_duration" className={labelCls}>Campaign duration</label>
                        <div className={fieldShell}><input id="campaign_duration" className={inputCls} {...register("campaign_duration")} /></div>
                        {errors.campaign_duration && <p className={errCls}>{errors.campaign_duration.message}</p>}
                      </div>
                    )}
                    {showField("creative", "budget_level") && (
                      <div>
                        <label htmlFor="budget_level" className={labelCls}>Budget level (1–7)</label>
                        <div className={fieldShell}><input id="budget_level" className={inputCls} {...register("budget_level")} /></div>
                      </div>
                    )}
                  </div>
                )}
                {showField("creative", "best_content_types") && (
                  <div>
                    <label htmlFor="best_content_types" className={labelCls}>Best-performing content types</label>
                    <div className={fieldShell}><textarea id="best_content_types" className={textareaCls} {...register("best_content_types")} /></div>
                    {errors.best_content_types && <p className={errCls}>{errors.best_content_types.message}</p>}
                  </div>
                )}
              </div>
            )}

            {currentStep === "volume" && (
              <div className="space-y-6">
                {(showField("volume", "num_posts") || showField("volume", "num_image_designs")) && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {showField("volume", "num_posts") && (
                      <div>
                        <label htmlFor="num_posts" className={labelCls}>Number of posts ({LIMITS.num_posts.min}–{LIMITS.num_posts.max})</label>
                        <div className={fieldShell}>
                          <Controller
                            name="num_posts"
                            control={control}
                            render={({ field }) => (
                              <input id="num_posts" type="number" className={inputCls} value={field.value} onChange={(e) => field.onChange(clamp(Number(e.target.value) || 0, LIMITS.num_posts.min, LIMITS.num_posts.max))} />
                            )}
                          />
                        </div>
                        {errors.num_posts && <p className={errCls}>{errors.num_posts.message}</p>}
                      </div>
                    )}
                    {showField("volume", "num_image_designs") && (
                      <div>
                        <label htmlFor="num_image_designs" className={labelCls}>Image design count ({LIMITS.num_image_designs.min}–{LIMITS.num_image_designs.max})</label>
                        <div className={fieldShell}>
                          <Controller
                            name="num_image_designs"
                            control={control}
                            render={({ field }) => (
                              <input id="num_image_designs" type="number" className={inputCls} value={field.value} onChange={(e) => field.onChange(clamp(Number(e.target.value) || 0, LIMITS.num_image_designs.min, LIMITS.num_image_designs.max))} />
                            )}
                          />
                        </div>
                        {errors.num_image_designs && <p className={errCls}>{errors.num_image_designs.message}</p>}
                      </div>
                    )}
                  </div>
                )}
                {showField("volume", "num_video_prompts") && (
                  <div>
                    <label htmlFor="num_video_prompts" className={labelCls}>Video count ({LIMITS.num_video_prompts.min}–{LIMITS.num_video_prompts.max})</label>
                    <div className={fieldShell}>
                      <Controller
                        name="num_video_prompts"
                        control={control}
                        render={({ field }) => (
                          <input id="num_video_prompts" type="number" className={inputCls} value={field.value} onChange={(e) => field.onChange(clamp(Number(e.target.value) || 0, LIMITS.num_video_prompts.min, LIMITS.num_video_prompts.max))} />
                        )}
                      />
                    </div>
                    {errors.num_video_prompts && <p className={errCls}>{errors.num_video_prompts.message}</p>}
                  </div>
                )}
                {showField("volume", "email") && (
                  <div>
                    <label htmlFor="email" className={labelCls}>Email for kit delivery (optional)</label>
                    <div className={fieldShell}><input id="email" type="email" className={inputCls} {...register("email")} /></div>
                    {errors.email && <p className={errCls}>{errors.email.message}</p>}
                  </div>
                )}
              </div>
            )}

            {err && <p className="mt-4 text-error dark:text-brand-accent">{err}</p>}

            {isFinalStep && !loading && (
              <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 p-4 dark:border-brand-primary/40 dark:bg-brand-primary/15">
                {!confirmSubmit ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">Ready to generate</p>
                      <p className="text-xs text-on-surface-variant">Expected time: around 10–30 seconds.</p>
                    </div>
                    <button type="button" className={btnPrimary + " py-2 text-sm"} onClick={() => setConfirmSubmit(true)}>
                      Continue
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-on-surface">
                      We will submit your data now and open the result in <code>{props.routeHint}</code>.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" className={btnSecondary + " py-2 text-sm"} onClick={() => setConfirmSubmit(false)}>
                        Cancel and edit
                      </button>
                      <button
                        type="button"
                        className={btnPrimary + " py-2 text-sm"}
                        onClick={handleSubmit(onValidSubmit)}
                        disabled={loading}
                      >
                        Start generating
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" className={btnSecondary} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading}>
                Back
              </button>
              {step < maxStep ? (
                <button type="button" className={btnPrimary} onClick={() => void next()} disabled={loading}>
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => setConfirmSubmit((v) => !v)}
                  disabled={loading}
                >
                  {loading ? "Generating..." : confirmSubmit ? "Hide confirmation" : "Review before generate"}
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

