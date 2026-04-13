import { useCallback, useRef, useState } from "react";
import { ApiError, regenerateKitItem } from "../../api";
import type { KitSummary } from "../../types";

type ItemType = "post" | "image" | "video";

export function useKitRegenerate(params: {
  kit: KitSummary;
  onKitUpdate?: (next: KitSummary) => void;
}) {
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [pendingRegenerate, setPendingRegenerate] = useState<{ item_type: ItemType; index: number } | null>(null);
  const feedbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const openRegenerateDialog = useCallback((item_type: ItemType, index: number) => {
    if (regeneratingKey) return;
    setPendingRegenerate({ item_type, index });
    setFeedbackDraft("");
    setFeedbackOpen(true);
    setRegenError(null);
  }, [regeneratingKey]);

  const closeFeedbackModal = useCallback(() => {
    if (regeneratingKey) return;
    setFeedbackOpen(false);
    setPendingRegenerate(null);
    setFeedbackDraft("");
  }, [regeneratingKey]);

  const submitRegenerate = useCallback(async () => {
    if (!pendingRegenerate) return;
    const key = `${pendingRegenerate.item_type}-${pendingRegenerate.index}`;
    setRegeneratingKey(key);
    setRegenError(null);
    try {
      const next = await regenerateKitItem(params.kit.id, pendingRegenerate.item_type, pendingRegenerate.index, params.kit.row_version, feedbackDraft.trim());
      params.onKitUpdate?.(next);
      setFeedbackOpen(false);
      setPendingRegenerate(null);
      setFeedbackDraft("");
    } catch (e) {
      if (e instanceof ApiError) setRegenError(e.message);
      else setRegenError("Failed to regenerate this item.");
    } finally {
      setRegeneratingKey(null);
    }
  }, [pendingRegenerate, params, feedbackDraft]);

  return {
    regeneratingKey,
    regenError,
    feedbackOpen,
    feedbackDraft,
    setFeedbackDraft,
    pendingRegenerate,
    feedbackTextareaRef,
    openRegenerateDialog,
    closeFeedbackModal,
    submitRegenerate,
  };
}
