import { useMemo, useState } from "react";
import {
  clearWizardAnalyticsBuffer,
  readWizardAnalyticsBuffer,
  summarizeWizardEvents,
} from "../lib/wizardAnalyticsQuery";

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline/30 bg-surface-container-low p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-on-surface">{value}</p>
    </div>
  );
}

export default function WizardAnalyticsPage() {
  const [tick, setTick] = useState(0);
  const events = useMemo(() => readWizardAnalyticsBuffer(), [tick]);
  const summary = useMemo(() => summarizeWizardEvents(events), [events]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-2 sm:px-4">
      <header className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Wizard KPI Dashboard v1</p>
        <h1 className="mt-1 text-2xl font-extrabold text-on-surface">Funnel snapshot (local buffer)</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Source: <code>wizard:analytics</code> local buffer. Use this to detect drop-off and validate conversion changes quickly.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-sm font-semibold text-on-surface"
            onClick={() => setTick((v) => v + 1)}
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm font-semibold text-error"
            onClick={() => {
              clearWizardAnalyticsBuffer();
              setTick((v) => v + 1);
            }}
          >
            Clear buffer
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Total events" value={String(summary.totalEvents)} />
        <Card label="Wizard starts" value={String(summary.started)} />
        <Card label="Diagnosis completed" value={String(summary.diagnosisCompleted)} />
        <Card label="Generate clicks" value={String(summary.generateClicks)} />
        <Card label="Successful kits" value={String(summary.success)} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card label="Start → Generate rate" value={`${summary.startToGenerateRate.toFixed(1)}%`} />
        <Card label="Generate success rate" value={`${summary.generateSuccessRate.toFixed(1)}%`} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card label="Diagnosis → Generate rate" value={`${summary.diagnosisToGenerateRate.toFixed(1)}%`} />
        <Card label="Avg TTFPV" value={`${Math.round(summary.avgTimeToFirstPerceivedValueMs)} ms`} />
      </section>

      <section className="rounded-2xl border border-outline/30 bg-surface-container-low p-4">
        <h2 className="text-lg font-bold text-on-surface">Events by wizard type</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label="social" value={String(summary.byWizardType.social)} />
          <Card label="offer" value={String(summary.byWizardType.offer)} />
          <Card label="deep" value={String(summary.byWizardType.deep)} />
          <Card label="unknown" value={String(summary.byWizardType.unknown)} />
        </div>
      </section>

      <section className="rounded-2xl border border-outline/30 bg-surface-container-low p-4">
        <h2 className="text-lg font-bold text-on-surface">A/B split visibility</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card label="Variant A events" value={String(summary.byVariant.A)} />
          <Card label="Variant B events" value={String(summary.byVariant.B)} />
          <Card label="Unknown variant events" value={String(summary.byVariant.unknown)} />
        </div>
      </section>

      <section className="rounded-2xl border border-outline/30 bg-surface-container-low p-4">
        <h2 className="text-lg font-bold text-on-surface">Step performance</h2>
        {summary.byStep.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">No step data yet. Run the wizard flow first.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant">
                  <th className="px-2 py-2">Step</th>
                  <th className="px-2 py-2">Views</th>
                  <th className="px-2 py-2">Next</th>
                  <th className="px-2 py-2">Validation fails</th>
                  <th className="px-2 py-2">Advance rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.byStep.map((s) => (
                  <tr key={s.stepId} className="border-t border-outline/20">
                    <td className="px-2 py-2 font-semibold text-on-surface">{s.stepId}</td>
                    <td className="px-2 py-2 text-on-surface">{s.stepViews}</td>
                    <td className="px-2 py-2 text-on-surface">{s.nextClicks}</td>
                    <td className="px-2 py-2 text-on-surface">{s.validationFails}</td>
                    <td className="px-2 py-2 text-on-surface">{s.advanceRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

