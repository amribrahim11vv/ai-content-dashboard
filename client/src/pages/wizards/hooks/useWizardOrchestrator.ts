import { useCallback } from "react";
import type React from "react";
import type { BriefForm } from "../../../types";

type StepId = "diagnosis" | "brand" | "audience" | "channels" | "offer" | "creative" | "volume";

type Params = {
  step: number;
  maxStep: number;
  stepOrder: StepId[];
  stepFieldMap: Record<StepId, (keyof BriefForm)[]>;
  trigger: (name?: keyof BriefForm | (keyof BriefForm)[]) => Promise<boolean>;
  onStepAdvance: () => void;
  onStepValidationFailed: (stepId: StepId) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
};

export function useWizardOrchestrator(params: Params) {
  const next = useCallback(async () => {
    const current = params.stepOrder[params.step]!;
    const keys = params.stepFieldMap[current] ?? [];
    if (keys.length) {
      const ok = await params.trigger([...keys]);
      if (!ok) {
        params.onStepValidationFailed(current);
        return;
      }
    }
    params.onStepAdvance();
    params.setStep((s) => Math.min(params.maxStep, s + 1));
  }, [params]);

  return { next };
}
