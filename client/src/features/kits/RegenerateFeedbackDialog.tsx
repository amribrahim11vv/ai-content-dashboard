import type { RefObject } from "react";

export default function RegenerateFeedbackDialog(props: {
  open: boolean;
  pendingType?: "post" | "image" | "video";
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  disabled?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  if (!props.open || !props.pendingType) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-uniform border border-outline/30 bg-surface p-5 shadow-xl dark:bg-surface-container-low">
        <h3 className="font-headline text-lg font-bold text-on-surface">Regenerate item</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Add optional feedback to guide the rewrite for this {props.pendingType} item.
        </p>
        <textarea
          ref={props.textareaRef}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder="e.g., make the hook stronger, shorter CTA, keep tone premium..."
          className="mt-3 min-h-[120px] w-full rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            disabled={Boolean(props.disabled)}
            className="rounded-lg border border-outline/30 px-4 py-2 text-sm font-semibold text-on-surface-variant disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onSubmit}
            disabled={Boolean(props.disabled)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {props.disabled ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}
