export default function WizardValuePreview(props: {
  wizardType: string;
  brandName: string;
  industry: string;
  direction: string;
}) {
  return (
    <div className="mb-5 rounded-xl border border-secondary/30 bg-secondary/10 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-secondary">Early value preview</p>
      <h3 className="mt-1 text-sm font-semibold text-on-surface">
        You are building a {props.wizardType} kit for {props.brandName}
      </h3>
      <p className="mt-1 text-xs text-on-surface-variant">
        Industry: {props.industry}. Primary direction: {props.direction.slice(0, 120)}.
      </p>
    </div>
  );
}
