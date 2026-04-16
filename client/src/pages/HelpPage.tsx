import { useEffect, useMemo, useState } from "react";
import { getHelpTopics, type HelpTopicsResponse } from "../api";

const empty: HelpTopicsResponse = { resources: [], faq: [], last_updated: "" };

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [data, setData] = useState<HelpTopicsResponse>(empty);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    getHelpTopics(debounced)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setErr(null);
        }
      })
      .catch(() => {
        if (!cancelled) setErr("Could not load help topics from the API.");
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const filteredResources = data.resources;
  const filteredFaq = data.faq;
  const hasQuery = query.trim().length > 0;
  const noHits = hasQuery && filteredResources.length === 0 && filteredFaq.length === 0;

  const lastUpdatedLabel = useMemo(() => {
    if (!data.last_updated) return "—";
    try {
      return new Date(data.last_updated).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return data.last_updated;
    }
  }, [data.last_updated]);

  return (
    <div className="max-w-5xl mx-auto w-full">
      {err && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200/50 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400 shadow-sm animate-in fade-in slide-in-from-top-2" role="alert">
           <span className="material-symbols-outlined text-[18px]">error</span>
           {err}
        </div>
      )}

      <section className="mb-12 text-center md:mb-16">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:mb-4 lg:text-6xl">
          How can we help?
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-base text-gray-600 dark:text-gray-400 md:mb-10 lg:text-lg">
          Access the Social Geni knowledge base, technical documentation, and direct support lines.
        </p>
        <div className="group relative mx-auto max-w-2xl">
          <div className="pointer-events-none absolute inset-y-0 start-5 flex items-center">
            <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 transition-colors group-focus-within:text-gray-900 dark:group-focus-within:text-white">
              search
            </span>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] py-4 ps-14 pe-6 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm transition-all focus:outline-none focus:border-gray-900 dark:focus:border-white/30 md:py-5 md:text-base"
            placeholder="Search guides and FAQ..."
            aria-label="Filter help topics"
          />
        </div>
      </section>

      <section className="mb-16 grid grid-cols-1 gap-6 md:mb-20 md:grid-cols-3">
        {filteredResources.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 sm:p-8 shadow-sm transition-transform hover:-translate-y-1 group"
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 text-gray-900 dark:text-white">
              <span className="material-symbols-outlined text-[24px]">{r.icon}</span>
            </div>
            <h3 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">{r.title}</h3>
            <p className="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{r.desc}</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white transition-all group-hover:gap-2">
              Explore Guide
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </span>
          </div>
        ))}

        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0c0c0e] p-6 sm:p-8 text-center shadow-sm">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-[28px]">support_agent</span>
          </div>
          <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Need Direct Help?</h3>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Our senior architects are available for high-tier support requests.</p>
          <button
            type="button"
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-2 dark:focus:ring-offset-[#111]"
          >
            Contact Support
          </button>
        </div>
      </section>

      {noHits && (
        <div className="mb-12 flex flex-col items-center justify-center py-8 text-center border border-gray-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111] shadow-sm">
           <span className="material-symbols-outlined text-[48px] text-gray-300 dark:text-white/10 mb-4">search_off</span>
           <p className="text-sm font-medium text-gray-900 dark:text-white">No hits found</p>
           <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No topics match “{query.trim()}”. Try simpler keywords.</p>
        </div>
      )}

      <section className="mx-auto mb-20 max-w-3xl md:mb-24">
        <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between px-2">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Frequently Asked Questions</h2>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-500">Updated: {lastUpdatedLabel}</span>
        </div>
        <div className="space-y-4">
          {filteredFaq.map((item, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-sm">
              <div className="flex w-full items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#161616]">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.q}</span>
              </div>
              <div className="px-5 py-4 sm:px-6 sm:py-5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {item.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative flex flex-col items-center gap-8 overflow-hidden rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white dark:bg-black p-8 sm:gap-10 sm:p-10 md:flex-row md:gap-12 md:p-12 shadow-sm">
        <div className="absolute top-0 right-0 p-10 opacity-5 dark:opacity-20 pointer-events-none">
           <span className="material-symbols-outlined text-[150px] -m-10">forum</span>
        </div>
        <div className="relative z-10 flex-1">
          <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">Still seeking answers?</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed">
            Join our Discord community where over 50,000 directors share techniques, workflows, and custom node configurations.
          </p>
        </div>
        <div className="relative z-10 flex w-full shrink-0 gap-4 md:w-auto">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-6 py-3.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm transition-all hover:bg-white dark:hover:bg-white/10 active:scale-[0.98] md:w-auto focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/20"
          >
            <span className="material-symbols-outlined text-[20px]">forum</span>
            Discord Community
          </button>
        </div>
      </section>
    </div>
  );
}
