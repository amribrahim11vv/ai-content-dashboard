type StepId = "brand" | "audience" | "channels" | "offer" | "creative" | "volume";

function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

export default function WizardStepChips(props: {
  stepOrder: StepId[];
  currentStep: number;
  stepTitles: Record<StepId, string>;
}) {
  return (
    <div className="mb-6 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:mb-8 sm:flex-wrap sm:overflow-visible">
      {props.stepOrder.map((id, i) => (
        <span
          key={id}
          className={cn(
            "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            i === props.currentStep
              ? "border-primary/30 bg-primary/20 text-primary dark:border-primary/45 dark:bg-primary/15 dark:text-secondary"
              : "border-transparent bg-surface-container-lowest text-on-surface-variant dark:bg-earth-darkBg/55 dark:text-secondary/70"
          )}
        >
          {i + 1}. {props.stepTitles[id]}
        </span>
      ))}
    </div>
  );
}
