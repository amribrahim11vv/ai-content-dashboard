import { useEffect, useMemo, useRef, useState } from "react";
import { isWizardDirty, parseWizardDraft } from "../../../wizardDraft";
import type { BriefForm } from "../../../types";

export function useWizardDraft(params: {
  draftKey: string;
  mergedDefaults: BriefForm;
  maxStep: number;
  limits: Record<string, { min: number; max: number }>;
  watch: (cb: () => void) => { unsubscribe: () => void };
  getValues: () => BriefForm;
}) {
  const initialState = useMemo(() => {
    try {
      const raw = localStorage.getItem(params.draftKey);
      if (!raw) return { step: 0, form: params.mergedDefaults, hadDraft: false };
      const parsed = parseWizardDraft(raw, params.limits as any, params.maxStep);
      if (!parsed) return { step: 0, form: params.mergedDefaults, hadDraft: false };
      return { step: parsed.step, form: { ...params.mergedDefaults, ...parsed.form }, hadDraft: true };
    } catch {
      return { step: 0, form: params.mergedDefaults, hadDraft: false };
    }
  }, [params.mergedDefaults, params.draftKey, params.maxStep, params.limits]);

  const [step, setStep] = useState(initialState.step);
  const [showDraftBanner, setShowDraftBanner] = useState(initialState.hadDraft);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const sub = params.watch(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        try {
          const form = params.getValues();
          if (!isWizardDirty(form, step, params.limits as any)) {
            localStorage.removeItem(params.draftKey);
            return;
          }
          localStorage.setItem(params.draftKey, JSON.stringify({ step, form }));
        } catch {
          // ignore
        }
      }, 400);
    });
    return () => {
      sub.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [params, step]);

  const clearStoredDraft = () => {
    localStorage.removeItem(params.draftKey);
    setShowDraftBanner(false);
    setStep(0);
  };

  return { initialState, step, setStep, showDraftBanner, setShowDraftBanner, clearStoredDraft };
}
