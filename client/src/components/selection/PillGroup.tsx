import type { SelectionOption } from "../../pages/wizards/selectionOptions";

type PillGroupProps = {
  options: readonly SelectionOption[];
  selectedValues: readonly string[];
  onToggle: (value: string) => void;
};

export default function PillGroup({ options, selectedValues, onToggle }: PillGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={active}
            className={[
              "inline-flex min-h-[2.25rem] items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              "focus-visible:ring-2 focus-visible:ring-primary/45",
              active
                ? "border-primary bg-primary/10 text-primary dark:border-primary dark:bg-primary/15 dark:text-secondary"
                : "border-brand-sand/30 bg-earth-card text-on-surface hover:border-brand-primary/35 hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:border-primary/35 dark:hover:bg-surface-container-highest",
            ].join(" ")}
          >
            {option.icon ? <span>{option.icon}</span> : null}
            <span>{option.labelAr}</span>
          </button>
        );
      })}
    </div>
  );
}
