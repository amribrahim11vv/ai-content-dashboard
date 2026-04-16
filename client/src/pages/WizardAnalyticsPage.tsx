import { useMemo, useState } from "react";
import {
  clearWizardAnalyticsBuffer,
  readWizardAnalyticsBuffer,
  summarizeWizardEvents,
} from "../lib/wizardAnalyticsQuery";

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-5 shadow-sm transition-transform hover:-translate-y-0.5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function WizardAnalyticsPage() {
  const [tick, setTick] = useState(0);
  const events = useMemo(() => readWizardAnalyticsBuffer(), [tick]);
  const summary = useMemo(() => summarizeWizardEvents(events), [events]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 lg:space-y-8 px-2 sm:px-4">
      <header className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 lg:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 dark:opacity-[0.03] pointer-events-none">
          <span className="material-symbols-outlined text-[150px] -m-10">monitoring</span>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 mb-4">
               <span className="material-symbols-outlined text-[12px] text-indigo-600 dark:text-indigo-400">psychology</span>
               <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">KPI Dashboard v1</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Funnel Snapshot</h1>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed">
              Based on the local <code className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-gray-900 dark:text-white border border-gray-200 dark:border-white/5 mx-1">wizard:analytics</code> buffer. Use this to quickly detect drop-off and validate conversion rate improvements.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm transition hover:bg-gray-50 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/20"
              onClick={() => setTick((v) => v + 1)}
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Refresh Live
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-red-200/50 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-700 dark:text-red-400 shadow-sm transition hover:bg-red-100 dark:hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-500/20"
              onClick={() => {
                clearWizardAnalyticsBuffer();
                setTick((v) => v + 1);
              }}
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              Clear Buffer
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Total Events" value={String(summary.totalEvents)} />
        <Card label="Wizard Starts" value={String(summary.started)} />
        <Card label="Diagnosis Completed" value={String(summary.diagnosisCompleted)} />
        <Card label="Generate Clicks" value={String(summary.generateClicks)} />
        <Card label="Successful Kits" value={String(summary.success)} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card label="Start → Generate Rate" value={`${summary.startToGenerateRate.toFixed(1)}%`} />
          <Card label="Generate Success Rate" value={`${summary.generateSuccessRate.toFixed(1)}%`} />
          <Card label="Diagnosis → Generate Rate" value={`${summary.diagnosisToGenerateRate.toFixed(1)}%`} />
          <Card label="Avg TTFPV" value={`${Math.round(summary.avgTimeToFirstPerceivedValueMs)}ms`} />
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 sm:p-8 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">Events by Path</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card label="Social" value={String(summary.byWizardType.social)} />
              <Card label="Offer" value={String(summary.byWizardType.offer)} />
              <Card label="Deep" value={String(summary.byWizardType.deep)} />
              <Card label="Unknown" value={String(summary.byWizardType.unknown)} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 sm:p-8 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">A/B Split Reach</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card label="Variant A" value={String(summary.byVariant.A)} />
              <Card label="Variant B" value={String(summary.byVariant.B)} />
              <Card label="Unknown" value={String(summary.byVariant.unknown)} />
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 sm:p-8 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">Step Funnel Performance</h2>
        {summary.byStep.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
             <span className="material-symbols-outlined text-[48px] text-gray-300 dark:text-white/10 mb-4">route</span>
             <p className="text-sm font-medium text-gray-900 dark:text-white">No Step Data Found</p>
             <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Run the wizard flow to populate metrics.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-start">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161616]">
                    <th className="px-6 py-4 text-start text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Step</th>
                    <th className="px-6 py-4 text-start text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Views</th>
                    <th className="px-6 py-4 text-start text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Next Clicks</th>
                    <th className="px-6 py-4 text-start text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Validation Fails</th>
                    <th className="px-6 py-4 text-start text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Advance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {summary.byStep.map((s) => (
                    <tr key={s.stepId} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{s.stepId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{s.stepViews}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{s.nextClicks}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        <span className={s.validationFails > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 opacity-50"}>
                          {s.validationFails}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <span className="w-10">{s.advanceRate.toFixed(1)}%</span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10 hidden sm:block">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${s.advanceRate}%` }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
