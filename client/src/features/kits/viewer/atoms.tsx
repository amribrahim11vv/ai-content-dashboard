import { useCallback, useState, type MouseEvent, type ReactNode } from "react";

export function CopyFieldButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      // Best effort only.
    }
  }, [text]);

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void copy();
      }}
      className="relative z-10 inline-flex shrink-0 touch-manipulation items-center gap-1 rounded-lg border border-brand-sand/30 bg-earth-card px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface transition hover:bg-earth-alt dark:border-outline/25 dark:bg-surface-container-high dark:hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40"
      title={label}
      aria-label={label}
    >
      <span className="material-symbols-outlined text-sm">{done ? "check" : "content_copy"}</span>
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function RegenerateButton({
  onClick,
  loading,
}: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      disabled={loading}
      className="relative z-10 inline-flex shrink-0 touch-manipulation items-center gap-1 rounded-lg border border-brand-sand/30 bg-earth-card px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary transition hover:bg-earth-alt dark:border-outline/25 dark:bg-surface-container-high dark:text-on-surface dark:hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-55"
      title="Regenerate this item"
      aria-label="Regenerate this item"
    >
      <span className={"material-symbols-outlined text-sm " + (loading ? "animate-spin" : "")}>
        {loading ? "autorenew" : "refresh"}
      </span>
      {loading ? "Regenerating..." : "Regenerate"}
    </button>
  );
}

export function BlockWithCopy({
  children,
  copyText,
  copyLabel,
  className = "",
}: {
  children: ReactNode;
  copyText: string;
  copyLabel: string;
  className?: string;
}) {
  return (
    <div className={className ? `min-w-0 max-w-full overflow-x-clip ${className}` : "min-w-0 max-w-full overflow-x-clip"}>
      <div className="mb-2 flex justify-end">
        <CopyFieldButton text={copyText} label={copyLabel} />
      </div>
      <div className="min-w-0 max-w-full" onPointerDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function FieldBlock({
  label,
  copyText,
  copyLabel,
  children,
  bodyClassName = "p-3",
}: {
  label: string;
  copyText: string;
  copyLabel: string;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-brand-sand/25 bg-earth-card/90 shadow-sm shadow-surface/20 dark:border-outline/20 dark:bg-surface-container-lowest/75">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-brand-sand/20 bg-earth-alt/50 px-3 py-2.5 dark:border-outline/15 dark:bg-surface-container-high/20">
        <span className="min-w-0 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
        <CopyFieldButton text={copyText} label={copyLabel} />
      </div>
      <div className={`min-w-0 max-w-full ${bodyClassName}`} dir="auto">
        {children}
      </div>
    </div>
  );
}
