import { useState } from "react";
import { ApiError } from "../../../api";
import { generateKitStream, type KitGenerationStreamEvent } from "../../../api";
import type { WizardEventPayload, WizardType } from "../../../lib/wizardAnalytics";
import type { BriefForm } from "../../../types";

const STREAM_STATUS_PROGRESS_FLOOR: Record<string, number> = {
  starting: 0.08,
  generating: 0.35,
  hydrating: 0.72,
  persisting: 0.9,
  completed: 1,
};
const REASONING_TRACE_MAX_ITEMS = 24;

export function useWizardSubmission(params: {
  draftKey: string;
  wizardType: WizardType;
  step: number;
  stepOrder: string[];
  createIdempotencyKey: () => string;
  clearDraft: () => void;
  navigateToKit: (kitId: string) => void;
  clampCounts: (form: BriefForm) => BriefForm;
  emit: (event: Omit<WizardEventPayload, "ts">) => void;
  getElapsedMs: () => number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string>("starting");
  const [streamMessage, setStreamMessage] = useState<string>("");
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamSnapshot, setStreamSnapshot] = useState<Record<string, unknown> | null>(null);
  const [streamSection, setStreamSection] = useState<string>("");
  const [streamCompletedSections, setStreamCompletedSections] = useState<string[]>([]);
  const [reasoningTrace, setReasoningTrace] = useState<Array<{ index: number; section?: string; line: string }>>([]);

  const onValidSubmit = async (form: BriefForm) => {
    setError(null);
    setLoading(true);
    setStreamStatus("starting");
    setStreamMessage("");
    setStreamProgress(0);
    setStreamSnapshot(null);
    setStreamSection("");
    setStreamCompletedSections([]);
    setReasoningTrace([]);
    params.emit({
      name: "wizard_generate_clicked",
      wizard_type: params.wizardType,
      draft_key: params.draftKey,
      step_index: params.step,
      step_id: params.stepOrder[params.step],
      elapsed_time_ms: params.getElapsedMs(),
    });
    try {
      const payload = params.clampCounts(form);
      const kit = await generateKitStream(payload, params.createIdempotencyKey(), (evt: KitGenerationStreamEvent) => {
        if (evt.type === "status") {
          setStreamStatus(evt.status);
          if (evt.message) setStreamMessage(evt.message);
          const floor = STREAM_STATUS_PROGRESS_FLOOR[evt.status] ?? 0;
          setStreamProgress((prev) => Math.max(prev, floor));
          return;
        }
        if (evt.type === "partial") {
          setStreamProgress((prev) => Math.max(prev, Math.max(0, Math.min(1, evt.progress))));
          setStreamSnapshot(evt.snapshot);
          if (evt.section) {
            setStreamSection(evt.section);
            setStreamCompletedSections((prev) => (prev.includes(evt.section as string) ? prev : [...prev, evt.section as string]));
          }
          return;
        }
        if (evt.type === "error") {
          setError(evt.message);
          return;
        }
        if (evt.type === "reasoning") {
          setReasoningTrace((prev) => {
            const next = [...prev, { index: evt.index, section: evt.section, line: evt.line }];
            if (next.length <= REASONING_TRACE_MAX_ITEMS) return next;
            return next.slice(next.length - REASONING_TRACE_MAX_ITEMS);
          });
        }
      });
      params.clearDraft();
      params.emit({
        name: "kit_created_success",
        wizard_type: params.wizardType,
        draft_key: params.draftKey,
        kit_id: kit.id,
        elapsed_time_ms: params.getElapsedMs(),
      });
      params.navigateToKit(kit.id);
    } catch (e) {
      const safeMessage = e instanceof ApiError ? e.message : "Failed to generate kit. Please try again.";
      setError(safeMessage);
      params.emit({
        name: "kit_created_failed",
        wizard_type: params.wizardType,
        draft_key: params.draftKey,
        error: safeMessage,
        elapsed_time_ms: params.getElapsedMs(),
      });
    } finally {
      setLoading(false);
      setStreamSection("");
    }
  };

  return {
    loading,
    error,
    setError,
    onValidSubmit,
    streamStatus,
    streamMessage,
    streamProgress,
    streamSnapshot,
    streamSection,
    streamCompletedSections,
    reasoningTrace,
  };
}
