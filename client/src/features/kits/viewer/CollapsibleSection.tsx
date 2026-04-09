import type { ReactNode } from "react";
import { SCROLL_MARGIN, TOC_ID } from "./shared";

export default function CollapsibleSection({
  id,
  title,
  subtitle,
  icon,
  iconBg,
  open,
  onToggle,
  children,
  tocLabel,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  iconBg: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  tocLabel: string;
}) {
  return (
    <section
      id={id}
      className={
        "scroll-mt-24 overflow-x-clip overflow-y-visible rounded-3xl border border-brand-sand/30 bg-earth-card/90 dark:border-outline/30 dark:bg-surface-container-low/40 " +
        (open ? "relative z-10" : "relative z-0")
      }
      style={{ scrollMarginTop: SCROLL_MARGIN }}
      aria-label={tocLabel}
    >
      <button
        type="button"
        className="flex w-full touch-manipulation items-center justify-between gap-3 px-5 py-4 text-start transition hover:bg-earth-alt/60 dark:hover:bg-surface-container-high/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        aria-expanded={open}
        aria-controls={id + "-panel"}
        id={id + "-heading"}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={"shrink-0 rounded-xl p-2 " + iconBg}>
            <span className="material-symbols-outlined">{icon}</span>
          </span>
          <div className="min-w-0">
            <h2 className="font-headline text-lg font-bold text-on-surface md:text-xl">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-on-surface-variant">{subtitle}</p> : null}
          </div>
        </div>
        <span
          className={
            "material-symbols-outlined shrink-0 text-on-surface-variant transition-transform duration-200 " +
            (open ? "rotate-180" : "")
          }
          aria-hidden
        >
          expand_more
        </span>
      </button>
      {open ? (
        <div
          id={id + "-panel"}
          className="min-w-0 max-w-full border-t border-brand-sand/25 px-5 pb-5 pt-2 dark:border-outline/20"
          role="region"
          aria-labelledby={id + "-heading"}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <a
              href={"#" + TOC_ID}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/45 rounded-lg px-1"
            >
              <span className="material-symbols-outlined text-base">vertical_align_top</span>
              Back to index
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
