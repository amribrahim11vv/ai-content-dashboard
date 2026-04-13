type SelectableCardProps = {
  label: string;
  icon?: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export default function SelectableCard({ label, icon, selected, onClick, disabled }: SelectableCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "group w-full rounded-uniform border px-4 py-3 text-start transition",
        "focus-visible:ring-2 focus-visible:ring-primary/45",
        selected
          ? "border-primary bg-primary/10 text-on-surface shadow-[0_0_0_1px_rgb(var(--c-primary)/0.35)] dark:border-primary dark:bg-primary/15"
          : "border-brand-sand/30 bg-earth-card text-on-surface hover:border-brand-primary/35 hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:border-primary/35 dark:hover:bg-surface-container-highest",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        {icon ? <span className="text-base leading-none">{icon}</span> : null}
        <span className="text-sm font-semibold">{label}</span>
        <span className={["ms-auto text-sm font-bold", selected ? "opacity-100 text-primary" : "opacity-0"].join(" ")}>✓</span>
      </span>
    </button>
  );
}
