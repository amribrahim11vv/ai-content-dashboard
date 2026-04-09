import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useNavigate } from "react-router-dom";
import { listPromptCatalogIndustries } from "../../api";
import { BRIEF_LIMITS, briefSchema, initialBriefForm } from "../../briefSchema";
import PillGroup from "../../components/selection/PillGroup";
import SelectableCard from "../../components/selection/SelectableCard";
import ReferenceImageUploader from "../../components/ReferenceImageUploader";
import AdditionalNotes from "../../components/AdditionalNotes";
import {
  decodeMultiSelection,
  decodeSingleSelection,
  encodeMultiSelection,
  encodeSingleSelection,
} from "../../lib/selectionFieldCodec";
import type { BriefForm } from "../../types";
import {
  BRAND_TONE_OPTIONS,
  MAIN_GOAL_OPTIONS,
  OTHER_OPTION,
  PLATFORM_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from "./selectionOptions";
import { getWizardTypeFromDraftKey } from "../../lib/wizardAnalytics";
import { useWizardTelemetry } from "./hooks/useWizardTelemetry";
import { useWizardSubmission } from "./hooks/useWizardSubmission";
import { useWizardDraft } from "./hooks/useWizardDraft";
import { useWizardOrchestrator } from "./hooks/useWizardOrchestrator";
import WizardStepChips from "./components/WizardStepChips";
import WizardValuePreview from "./components/WizardValuePreview";

type StepId = "brand" | "audience" | "channels" | "offer" | "creative" | "volume";

type SelectionState = {
  mainGoalSelected: string;
  mainGoalOther: string;
  brandToneSelected: string;
  brandToneOther: string;
  audienceSelected: string[];
  audienceOther: string;
  platformsSelected: string[];
  platformsOther: string;
};

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
  creative: ["visual_notes", "reference_image", "campaign_duration", "budget_level", "best_content_types"],
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
const selectCls =
  "w-full rounded-lg border-none bg-surface-container-lowest px-4 py-3 text-on-surface focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary/45 dark:bg-surface-container-high/70";
const textareaCls = cn(inputCls, "min-h-[100px] resize-y");
const errCls = "mt-1 text-sm text-error";
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

  const [isOtherIndustry, setIsOtherIndustry] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const {
    register,
    control,
    setValue,
    watch,
    reset,
    getValues,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<BriefForm>({
    resolver: zodResolverMemo,
    defaultValues: mergedDefaults,
    mode: "onTouched",
  });

  const {
    initialState,
    step,
    setStep,
    showDraftBanner,
    clearStoredDraft,
  } = useWizardDraft({
    draftKey: props.draftKey,
    mergedDefaults,
    maxStep,
    limits: LIMITS as unknown as Record<string, { min: number; max: number }>,
    watch: (cb) => watch(cb),
    getValues,
  });

  const [selectionState, setSelectionState] = useState<SelectionState>(() => {
    const goal = decodeSingleSelection(initialState.form.main_goal, MAIN_GOAL_OPTIONS);
    const tone = decodeSingleSelection(initialState.form.brand_tone, BRAND_TONE_OPTIONS);
    const audience = decodeMultiSelection(initialState.form.target_audience, TARGET_AUDIENCE_OPTIONS);
    const platforms = decodeMultiSelection(initialState.form.platforms, PLATFORM_OPTIONS);
    return {
      mainGoalSelected: goal.selected,
      mainGoalOther: goal.otherText,
      brandToneSelected: tone.selected,
      brandToneOther: tone.otherText,
      audienceSelected: audience.selected,
      audienceOther: audience.otherText,
      platformsSelected: platforms.selected,
      platformsOther: platforms.otherText,
    };
  });

  function showField(step: StepId, key: keyof BriefForm): boolean {
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
    reset(initialState.form);
  }, [initialState.form, reset]);

  const telemetry = useWizardTelemetry({
    wizardType,
    draftKey: props.draftKey,
    step,
    stepOrder: props.stepOrder,
    maxStep,
    restoredDraft: initialState.hadDraft,
  });

  const clearDraft = () => {
    reset(mergedDefaults);
    setSelectionState({
      mainGoalSelected: "",
      mainGoalOther: "",
      brandToneSelected: "",
      brandToneOther: "",
      audienceSelected: [],
      audienceOther: "",
      platformsSelected: [],
      platformsOther: "",
    });
    setStep(0);
    clearStoredDraft();
  };

  const toggleListValue = (list: readonly string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  useEffect(() => {
    const serializedGoal = encodeSingleSelection(
      selectionState.mainGoalSelected,
      selectionState.mainGoalOther,
      MAIN_GOAL_OPTIONS
    );
    const serializedTone = encodeSingleSelection(
      selectionState.brandToneSelected,
      selectionState.brandToneOther,
      BRAND_TONE_OPTIONS
    );
    const serializedAudience = encodeMultiSelection(
      selectionState.audienceSelected,
      selectionState.audienceOther,
      TARGET_AUDIENCE_OPTIONS
    );
    const serializedPlatforms = encodeMultiSelection(
      selectionState.platformsSelected,
      selectionState.platformsOther,
      PLATFORM_OPTIONS
    );

    setValue("main_goal", serializedGoal, { shouldDirty: true });
    setValue("brand_tone", serializedTone, { shouldDirty: true });
    setValue("target_audience", serializedAudience, { shouldDirty: true });
    setValue("platforms", serializedPlatforms, { shouldDirty: true });
  }, [selectionState, setValue]);

  const { next } = useWizardOrchestrator({
    step,
    maxStep,
    stepOrder: props.stepOrder,
    stepFieldMap,
    trigger,
    setStep,
    onStepValidationFailed: (current) => {
      telemetry.emit({
        name: "wizard_step_validation_failed",
        wizard_type: wizardType,
        draft_key: props.draftKey,
        step_index: step,
        step_id: current,
        validation_state: "failed",
        elapsed_time_ms: telemetry.getElapsedMs(),
      });
    },
    onStepAdvance: () => {
      const current = props.stepOrder[step]!;
      telemetry.emit({
        name: "wizard_step_next_clicked",
        wizard_type: wizardType,
        draft_key: props.draftKey,
        step_index: step,
        step_id: current,
        validation_state: "passed",
        elapsed_time_ms: telemetry.getElapsedMs(),
      });
    },
  });

  const submission = useWizardSubmission({
    draftKey: props.draftKey,
    wizardType,
    step,
    stepOrder: props.stepOrder,
    createIdempotencyKey: () => crypto.randomUUID(),
    clearDraft: () => localStorage.removeItem(props.draftKey),
    navigateToKit: (kitId) => nav(`/kits/${kitId}`),
    clampCounts: (form) => ({
      ...form,
      num_posts: clamp(form.num_posts, LIMITS.num_posts.min, LIMITS.num_posts.max),
      num_image_designs: clamp(form.num_image_designs, LIMITS.num_image_designs.min, LIMITS.num_image_designs.max),
      num_video_prompts: clamp(form.num_video_prompts, LIMITS.num_video_prompts.min, LIMITS.num_video_prompts.max),
    }),
    emit: telemetry.emit,
    getElapsedMs: telemetry.getElapsedMs,
  });
  const onValidSubmit = submission.onValidSubmit;
  const loading = submission.loading;
  const err = submission.error;

  useEffect(() => {
    if (!loading || reduceMotion) return;
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % WAITING_STAGES.length), 4500);
    return () => clearInterval(id);
  }, [loading, reduceMotion]);

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
              <WizardValuePreview
                wizardType={wizardType}
                brandName={String(brandNameValue ?? "")}
                industry={String(industryValue ?? "")}
                direction={String(mainGoalValue || audienceValue || "audience-led growth")}
              />
            )}

            <WizardStepChips stepOrder={props.stepOrder} currentStep={step} stepTitles={props.stepTitles} />

            {currentStep === "brand" && (
                <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="brand_name" className={labelCls}>Brand name</label>
                  <div className={fieldShell}><input id="brand_name" className={inputCls} {...register("brand_name")} /></div>
                  {errors.brand_name && <p className={errCls}>{errors.brand_name.message}</p>}
                </div>
                <div>
                  <label htmlFor="industry" className={labelCls}>Industry</label>
                  <div className={fieldShell}>
                    <Controller
                      name="industry"
                      control={control}
                      render={({ field }) => (
                        <select
                          id="industry"
                          className={selectCls}
                          value={isOtherIndustry ? "__other__" : (field.value || "")}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__other__") {
                              setIsOtherIndustry(true);
                              field.onChange("");
                              return;
                            }
                            setIsOtherIndustry(false);
                            field.onChange(v);
                          }}
                        >
                          <option value="">Select industry…</option>
                          {industryOptions.map((i) => (
                            <option key={i.slug} value={i.slug}>
                              {i.name}
                            </option>
                          ))}
                          <option value="__other__">Other (write manually)</option>
                        </select>
                      )}
                    />
                  </div>
                  {isOtherIndustry && (
                    <div className={fieldShell + " mt-3"}>
                      <Controller
                        name="industry"
                        control={control}
                        render={({ field }) => (
                          <input
                            id="industry_other"
                            className={inputCls}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value)}
                            placeholder="Write your industry..."
                          />
                        )}
                      />
                    </div>
                  )}
                  {errors.industry && <p className={errCls}>{errors.industry.message}</p>}
                </div>
              </div>
            )}

            {currentStep === "audience" && (
              <div className="space-y-6">
                {showField("audience", "target_audience") && (
                  <div>
                    <label className={labelCls}>Target audience</label>
                    <PillGroup
                      options={TARGET_AUDIENCE_OPTIONS}
                      selectedValues={selectionState.audienceSelected}
                      onToggle={(value) => {
                        setSelectionState((prev) => ({
                          ...prev,
                          audienceSelected: toggleListValue(prev.audienceSelected, value),
                        }));
                      }}
                    />
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:bg-surface-container-highest"
                      onClick={() =>
                        setSelectionState((prev) => {
                          const enabled = !!prev.audienceOther.trim() || prev.audienceSelected.includes(OTHER_OPTION.value);
                          return {
                            ...prev,
                            audienceSelected: enabled
                              ? prev.audienceSelected.filter((v) => v !== OTHER_OPTION.value)
                              : [...prev.audienceSelected, OTHER_OPTION.value],
                          };
                        })
                      }
                    >
                      <span>{OTHER_OPTION.icon}</span>
                      <span>{OTHER_OPTION.labelAr}</span>
                    </button>
                    {selectionState.audienceSelected.includes(OTHER_OPTION.value) && (
                      <div className={fieldShell + " mt-3"}>
                        <input
                          id="target_audience_other"
                          className={inputCls}
                          value={selectionState.audienceOther}
                          onChange={(e) => setSelectionState((prev) => ({ ...prev, audienceOther: e.target.value }))}
                          placeholder="اكتب جمهورك المستهدف..."
                        />
                      </div>
                    )}
                    {errors.target_audience && <p className={errCls}>{errors.target_audience.message}</p>}
                  </div>
                )}
                {showField("audience", "main_goal") && (
                  <div>
                    <label className={labelCls}>Main campaign goal</label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {MAIN_GOAL_OPTIONS.map((option) => (
                        <SelectableCard
                          key={option.value}
                          label={option.labelAr}
                          icon={option.icon}
                          selected={selectionState.mainGoalSelected === option.value}
                          onClick={() =>
                            setSelectionState((prev) => ({
                              ...prev,
                              mainGoalSelected: option.value,
                              mainGoalOther: "",
                            }))
                          }
                        />
                      ))}
                      <SelectableCard
                        label={OTHER_OPTION.labelAr}
                        icon={OTHER_OPTION.icon}
                        selected={selectionState.mainGoalSelected === OTHER_OPTION.value}
                        onClick={() =>
                          setSelectionState((prev) => ({
                            ...prev,
                            mainGoalSelected: OTHER_OPTION.value,
                          }))
                        }
                      />
                    </div>
                    {selectionState.mainGoalSelected === OTHER_OPTION.value && (
                      <div className={fieldShell + " mt-3"}>
                        <input
                          id="main_goal_other"
                          className={inputCls}
                          value={selectionState.mainGoalOther}
                          onChange={(e) => setSelectionState((prev) => ({ ...prev, mainGoalOther: e.target.value }))}
                          placeholder="اكتب هدف الحملة..."
                        />
                      </div>
                    )}
                    {errors.main_goal && <p className={errCls}>{errors.main_goal.message}</p>}
                  </div>
                )}
              </div>
            )}

            {currentStep === "channels" && (
              <div className="space-y-6">
                {showField("channels", "platforms") && (
                  <div>
                    <label className={labelCls}>Active platforms</label>
                    <PillGroup
                      options={PLATFORM_OPTIONS}
                      selectedValues={selectionState.platformsSelected}
                      onToggle={(value) =>
                        setSelectionState((prev) => ({
                          ...prev,
                          platformsSelected: toggleListValue(prev.platformsSelected, value),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:bg-surface-container-highest"
                      onClick={() =>
                        setSelectionState((prev) => {
                          const enabled = !!prev.platformsOther.trim() || prev.platformsSelected.includes(OTHER_OPTION.value);
                          return {
                            ...prev,
                            platformsSelected: enabled
                              ? prev.platformsSelected.filter((v) => v !== OTHER_OPTION.value)
                              : [...prev.platformsSelected, OTHER_OPTION.value],
                          };
                        })
                      }
                    >
                      <span>{OTHER_OPTION.icon}</span>
                      <span>{OTHER_OPTION.labelAr}</span>
                    </button>
                    {selectionState.platformsSelected.includes(OTHER_OPTION.value) && (
                      <div className={fieldShell + " mt-3"}>
                        <input
                          id="platforms_other"
                          className={inputCls}
                          value={selectionState.platformsOther}
                          onChange={(e) => setSelectionState((prev) => ({ ...prev, platformsOther: e.target.value }))}
                          placeholder="اكتب منصة إضافية..."
                        />
                      </div>
                    )}
                    {errors.platforms && <p className={errCls}>{errors.platforms.message}</p>}
                  </div>
                )}
                {(showField("channels", "brand_tone") || showField("channels", "brand_colors")) && (
                  <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                    {showField("channels", "brand_tone") && (
                      <div>
                        <label className={labelCls}>Brand tone</label>
                        <div className="space-y-3">
                          {BRAND_TONE_OPTIONS.map((option) => (
                            <SelectableCard
                              key={option.value}
                              label={option.labelAr}
                              icon={option.icon}
                              selected={selectionState.brandToneSelected === option.value}
                              onClick={() =>
                                setSelectionState((prev) => ({
                                  ...prev,
                                  brandToneSelected: option.value,
                                  brandToneOther: "",
                                }))
                              }
                            />
                          ))}
                          <SelectableCard
                            label={OTHER_OPTION.labelAr}
                            icon={OTHER_OPTION.icon}
                            selected={selectionState.brandToneSelected === OTHER_OPTION.value}
                            onClick={() =>
                              setSelectionState((prev) => ({
                                ...prev,
                                brandToneSelected: OTHER_OPTION.value,
                              }))
                            }
                          />
                        </div>
                        {selectionState.brandToneSelected === OTHER_OPTION.value && (
                          <div className={fieldShell + " mt-3"}>
                            <input
                              id="brand_tone_other"
                              className={inputCls}
                              value={selectionState.brandToneOther}
                              onChange={(e) => setSelectionState((prev) => ({ ...prev, brandToneOther: e.target.value }))}
                              placeholder="اكتب نبرة البراند..."
                            />
                          </div>
                        )}
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
                  <AdditionalNotes {...register("visual_notes")} error={errors.visual_notes?.message} />
                )}
                {showField("creative", "reference_image") && (
                  <div>
                    <ReferenceImageUploader
                      value={watch("reference_image") || ""}
                      onChange={(nextValue) => setValue("reference_image", nextValue, { shouldDirty: true })}
                      disabled={loading}
                    />
                    {errors.reference_image && <p className={errCls}>{errors.reference_image.message}</p>}
                  </div>
                )}
                {(showField("creative", "campaign_duration") || showField("creative", "budget_level")) && (
                  <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
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
                  <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
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

