import { useEffect, useRef } from "react";
import { emitWizardEvent, type WizardType } from "../../../lib/wizardAnalytics";

type StepId = "diagnosis" | "brand" | "audience" | "channels" | "offer" | "creative" | "volume";

export function useWizardTelemetry(params: {
  wizardType: WizardType;
  draftKey: string;
  step: number;
  stepOrder: StepId[];
  maxStep: number;
  restoredDraft: boolean;
}) {
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    emitWizardEvent({
      name: "wizard_started",
      wizard_type: params.wizardType,
      draft_key: params.draftKey,
      restored_draft: params.restoredDraft,
      elapsed_time_ms: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = params.stepOrder[params.step];
    emitWizardEvent({
      name: "wizard_step_viewed",
      wizard_type: params.wizardType,
      draft_key: params.draftKey,
      step_index: params.step,
      step_id: current,
      total_steps: params.maxStep + 1,
      elapsed_time_ms: Date.now() - startedAtRef.current,
    });
  }, [params.step, params.draftKey, params.stepOrder, params.maxStep, params.wizardType]);

  return {
    getElapsedMs: () => Date.now() - startedAtRef.current,
    emit: emitWizardEvent,
  };
}
