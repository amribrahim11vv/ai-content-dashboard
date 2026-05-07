import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useNavigate } from "react-router-dom";
import { BRIEF_LIMITS, briefSchema, initialBriefForm } from "../../briefSchema";
import PillGroup from "../../components/selection/PillGroup";
import SelectableCard from "../../components/selection/SelectableCard";
import ReferenceImageUploader from "../../components/ReferenceImageUploader";
import AdditionalNotes from "../../components/AdditionalNotes";
import {
  decodeMultiSelection,
  decodeSingleSelection,
  encodeSingleSelection,
} from "../../lib/selectionFieldCodec";
import type { BriefForm } from "../../types";
import {
  BEST_CONTENT_TYPE_OPTIONS,
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
import { isWizardVariantB } from "../../lib/wizardExperiment";
import { isAgencyEdition } from "../../lib/appEdition";
import { useAuth } from "../../auth/AuthContext";

type StepId = "diagnosis" | "brand" | "audience" | "channels" | "offer" | "creative" | "volume";

type SelectionState = {
  mainGoalSelected: string;
  mainGoalOther: string;
  brandToneSelected: string;
  brandToneOther: string;
  audienceSelected: string[];
  audienceOther: string;
  platformsSelected: string[];
  platformsOther: string;
  bestContentTypesSelected: string[];
  bestContentTypesOther: string;
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
const FALLBACK_INDUSTRY_DISPLAY: Record<string, string> = {
  ecommerce: "متاجر إلكترونية (E-commerce)",
  "real-estate": "عقارات",
  restaurants: "مطاعم وكافيهات",
  clinics: "عيادات وطب",
  education: "تعليم",
  general: "عام",
};
const FALLBACK_INDUSTRY_OPTIONS: { slug: string; name: string }[] = (
  ["ecommerce", "real-estate", "restaurants", "clinics", "education", "general"] as const
).map((slug) => ({ slug, name: FALLBACK_INDUSTRY_DISPLAY[slug] ?? slug.replace(/-/g, " ") }));
const WAITING_STAGES = [
  {
    title: "بنحلل البراند بتاعك",
    hint: "بنراجع الداتا وأهداف حملتك عشان نحدد الاتجاه الاستراتيجي الصح.",
  },
  {
    title: "بنجهز زوايا و (Hooks) بتجيب من الآخر",
    hint: "بنكتب الزوايا الإعلانية ورسايل السوشيال ميديا اللي تناسب مسارك.",
  },
  {
    title: "بنحضر أفكار وتوجيهات الديزاين",
    hint: "بنرتب المحتوى الإبداعي وبنقفل باقة المحتوى بتاعتك عشان تستلمها.",
  },
] as const;

const STREAM_STATUS_STEPS: Array<{ key: string; label: string }> = [
  { key: "starting", label: "بنبدأ" },
  { key: "generating", label: "بننشئ المحتوى" },
  { key: "hydrating", label: "بننسق الدنيا" },
  { key: "persisting", label: "بنقفل الشغل" },
];

const STREAM_SECTION_LABELS: Record<string, string> = {
  narrative_summary: "ملخص القصة",
  diagnosis_plan: "خطة التشخيص",
  posts: "بوستات",
  image_designs: "أفكار صور",
  video_prompts: "سكريبتات فيديوهات",
  marketing_strategy: "استراتيجية تسويق",
  sales_system: "سيستم مبيعات",
  offer_optimization: "تظبيط العرض",
};

const STEP_FIELDS: Record<StepId, (keyof BriefForm)[]> = {
  diagnosis: [
    "diagnostic_role",
    "diagnostic_account_stage",
    "diagnostic_followers_band",
    "diagnostic_primary_blocker",
    "diagnostic_revenue_goal",
  ],
  brand: ["client_name", "client_phone", "client_email", "brand_name", "industry", "business_links"],
  audience: ["target_audience", "main_goal"],
  channels: ["platforms", "brand_tone", "brand_colors"],
  offer: ["offer", "competitors", "product_details"],
  creative: ["visual_notes", "product_details", "reference_image", "campaign_duration", "budget_level", "best_content_types"],
  volume: [],
};

function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function buildMultiArray(selected: readonly string[], otherText: string): string[] {
  const values = selected.filter((v) => v && v !== OTHER_OPTION.value);
  const other = otherText.trim();
  if (other) values.push(other);
  return Array.from(new Set(values));
}

const labelCls = "mb-2 ms-0.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400";
const fieldShell = "overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] transition-colors focus-within:border-gray-900 dark:focus-within:border-white/30";
const inputCls =
  "block box-border w-full rounded-xl border-none bg-transparent px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-0 focus:outline-none";
const selectCls =
  "block box-border w-full appearance-none rounded-xl border-none bg-transparent px-4 py-3 text-gray-900 dark:text-gray-100 focus:ring-0 focus:outline-none";
const textareaCls = cn(inputCls, "min-h-[100px] resize-y");
const errCls = "mt-1.5 text-sm font-medium text-red-500 dark:text-red-400";
const btnPrimary =
  "rounded-lg bg-gray-900 text-white dark:bg-white dark:text-black px-6 py-3 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-800 dark:hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-2 dark:focus:ring-offset-black";
const btnSecondary =
  "rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white transition-all hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/20";

export default function WizardCore(props: WizardCoreProps) {
  const { entitlements } = useAuth();
  const currentPlan = entitlements?.plan_code ?? "starter";
  const isPremiumUser = Boolean(entitlements?.is_premium);
  const referenceImageLocked = currentPlan === "starter";
  const nav = useNavigate();
  const maxStep = props.stepOrder.length - 1;
  const premiumStepIndex = props.stepOrder.indexOf("volume");
  const freeSubmitStep = premiumStepIndex > 0 ? premiumStepIndex - 1 : maxStep;
  const effectiveMaxStep = isPremiumUser ? maxStep : freeSubmitStep;
  const wizardType = useMemo(() => getWizardTypeFromDraftKey(props.draftKey), [props.draftKey]);
  const mergedDefaults = useMemo(() => ({ ...initialBriefForm(), ...(props.defaults ?? {}) }), [props.defaults]);
  const stepFieldMap = useMemo(() => ({ ...STEP_FIELDS, ...(props.stepFields ?? {}) }), [props.stepFields]);
  const zodSchema = props.formSchema ?? briefSchema;
  const zodResolverMemo = useMemo(() => zodResolver(zodSchema), [zodSchema]);
  const industryOptions = FALLBACK_INDUSTRY_OPTIONS;
  const variantB = isWizardVariantB();
  const agencyEdition = isAgencyEdition();

  const [isOtherIndustry, setIsOtherIndustry] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [stepBlockError, setStepBlockError] = useState<string | null>(null);

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
  const [wizardData, setWizardData] = useState<BriefForm>(mergedDefaults);

  const updateWizardData = (newData: Partial<BriefForm>) => {
    setWizardData((prev) => ({ ...prev, ...newData }));
    for (const [key, value] of Object.entries(newData)) {
      setValue(key as keyof BriefForm, value as BriefForm[keyof BriefForm], { shouldDirty: true });
    }
  };

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
    const bestContentTypes = decodeMultiSelection(initialState.form.best_content_types, BEST_CONTENT_TYPE_OPTIONS);
    return {
      mainGoalSelected: goal.selected,
      mainGoalOther: goal.otherText,
      brandToneSelected: tone.selected,
      brandToneOther: tone.otherText,
      audienceSelected: audience.selected,
      audienceOther: audience.otherText,
      platformsSelected: platforms.selected,
      platformsOther: platforms.otherText,
      bestContentTypesSelected: bestContentTypes.selected,
      bestContentTypesOther: bestContentTypes.otherText,
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
    setWizardData(initialState.form);
  }, [initialState.form, reset]);

  useEffect(() => {
    setValue("source_mode", agencyEdition ? "agency" : "self_serve", { shouldDirty: true });
  }, [agencyEdition, setValue]);

  useEffect(() => {
    const subscription = watch((value) => {
      setWizardData((prev) => ({ ...prev, ...(value as Partial<BriefForm>) }));
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  useEffect(() => {
    if (step > effectiveMaxStep) {
      setStep(effectiveMaxStep);
    }
  }, [effectiveMaxStep, setStep, step]);

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
    setWizardData(mergedDefaults);
    setSelectionState({
      mainGoalSelected: "",
      mainGoalOther: "",
      brandToneSelected: "",
      brandToneOther: "",
      audienceSelected: [],
      audienceOther: "",
      platformsSelected: [],
      platformsOther: "",
      bestContentTypesSelected: [],
      bestContentTypesOther: "",
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
    const audienceArray = buildMultiArray(selectionState.audienceSelected, selectionState.audienceOther);
    const platformsArray = buildMultiArray(selectionState.platformsSelected, selectionState.platformsOther);
    const bestContentTypesArray = buildMultiArray(
      selectionState.bestContentTypesSelected,
      selectionState.bestContentTypesOther
    );

    setValue("main_goal", serializedGoal, { shouldDirty: true });
    setValue("brand_tone", serializedTone, { shouldDirty: true });
    setValue("target_audience", audienceArray, { shouldDirty: true });
    setValue("platforms", platformsArray, { shouldDirty: true });
    setValue("best_content_types", bestContentTypesArray, { shouldDirty: true });
  }, [selectionState, setValue]);

  const { next } = useWizardOrchestrator({
    step,
    maxStep: effectiveMaxStep,
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
    navigateToKit: (kitId) => {
      if (agencyEdition) {
        const intent = isPremiumUser ? "paid" : "free";
        nav(`/order-received?kit=${encodeURIComponent(kitId)}&intent=${intent}`);
        return;
      }
      nav(`/kits/${kitId}`);
    },
    clampCounts: (form) => ({
      ...form,
      num_posts: clamp(form.num_posts, LIMITS.num_posts.min, LIMITS.num_posts.max),
      num_image_designs: clamp(form.num_image_designs, LIMITS.num_image_designs.min, LIMITS.num_image_designs.max),
      num_video_prompts: clamp(form.num_video_prompts, LIMITS.num_video_prompts.min, LIMITS.num_video_prompts.max),
      content_package_idea_count: clamp(
        form.content_package_idea_count,
        LIMITS.content_package_idea_count.min,
        LIMITS.content_package_idea_count.max
      ),
    }),
    emit: telemetry.emit,
    getElapsedMs: telemetry.getElapsedMs,
  });
  const onValidSubmit = submission.onValidSubmit;
  const loading = submission.loading;
  const err = submission.error;
  const displayProgressPct = Math.round(displayProgress * 100);
  const activeStreamStepIndex = Math.max(
    0,
    STREAM_STATUS_STEPS.findIndex((item) => item.key === submission.streamStatus)
  );
  const streamSectionBadges = submission.streamCompletedSections
    .map((section) => STREAM_SECTION_LABELS[section] ?? section.replace(/_/g, " "))
    .slice(0, 6);
  const partialSummary = typeof submission.streamSnapshot?.narrative_summary === "string"
    ? submission.streamSnapshot.narrative_summary
    : "";
  const reasoningTraceLines = submission.reasoningTrace.slice(-8);

  useEffect(() => {
    if (!loading || reduceMotion) return;
    const intervalMs = submission.streamStatus === "hydrating" ? 2600 : 3400;
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % WAITING_STAGES.length), intervalMs);
    return () => clearInterval(id);
  }, [loading, reduceMotion, submission.streamStatus]);

  useEffect(() => {
    if (!loading) {
      setDisplayProgress(0);
      return;
    }
    if (reduceMotion) {
      setDisplayProgress(submission.streamProgress ?? 0);
      return;
    }
    let raf = 0;
    const target = Math.max(0, Math.min(1, submission.streamProgress ?? 0));
    const tick = () => {
      setDisplayProgress((prev) => {
        const delta = target - prev;
        if (Math.abs(delta) < 0.004) return target;
        return prev + delta * 0.18;
      });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [loading, reduceMotion, submission.streamProgress]);

  const currentStep = props.stepOrder[step]!;
  const isFinalStep = step === effectiveMaxStep;
  const brandNameValue = watch("brand_name");
  const industryValue = watch("industry");
  const mainGoalValue = watch("main_goal");
  const audienceValue = watch("target_audience");
  const hasAudience = Array.isArray(audienceValue) && audienceValue.length > 0;
  const canShowValuePreview =
    step >= 1 &&
    Boolean(brandNameValue?.trim()) &&
    Boolean(industryValue?.trim()) &&
    (Boolean(mainGoalValue?.trim()) || hasAudience);

  return (
    <div className="mx-auto w-full max-w-6xl px-2 sm:px-4">
      <div className="mb-8 md:mb-10">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl md:text-4xl">{props.title}</h2>
        <p className="mt-2 max-w-3xl text-on-surface-variant">
          {agencyEdition
            ? "ادينا تفاصيل مشروعك، وفريقنا هيجهزلك خطة محتوى متكاملة وجاهزة للتنفيذ على طول."
            : props.subtitle}
        </p>
      </div>

      {showDraftBanner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-[#111]/50 px-5 py-4 text-sm font-medium text-gray-900 dark:text-white shadow-sm backdrop-blur-sm">
          <span>رجعنالك المسودة اللي كنت حافظها للطلب ده.</span>
          <button type="button" className={btnSecondary + " !py-2 !text-xs"} onClick={clearDraft}>
            امسح المسودة
          </button>
        </div>
      )}

      <div className="wizard-root overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0c0c0e] sm:rounded-[2rem] shadow-sm" aria-busy={loading}>
        <div className={cn("wizard-body-wrap relative", loading && "wizard-body-wrap--loading")}>
          <div className="wizard-body p-5 sm:p-8 md:p-10 lg:p-12">
            <div className={cn("grid gap-8", agencyEdition && "lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start")}>
              {agencyEdition && (
                <aside className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-[#121214] p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">خطوات الشغل</p>
                  <ul className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <li>١) ابعت تفاصيل مشروعك</li>
                    <li>٢) فريقنا بيراجع استراتيجيتك</li>
                    <li>٣) بنسلمك باقة محتوى متظبطة وجاهزة</li>
                  </ul>
                  <div className="mt-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 p-3 text-xs text-gray-600 dark:text-gray-400">
                    فريق المبيعات بتاعنا هيكلمك بعد ما تبعت الطلب عشان ننسق ميعاد التسليم.
                  </div>
                </aside>
              )}
              <div>
            <div className="mb-8 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#111] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                <span>
                  خطوة {step + 1} من {maxStep + 1}
                </span>
                <span className="text-gray-900 dark:text-white">{props.stepTitles[currentStep]}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gray-900 dark:bg-white transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(8, Math.round(((step + 1) / (maxStep + 1)) * 100))}%` }}
                />
              </div>
            </div>

            {canShowValuePreview && (
              <WizardValuePreview
                wizardType={wizardType}
                brandName={String(brandNameValue ?? "")}
                industry={String(industryValue ?? "")}
                direction={String(mainGoalValue || audienceValue || "audience-led growth")}
              />
            )}

            <WizardStepChips
              stepOrder={props.stepOrder}
              currentStep={step}
              stepTitles={props.stepTitles}
              blockedSteps={!isPremiumUser && premiumStepIndex >= 0 ? [premiumStepIndex] : []}
              onStepClick={(targetStep) => {
                if (!isPremiumUser && premiumStepIndex >= 0 && targetStep >= premiumStepIndex) {
                  setStepBlockError("لازم ترقي باقتك عشان تفتح الإعدادات المتقدمة دي");
                  return;
                }
                setStep(targetStep);
                setStepBlockError(null);
              }}
            />

            {variantB && currentStep === "diagnosis" && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="diagnostic_role" className={labelCls}>
                    إنت مين في دول؟
                  </label>
                  <div className={fieldShell}>
                    <select id="diagnostic_role" className={selectCls} {...register("diagnostic_role")}>
                      <option value="">اختار دورك...</option>
                      <option value="entrepreneur-founder">رائد أعمال / مؤسس</option>
                      <option value="coach-consultant">كوتش أو مستشار</option>
                      <option value="doctor-expert-professional">دكتور / خبير / محترف</option>
                      <option value="freelancer-creative">فريلانسر أو مبدع</option>
                    </select>
                  </div>
                  {errors.diagnostic_role && <p className={errCls}>{errors.diagnostic_role.message}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="diagnostic_account_stage" className={labelCls}>
                      مرحلة البيزنس
                    </label>
                    <div className={fieldShell}>
                      <select id="diagnostic_account_stage" className={selectCls} {...register("diagnostic_account_stage")}>
                        <option value="">اختار المرحلة...</option>
                        <option value="under-6-months">لسه ببدأ (أقل من ٦ شهور)</option>
                        <option value="6-12-months">من ٦ شهور لسنة</option>
                        <option value="1-3-years">من سنة لـ ٣ سنين (النتايج مش ثابتة)</option>
                        <option value="3-plus-years">أكتر من ٣ سنين (عايز أكسيل وأكبر)</option>
                      </select>
                    </div>
                    {errors.diagnostic_account_stage && <p className={errCls}>{errors.diagnostic_account_stage.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="diagnostic_followers_band" className={labelCls}>
                      عدد المتابعين
                    </label>
                    <div className={fieldShell}>
                      <select id="diagnostic_followers_band" className={selectCls} {...register("diagnostic_followers_band")}>
                        <option value="">اختار العدد...</option>
                        <option value="under-1k">أقل من ١,٠٠٠</option>
                        <option value="1k-5k">من ١,٠٠٠ لـ ٥,٠٠٠</option>
                        <option value="5k-20k">من ٥,٠٠٠ لـ ٢٠,٠٠٠</option>
                        <option value="20k-plus">أكتر من ٢٠,٠٠٠</option>
                      </select>
                    </div>
                    {errors.diagnostic_followers_band && <p className={errCls}>{errors.diagnostic_followers_band.message}</p>}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="diagnostic_primary_blocker" className={labelCls}>
                      أكبر مشكلة بتواجهك
                    </label>
                    <div className={fieldShell}>
                      <select id="diagnostic_primary_blocker" className={selectCls} {...register("diagnostic_primary_blocker")}>
                        <option value="">اختار المشكلة الأساسية...</option>
                        <option value="low-reach">الريتش واقع (محدش بيشوف بوستاتي)</option>
                        <option value="no-content-system">مش عارف أنزل إيه باستمرار</option>
                        <option value="no-conversion">عندي فولورز بس مفيش مبيعات</option>
                        <option value="inconsistent-execution">معنديش وقت ومش منتظم خالص</option>
                      </select>
                    </div>
                    {errors.diagnostic_primary_blocker && <p className={errCls}>{errors.diagnostic_primary_blocker.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="diagnostic_revenue_goal" className={labelCls}>
                      التارجت الشهري للمبيعات
                    </label>
                    <div className={fieldShell}>
                      <select id="diagnostic_revenue_goal" className={selectCls} {...register("diagnostic_revenue_goal")}>
                        <option value="">اختار التارجت...</option>
                        <option value="500-1000">$500 – $1,000 في الشهر</option>
                        <option value="1000-3000">$1,000 – $3,000 في الشهر</option>
                        <option value="3000-10000">$3,000 – $10,000 في الشهر</option>
                        <option value="10000-plus">أكتر من $10,000 في الشهر</option>
                      </select>
                    </div>
                    {errors.diagnostic_revenue_goal && <p className={errCls}>{errors.diagnostic_revenue_goal.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {currentStep === "brand" && (
              <div className="space-y-4 sm:space-y-6">
                {agencyEdition && (
                  <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#111] p-4 sm:p-5 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      بيانات التواصل
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="client_name" className={labelCls}>
                          الاسم بالكامل
                        </label>
                        <div className={fieldShell}>
                          <input id="client_name" className={inputCls} placeholder="الاسم بالكامل" {...register("client_name")} />
                        </div>
                        {errors.client_name && <p className={errCls}>{errors.client_name.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="client_phone" className={labelCls}>
                          رقم الموبايل (واتساب)
                        </label>
                        <div className={fieldShell}>
                          <input id="client_phone" className={inputCls} placeholder="+20 ..." {...register("client_phone")} />
                        </div>
                        {errors.client_phone && <p className={errCls}>{errors.client_phone.message}</p>}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="client_email" className={labelCls}>
                        الإيميل
                      </label>
                      <div className={fieldShell}>
                        <input id="client_email" type="email" className={inputCls} placeholder="client@email.com" {...register("client_email")} />
                      </div>
                      {errors.client_email && <p className={errCls}>{errors.client_email.message}</p>}
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="brand_name" className={labelCls}>
                      اسم البراند
                    </label>
                    <div className={fieldShell}><input id="brand_name" className={inputCls} {...register("brand_name")} /></div>
                    {errors.brand_name && <p className={errCls}>{errors.brand_name.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="industry" className={labelCls}>
                      المجال
                    </label>
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
                            <option value="">اختار المجال...</option>
                            {industryOptions.map((i) => (
                              <option key={i.slug} value={i.slug}>
                                {i.name}
                              </option>
                            ))}
                            <option value="__other__">مجال تاني (اكتبه بنفسك)</option>
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
                              placeholder="اكتب مجالك هنا..."
                            />
                          )}
                        />
                      </div>
                    )}
                    {errors.industry && <p className={errCls}>{errors.industry.message}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="business_links" className={labelCls}>
                    لينكات الويب سايت أو السوشيال ميديا (اختياري)
                  </label>
                  <div className={fieldShell}>
                    <textarea
                      id="business_links"
                      className={inputCls + " min-h-[90px] resize-y py-2.5"}
                      placeholder="https://your-site.com, https://instagram.com/yourbrand"
                      {...register("business_links")}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === "audience" && (
              <div className="space-y-6">
                {showField("audience", "target_audience") && (
                  <div>
                    <label className={labelCls}>الجمهور المستهدف</label>
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
                          placeholder="وصف عميلك المثالي إيه؟..."
                        />
                      </div>
                    )}
                    {errors.target_audience && <p className={errCls}>{errors.target_audience.message}</p>}
                  </div>
                )}
                {showField("audience", "main_goal") && (
                  <div>
                    <label className={labelCls}>الهدف الأساسي للحملة</label>
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
                          placeholder="اكتب هدفك هنا..."
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
                    <label className={labelCls}>المنصات اللي شغال عليها</label>
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
                          placeholder="اكتب منصة تانية..."
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
                        <label className={labelCls}>نبرة البراند (Tone of Voice)</label>
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
                              placeholder="وصف نبرة البراند بتاعتك..."
                            />
                          </div>
                        )}
                        {errors.brand_tone && <p className={errCls}>{errors.brand_tone.message}</p>}
                      </div>
                    )}
                    {showField("channels", "brand_colors") && (
                      <div>
                        <label htmlFor="brand_colors" className={labelCls}>
                          ألوان البراند
                        </label>
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
                    <label htmlFor="offer" className={labelCls}>
                      العرض / الرسالة الأساسية
                    </label>
                    <div className={fieldShell}><textarea id="offer" className={textareaCls} {...register("offer")} /></div>
                    {errors.offer && <p className={errCls}>{errors.offer.message}</p>}
                  </div>
                )}
                {showField("offer", "competitors") && (
                  <div>
                    <label htmlFor="competitors" className={labelCls}>
                      أهم المنافسين
                    </label>
                    <div className={fieldShell}><textarea id="competitors" className={textareaCls} {...register("competitors")} /></div>
                  </div>
                )}
                {showField("offer", "product_details") && (
                  <div>
                    <label htmlFor="product_details_offer_agency" className={labelCls} dir="rtl" lang="ar">
                      تفاصيل المنتج / الخدمة (اختياري بس مهم جداً)
                    </label>
                    <div className={fieldShell}>
                      <textarea
                        id="product_details_offer_agency"
                        className={textareaCls}
                        dir="rtl"
                        lang="ar"
                        placeholder="اوصف منتجك بدقة شديدة (مثال: تيشيرت أوفر سايز أسود خامة قطن، أو كنبة مودرن قطيفة كحلي...)."
                        {...register("product_details")}
                      />
                    </div>
                    {errors.product_details && <p className={errCls}>{errors.product_details.message}</p>}
                  </div>
                )}
              </div>
            )}

            {currentStep === "creative" && (
              <div className="space-y-6">
                {showField("creative", "visual_notes") && (
                  <AdditionalNotes {...register("visual_notes")} error={errors.visual_notes?.message} />
                )}
                {showField("creative", "product_details") && (
                  <div>
                    <label htmlFor="product_details" className={labelCls} dir="rtl" lang="ar">
                      تفاصيل المنتج / الخدمة (اختياري بس مهم جداً)
                    </label>
                    <div className={fieldShell}>
                      <textarea
                        id="product_details"
                        className={textareaCls}
                        dir="rtl"
                        lang="ar"
                        placeholder="اوصف منتجك بدقة شديدة (مثال: تيشيرت أوفر سايز أسود خامة قطن، أو كنبة مودرن قطيفة كحلي...)."
                        {...register("product_details")}
                      />
                    </div>
                    {errors.product_details && <p className={errCls}>{errors.product_details.message}</p>}
                  </div>
                )}
                {showField("creative", "reference_image") && (
                  <div>
                    <ReferenceImageUploader
                      value={wizardData.reference_image || ""}
                      onChange={(nextValue) => updateWizardData({ reference_image: nextValue })}
                      disabled={loading || referenceImageLocked}
                    />
                    {referenceImageLocked && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant">
                        <span>🔒 إضافة صور كمرجع (References) متاحة بس في باقة الـ Early Adopter.</span>
                        <button
                          type="button"
                          className="font-bold text-primary underline-offset-2 hover:underline"
                          onClick={() => nav("/pricing")}
                        >
                          رقي باقتك
                        </button>
                      </div>
                    )}
                    {errors.reference_image && <p className={errCls}>{errors.reference_image.message}</p>}
                  </div>
                )}
                {(showField("creative", "campaign_duration") || showField("creative", "budget_level")) && (
                  <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                    {showField("creative", "campaign_duration") && (
                      <div>
                        <label htmlFor="campaign_duration" className={labelCls}>
                          مدة الحملة
                        </label>
                        <div className={fieldShell}><input id="campaign_duration" className={inputCls} {...register("campaign_duration")} /></div>
                        {errors.campaign_duration && <p className={errCls}>{errors.campaign_duration.message}</p>}
                      </div>
                    )}
                    {showField("creative", "budget_level") && (
                      <div>
                        <label htmlFor="budget_level" className={labelCls}>
                          مستوى ميزانية الإعلانات (١-٧)
                        </label>
                        <div className={fieldShell}><input id="budget_level" className={inputCls} {...register("budget_level")} /></div>
                      </div>
                    )}
                  </div>
                )}
                {showField("creative", "best_content_types") && (
                  <div>
                    <label className={labelCls}>أكتر أنواع محتوى بتجيب نتيجة معاك</label>
                    <PillGroup
                      options={BEST_CONTENT_TYPE_OPTIONS}
                      selectedValues={selectionState.bestContentTypesSelected}
                      onToggle={(value) =>
                        setSelectionState((prev) => ({
                          ...prev,
                          bestContentTypesSelected: toggleListValue(prev.bestContentTypesSelected, value),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:bg-surface-container-highest"
                      onClick={() =>
                        setSelectionState((prev) => {
                          const enabled =
                            !!prev.bestContentTypesOther.trim() ||
                            prev.bestContentTypesSelected.includes(OTHER_OPTION.value);
                          return {
                            ...prev,
                            bestContentTypesSelected: enabled
                              ? prev.bestContentTypesSelected.filter((v) => v !== OTHER_OPTION.value)
                              : [...prev.bestContentTypesSelected, OTHER_OPTION.value],
                          };
                        })
                      }
                    >
                      <span>{OTHER_OPTION.icon}</span>
                      <span>{OTHER_OPTION.labelAr}</span>
                    </button>
                    {selectionState.bestContentTypesSelected.includes(OTHER_OPTION.value) && (
                      <div className={fieldShell + " mt-3"}>
                        <input
                          id="best_content_types_other"
                          className={inputCls}
                          value={selectionState.bestContentTypesOther}
                          onChange={(e) =>
                            setSelectionState((prev) => ({ ...prev, bestContentTypesOther: e.target.value }))
                          }
                          placeholder="اكتب نوع محتوى تاني..."
                        />
                      </div>
                    )}
                    {errors.best_content_types && <p className={errCls}>{errors.best_content_types.message}</p>}
                  </div>
                )}
              </div>
            )}

            {currentStep === "volume" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/40 dark:bg-[#121214] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    بناء استراتيجية متقدمة (Premium)
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    ظبط استراتيجيتك في خطوات سريعة من غير ما تملا فورم طويلة ومملة.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>ميكس أعمدة المحتوى (Content Pillars)</label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { key: "Direct Sales", label: "مبيعات مباشر (Sales)", icon: "sell" },
                      { key: "Educational", label: "تعليمي", icon: "school" },
                      { key: "Engagement", label: "تفاعلي (Engagement)", icon: "forum" },
                    ].map((pillar) => (
                      <button
                        key={pillar.key}
                        type="button"
                        onClick={() =>
                          setSelectionState((prev) => ({
                            ...prev,
                            bestContentTypesSelected: toggleListValue(prev.bestContentTypesSelected, pillar.key),
                          }))
                        }
                        className={cn(
                          "rounded-xl border p-3 text-start",
                          selectionState.bestContentTypesSelected.includes(pillar.key)
                            ? "border-gray-900 dark:border-white bg-gray-100 dark:bg-white/10"
                            : "border-gray-200 dark:border-white/10"
                        )}
                      >
                        <p className="text-xs text-gray-500">{pillar.icon}</p>
                        <p className="mt-1 text-sm font-semibold">{pillar.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>تظبيط المحتوى حسب المنصة</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "LinkedIn", label: "لينكد إن" },
                      { value: "TikTok/Reels", label: "تيك توك / ريلز" },
                      { value: "Instagram", label: "إنستجرام" },
                    ].map((platform) => (
                      <button
                        key={platform.value}
                        type="button"
                        onClick={() =>
                          setSelectionState((prev) => ({
                            ...prev,
                            platformsSelected: toggleListValue(prev.platformsSelected, platform.value),
                          }))
                        }
                        className={cn(
                          "rounded-full border px-4 py-2 text-xs font-semibold",
                          selectionState.platformsSelected.includes(platform.value)
                            ? "border-gray-900 dark:border-white bg-gray-900 text-white dark:bg-white dark:text-black"
                            : "border-gray-200 dark:border-white/10"
                        )}
                      >
                        {platform.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>تفاصيل نبرة الصوت</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: "Luxury", label: "فخم (Luxury)" },
                      { key: "Street/Slang", label: "لغة الشارع / روش" },
                      { key: "Sarcastic", label: "ساخر (Sarcastic)" },
                      { key: "Egypt Colloquial Social", label: "مصري عامي" },
                    ].map((tone) => (
                      <button
                        key={tone.key}
                        type="button"
                        onClick={() =>
                          setSelectionState((prev) => ({
                            ...prev,
                            brandToneSelected: tone.key,
                            brandToneOther: "",
                          }))
                        }
                        className={cn(
                          "rounded-xl border px-3 py-2 text-start text-sm",
                          selectionState.brandToneSelected === tone.key
                            ? "border-gray-900 dark:border-white bg-gray-100 dark:bg-white/10"
                            : "border-gray-200 dark:border-white/10"
                        )}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="premium_audience_pain" className={labelCls}>
                    تحليل أعمق للجمهور
                  </label>
                  <div className={fieldShell}>
                    <textarea
                      id="premium_audience_pain"
                      className={textareaCls}
                      placeholder="إيه أكتر وجع (Pain point) عند زبونك؟"
                      value={watch("audience_pain_point") || ""}
                      onChange={(e) => setValue("audience_pain_point", e.target.value, { shouldDirty: true })}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>معدل النشر</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "3 days/week", label: "٣ أيام في الأسبوع" },
                      { value: "5 days/week", label: "٥ أيام في الأسبوع" },
                      { value: "30-day plan", label: "خطة كاملة لـ ٣٠ يوم" },
                    ].map((cadence) => (
                      <button
                        key={cadence.value}
                        type="button"
                        onClick={() => setValue("campaign_duration", cadence.value, { shouldDirty: true })}
                        className={cn(
                          "rounded-full border px-4 py-2 text-xs font-semibold",
                          watch("campaign_duration") === cadence.value
                            ? "border-gray-900 dark:border-white bg-gray-900 text-white dark:bg-white dark:text-black"
                            : "border-gray-200 dark:border-white/10"
                        )}
                      >
                        {cadence.label}
                      </button>
                    ))}
                  </div>
                </div>
                {entitlements && (
                  <div className="rounded-xl border border-outline/20 bg-surface-container-low/60 p-4 text-xs text-on-surface-variant dark:border-outline/25 dark:bg-earth-darkCard/40">
                    <p className="font-semibold text-on-surface">استهلاك باقتك</p>
                    <p className="mt-1">
                      الباقة: <strong>{entitlements.plan_code}</strong> · سكريبتات الفيديوهات:{" "}
                      <strong>{entitlements.usage.video_prompts_used}</strong> · أفكار الصور:{" "}
                      <strong>{entitlements.usage.image_prompts_used}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {stepBlockError && <p className="mt-4 text-red-500">{stepBlockError}</p>}
            {err && <p className="mt-4 text-error dark:text-brand-accent">{err}</p>}

            {isFinalStep && !loading && (
              <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 p-4 dark:border-brand-primary/40 dark:bg-brand-primary/15">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-on-surface">
                    {variantB ? "جاهز تشوف التشخيص وخطة العمل" : "جاهز نطلعلك باقة المحتوى"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    الموضوع بياخد من ١٠ لـ ٣٠ ثانية تقريباً...
                  </p>
                </div>
              </div>
            )}

            {variantB && isFinalStep && !loading && (
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-outline/25 bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">الدور</p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">{watch("diagnostic_role") || "مش متحدد"}</p>
                </div>
                <div className="rounded-xl border border-outline/25 bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">المشكلة الأساسية</p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">{watch("diagnostic_primary_blocker") || "مش متحددة"}</p>
                </div>
                <div className="rounded-xl border border-outline/25 bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">تارجت المبيعات</p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">{watch("diagnostic_revenue_goal") || "مش متحدد"}</p>
                </div>
              </div>
            )}

            {variantB && isFinalStep && !loading && (
              <div className="mb-5 rounded-xl border border-tertiary/25 bg-tertiary/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-tertiary">ليه ده بيجيب نتيجة؟</p>
                <ul className="mt-2 space-y-1 text-sm text-on-surface-variant">
                  <li>- مبني عشان يتنفذ بسهولة ولـ Scale كبير...</li>
                  <li>- تقدر تعيد توليد المحتوى تاني...</li>
                  <li>- كل حاجة بتتحفظ كمسودة أوتوماتيك...</li>
                </ul>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" className={btnSecondary + " w-full sm:w-auto"} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading}>
                رجوع
              </button>
              {step < effectiveMaxStep ? (
                <button type="button" className={btnPrimary + " w-full sm:w-auto"} onClick={() => void next()} disabled={loading}>
                  الخطوة الجاية
                </button>
              ) : (
                <button
                  type="button"
                  className={btnPrimary + " w-full sm:w-auto"}
                  onClick={handleSubmit(onValidSubmit)}
                  disabled={loading}
                >
                  {loading
                    ? variantB
                      ? "بنجهزلك التشخيص..."
                      : "بننشئ المحتوى..."
                    : !isPremiumUser
                      ? "ابعت الطلب (وجرب ببلاش)"
                      : variantB
                        ? "وريني التشخيص والخطة"
                        : "طلعلي باقة المحتوى دلوقتي"}
                </button>
              )}
            </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="wizard-loading-overlay" role="status" aria-live="polite">
              <div className="wizard-indeterminate-track" aria-hidden>
                <div className="wizard-indeterminate-bar" />
              </div>
              <div
                style={{
                  width: "100%",
                  maxWidth: "42rem",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "0.8rem",
                  padding: "0.65rem 0.75rem",
                  marginBottom: "0.7rem",
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "0.35rem",
                  }}
                >
                  {STREAM_STATUS_STEPS.map((step, idx) => {
                    const isDone = idx <= activeStreamStepIndex;
                    return (
                      <div
                        key={step.key}
                        style={{
                          borderRadius: "0.55rem",
                          padding: "0.35rem 0.45rem",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textAlign: "center",
                          letterSpacing: "0.02em",
                          opacity: isDone ? 1 : 0.45,
                          background: isDone ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
                        }}
                      >
                        {step.label}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="wizard-loading-hint" style={{ marginBottom: "0.4rem" }}>
                {submission.streamStatus === "persisting"
                  ? "بنحفظ باقة المحتوى..."
                  : submission.streamStatus === "hydrating"
                    ? "بننسق الأقسام اللي طلعت..."
                    : submission.streamStatus === "completed"
                      ? "بنقفل الشغل..."
                      : "بنطلع المحتوى واحدة واحدة..."}
              </p>
              <p className="wizard-loading-hint" style={{ marginBottom: "0.4rem" }}>
                خلصنا: {displayProgressPct}%
              </p>
              <div className="wizard-progress-track" aria-hidden>
                <div className="wizard-progress-fill" style={{ width: `${Math.max(4, displayProgressPct)}%` }} />
              </div>
              {submission.streamMessage ? (
                <p className="wizard-loading-hint wizard-fade-slide-in" style={{ marginBottom: "0.4rem" }}>
                  {submission.streamMessage}
                </p>
              ) : null}
              {submission.streamSection ? (
                <p className="wizard-loading-hint wizard-fade-slide-in" style={{ marginBottom: "0.4rem" }}>
                  شغالين حالياً على:{" "}
                  <strong>{STREAM_SECTION_LABELS[submission.streamSection] ?? submission.streamSection.replace(/_/g, " ")}</strong>
                </p>
              ) : null}
              {streamSectionBadges.length > 0 ? (
                <div
                  style={{
                    width: "100%",
                    maxWidth: "42rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.4rem",
                    marginBottom: "0.6rem",
                    justifyContent: "center",
                  }}
                >
                  {streamSectionBadges.map((label) => (
                    <span
                      key={label}
                      className="wizard-fade-slide-in"
                      style={{
                        borderRadius: "999px",
                        border: "1px solid rgba(255,255,255,0.25)",
                        padding: "0.2rem 0.55rem",
                        fontSize: "0.68rem",
                        background: "rgba(255,255,255,0.12)",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
              {reasoningTraceLines.length > 0 ? (
                <div
                  style={{
                    width: "100%",
                    maxWidth: "42rem",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "0.75rem",
                    padding: "0.6rem 0.7rem",
                    marginBottom: "0.6rem",
                    background: "rgba(0,0,0,0.16)",
                    textAlign: "start",
                  }}
                >
                  <p className="wizard-loading-hint" style={{ marginBottom: "0.35rem", fontSize: "0.72rem", opacity: 0.95 }}>
                    خطوات الذكاء الاصطناعي (لايف)
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pe-1">
                    {reasoningTraceLines.map((item, idx) => (
                      <p
                        key={`${item.index}-${idx}`}
                        className={reduceMotion ? "wizard-loading-hint" : "wizard-loading-hint wizard-trace-line-enter"}
                        style={{ fontSize: "0.74rem", margin: 0 }}
                      >
                        <span style={{ opacity: 0.72 }}>
                          {(item.section && STREAM_SECTION_LABELS[item.section]) || item.section || "أصل / محتوى"}:
                        </span>{" "}
                        {item.line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              <h3>{WAITING_STAGES[tipIndex]!.title}</h3>
              <p className="wizard-loading-hint">{WAITING_STAGES[tipIndex]!.hint}</p>
              {partialSummary ? (
                <div
                  className="wizard-loading-hint wizard-loading-tip wizard-fade-slide-in"
                  style={{
                    marginTop: "0.8rem",
                    maxWidth: "34rem",
                    textAlign: "start",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "0.7rem",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <strong>ملخص لايف:</strong> {partialSummary}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

