import type { WizardEventPayload, WizardType } from "./wizardAnalytics";

const STORAGE_KEY = "ai-content-dashboard:wizard-analytics-buffer:v1";

export function readWizardAnalyticsBuffer(): WizardEventPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WizardEventPayload[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function clearWizardAnalyticsBuffer() {
  localStorage.removeItem(STORAGE_KEY);
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

type StepStat = {
  stepId: string;
  stepViews: number;
  nextClicks: number;
  validationFails: number;
  advanceRate: number;
};

export type WizardAnalyticsSummary = {
  totalEvents: number;
  started: number;
  diagnosisCompleted: number;
  generateClicks: number;
  success: number;
  failed: number;
  startToGenerateRate: number;
  generateSuccessRate: number;
  diagnosisToGenerateRate: number;
  avgTimeToFirstPerceivedValueMs: number;
  byWizardType: Record<WizardType, number>;
  byVariant: Record<"A" | "B" | "unknown", number>;
  byStep: StepStat[];
};

export function summarizeWizardEvents(events: WizardEventPayload[]): WizardAnalyticsSummary {
  const byWizardType: Record<WizardType, number> = {
    social: 0,
    offer: 0,
    deep: 0,
    unknown: 0,
  };
  const stepMap = new Map<string, { stepViews: number; nextClicks: number; validationFails: number }>();
  const byVariant: Record<"A" | "B" | "unknown", number> = { A: 0, B: 0, unknown: 0 };

  let started = 0;
  let diagnosisCompleted = 0;
  let generateClicks = 0;
  let success = 0;
  let failed = 0;
  let ttfpvSamples = 0;
  let ttfpvTotal = 0;

  for (const e of events) {
    byWizardType[e.wizard_type] += 1;
    const v = e.experiment_variant;
    if (v === "A" || v === "B") byVariant[v] += 1;
    else byVariant.unknown += 1;
    if (e.name === "wizard_started") started += 1;
    if (e.name === "wizard_generate_clicked") generateClicks += 1;
    if (e.name === "kit_created_success") success += 1;
    if (e.name === "kit_created_failed") failed += 1;
    if (e.name === "wizard_step_next_clicked" && e.step_id === "diagnosis") diagnosisCompleted += 1;
    if (e.name === "wizard_step_viewed" && e.step_id === "brand" && typeof e.elapsed_time_ms === "number") {
      ttfpvSamples += 1;
      ttfpvTotal += e.elapsed_time_ms;
    }

    const stepId = e.step_id || "unknown";
    if (!stepMap.has(stepId)) {
      stepMap.set(stepId, { stepViews: 0, nextClicks: 0, validationFails: 0 });
    }
    const stat = stepMap.get(stepId)!;
    if (e.name === "wizard_step_viewed") stat.stepViews += 1;
    if (e.name === "wizard_step_next_clicked") stat.nextClicks += 1;
    if (e.name === "wizard_step_validation_failed") stat.validationFails += 1;
  }

  const byStep: StepStat[] = Array.from(stepMap.entries()).map(([stepId, v]) => ({
    stepId,
    stepViews: v.stepViews,
    nextClicks: v.nextClicks,
    validationFails: v.validationFails,
    advanceRate: pct(v.nextClicks, v.stepViews),
  }));

  byStep.sort((a, b) => b.stepViews - a.stepViews);

  return {
    totalEvents: events.length,
    started,
    diagnosisCompleted,
    generateClicks,
    success,
    failed,
    startToGenerateRate: pct(generateClicks, started),
    generateSuccessRate: pct(success, generateClicks),
    diagnosisToGenerateRate: pct(generateClicks, diagnosisCompleted),
    avgTimeToFirstPerceivedValueMs: ttfpvSamples ? ttfpvTotal / ttfpvSamples : 0,
    byWizardType,
    byVariant,
    byStep,
  };
}

