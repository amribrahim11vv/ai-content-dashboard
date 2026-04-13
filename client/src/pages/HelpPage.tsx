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
    <>
      {err && (
        <p className="mx-auto mb-6 max-w-3xl rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {err}
        </p>
      )}

      <section className="mx-auto mb-12 max-w-5xl text-center md:mb-16">
        <h1 className="headline mb-5 text-3xl font-black tracking-tight text-on-surface sm:text-4xl md:mb-6 md:text-6xl">
          How can we{" "}
          <span className="text-primary">illuminate</span> your
          journey?
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-base text-on-surface-variant dark:text-secondary/80 md:mb-10 md:text-lg">
          Access the Social Geni knowledge base, technical documentation, and direct support lines to keep your vision
          in focus.
        </p>
        <div className="group relative mx-auto max-w-2xl">
          <div className="pointer-events-none absolute inset-y-0 start-5 flex items-center">
            <span className="material-symbols-outlined text-on-surface-variant transition-colors group-focus-within:text-tertiary">
              search
            </span>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="glow-focus w-full rounded-uniform border-none bg-surface-container-lowest py-4 ps-14 pe-6 text-sm text-on-surface placeholder:text-outline transition-all focus:ring-2 focus:ring-primary/35 md:py-5 md:text-base dark:bg-surface-container-high dark:text-secondary dark:placeholder:text-secondary/45"
            placeholder="Search guides and FAQ (API)…"
            aria-label="Filter help topics"
          />
        </div>
      </section>

      <section className="mx-auto mb-16 grid max-w-5xl grid-cols-1 gap-4 sm:gap-6 md:mb-20 md:grid-cols-3">
        {filteredResources.map((r) => (
          <div
            key={r.id}
            className="glass-panel group rounded-[1.5rem] border-none p-6 sm:p-8 transition-all hover:bg-surface-container-high dark:bg-surface-container-high/85 dark:hover:bg-surface-container-high"
          >
            <div
              className={
                "mb-6 flex h-12 w-12 items-center justify-center rounded-xl " +
                (r.accent === "tertiary" ? "bg-tertiary-container/20 text-tertiary" : "bg-primary-container/20 text-primary")
              }
            >
              <span className="material-symbols-outlined text-3xl">{r.icon}</span>
            </div>
            <h3 className="headline mb-3 text-xl font-bold">{r.title}</h3>
            <p className="mb-6 text-sm leading-relaxed text-on-surface-variant">{r.desc}</p>
            <span
              className={
                "inline-flex items-center gap-2 text-sm font-bold transition-all group-hover:gap-3 " +
                (r.accent === "tertiary" ? "text-tertiary" : "text-primary")
              }
            >
              {r.accent === "tertiary" ? "View Schema" : "Browse Guides"}{" "}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </span>
          </div>
        ))}

        <div className="glass-panel flex flex-col items-center justify-center rounded-[1.5rem] border-none bg-surface-container p-6 sm:p-8 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container/20 text-secondary">
            <span className="material-symbols-outlined text-4xl">support_agent</span>
          </div>
          <h3 className="headline mb-3 text-xl font-bold">Need Direct Help?</h3>
          <p className="mb-6 text-sm text-on-surface-variant dark:text-secondary/75">Our senior architects are available for high-tier support requests.</p>
          <button
            type="button"
            className="w-full rounded-xl bg-primary py-4 font-black tracking-tight text-on-primary transition-all hover:scale-[1.02] active:scale-95"
          >
            CONTACT SUPPORT
          </button>
        </div>
      </section>

      {noHits && (
        <p className="mx-auto mb-8 max-w-3xl text-center text-sm text-on-surface-variant" role="status">
          No topics match “{query.trim()}”. Try “api”, “export”, or “LLM”.
        </p>
      )}

      <section className="mx-auto mb-20 max-w-3xl md:mb-24">
        <div className="mb-6 flex flex-col gap-1 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="headline text-xl font-bold sm:text-2xl">Frequently Asked Questions</h2>
          <span className="text-xs text-on-surface-variant sm:text-sm">Last updated: {lastUpdatedLabel}</span>
        </div>
        <div className="space-y-4">
          {filteredFaq.map((item, i) => (
            <div key={i} className="overflow-hidden rounded-uniform bg-surface-container-low dark:bg-surface-container-high/85">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-4 text-start transition-colors hover:bg-surface-container sm:px-8 sm:py-6 dark:hover:bg-earth-darkBg/65"
              >
                <span className="font-bold text-on-surface">{item.q}</span>
                <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
              </button>
              <div className="border-t border-outline-variant/25 px-4 pb-5 pt-3 text-sm leading-relaxed text-on-surface-variant sm:px-8 sm:pb-6 sm:pt-4">
                {item.a}
              </div>
            </div>
          ))}
        </div>
        {hasQuery && filteredFaq.length === 0 && (
          <p className="mt-4 text-sm text-on-surface-variant" role="status">
            No FAQ entries match your filter.
          </p>
        )}
      </section>

      <section className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 overflow-hidden rounded-[2rem] bg-surface-container-highest p-6 sm:gap-10 sm:p-8 md:flex-row md:gap-12 md:rounded-[2.5rem] md:p-12 dark:bg-surface-container-high">
        <div className="absolute -end-32 -top-32 h-64 w-64 bg-tertiary/10 blur-[100px]" />
        <div className="absolute -bottom-32 -start-32 h-64 w-64 bg-primary/10 blur-[100px]" />
        <div className="relative z-10 flex-1">
          <h2 className="headline mb-4 text-2xl font-bold md:text-3xl">Still seeking answers?</h2>
          <p className="text-on-surface-variant dark:text-secondary/80">
            Join our Discord community where over 50,000 directors share techniques, workflows, and custom node configurations.
          </p>
        </div>
        <div className="relative z-10 flex w-full shrink-0 gap-4 md:w-auto">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low px-5 py-3 font-bold transition-all hover:bg-surface-container-high md:w-auto md:px-8 md:py-4 dark:border-muted/45 dark:bg-earth-darkBg/55 dark:hover:bg-earth-darkBg/75"
          >
            <span className="material-symbols-outlined">forum</span>
            Discord Community
          </button>
        </div>
      </section>
    </>
  );
}

