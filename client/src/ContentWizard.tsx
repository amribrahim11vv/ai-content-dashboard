import { useNavigate } from "react-router-dom";

function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

export default function ContentWizard() {
  const nav = useNavigate();

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 pb-16">
      <div className="pointer-events-none fixed -bottom-32 -start-32 -z-10 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />
      <div className="pointer-events-none fixed -end-40 top-20 -z-10 h-[500px] w-[500px] rounded-full bg-secondary/5 blur-[120px]" />

      <section className="mt-4 w-full md:mt-8">
        <div className="mb-10 max-w-3xl text-center md:text-start">
          <h2 className="mb-3 font-headline text-4xl font-black leading-tight tracking-tight text-on-surface md:text-5xl">
            Choose your{" "}
            <span className="bg-gradient-to-r from-primary via-tertiary to-secondary bg-clip-text text-transparent">content path</span>
          </h2>
          <p className="text-lg font-light leading-relaxed text-on-surface-variant md:text-xl">
            Select the best flow for your goals and audience.
          </p>
        </div>

        <div className="mb-10 flex flex-col items-center justify-between gap-6 rounded-[2rem] border border-primary/20 bg-primary/5 p-6 md:flex-row md:p-8">
          <div className="text-center md:text-start">
            <h3 className="text-xl font-extrabold text-on-surface sm:text-2xl">Quick Start</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Recommended for most creators. Generates social-first content.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => nav("/wizard/social")}
              className="rounded-xl bg-gradient-to-r from-primary to-primary-container px-6 py-3.5 text-sm font-bold text-on-primary-container transition hover:scale-[1.02] hover:opacity-95"
            >
              Start Social Path
            </button>
            <button
              type="button"
              onClick={() => nav("/wizard/offer")}
              className="rounded-xl border border-outline/30 bg-surface-container-high px-6 py-3.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container-highest"
            >
              Offer Path Instead
            </button>
          </div>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              icon: "hub",
              title: "Social campaign",
              desc: "Social-first flow for audience growth, platform mix, and post output planning.",
              accent: "primary" as const,
              path: "/wizard/social",
              cta: "Start social wizard",
            },
            {
              icon: "shopping_bag",
              title: "Offer & product",
              desc: "Conversion-focused flow for offer positioning, CTA strength, and sales messaging.",
              accent: "tertiary" as const,
              path: "/wizard/offer",
              cta: "Start offer wizard",
            },
            {
              icon: "article",
              title: "Deep content",
              desc: "Depth-focused flow for richer editorial/video directions and structured narrative output.",
              accent: "secondary" as const,
              path: "/wizard/deep",
              cta: "Start deep wizard",
            },
          ].map((c) => (
            <div
              key={c.title}
              className={cn(
                "group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-outline-variant/25 bg-surface-container-low p-8 transition duration-500 glow-hover hover:-translate-y-2",
                c.accent === "primary" && "hover:border-primary/20",
                c.accent === "tertiary" && "hover:border-tertiary/20",
                c.accent === "secondary" && "hover:border-secondary/20"
              )}
            >
              <div
                className={cn(
                  "absolute -end-24 -top-24 h-48 w-48 blur-[80px] transition-all",
                  c.accent === "primary" && "bg-primary/10 group-hover:bg-primary/20",
                  c.accent === "tertiary" && "bg-tertiary/10 group-hover:bg-tertiary/20",
                  c.accent === "secondary" && "bg-secondary/10 group-hover:bg-secondary/20"
                )}
              />
              <div
                className={cn(
                  "mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-highest transition duration-500 group-hover:scale-110",
                  c.accent === "primary" && "bg-primary/15 text-primary group-hover:bg-primary/20",
                  c.accent === "tertiary" &&
                    "bg-brand-sand/70 text-brand-accent group-hover:bg-brand-sand dark:bg-brand-sand/75 dark:text-brand-accent",
                  c.accent === "secondary" && "bg-secondary/15 text-secondary group-hover:bg-secondary/20"
                )}
              >
                <span className="material-symbols-outlined text-4xl">{c.icon}</span>
              </div>
              <h3 className="mb-3 font-headline text-2xl font-extrabold tracking-tight text-on-surface">{c.title}</h3>
              <p className="mb-10 flex-grow text-sm leading-relaxed text-on-surface-variant">{c.desc}</p>
              <button
                type="button"
                onClick={() => nav(c.path)}
                className={cn(
                  "group/btn flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold transition duration-300",
                  "focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  c.accent === "primary" &&
                    "bg-surface-container-highest text-on-surface hover:bg-gradient-to-r hover:from-primary hover:to-primary-container hover:text-on-primary",
                  c.accent === "tertiary" &&
                    "bg-surface-container-highest text-on-surface hover:bg-gradient-to-r hover:from-tertiary hover:to-tertiary-container hover:text-on-tertiary",
                  c.accent === "secondary" &&
                    "bg-surface-container-highest text-on-surface hover:bg-gradient-to-r hover:from-secondary hover:to-secondary-container hover:text-on-secondary"
                )}
              >
                {c.cta}
                <span className="material-symbols-outlined text-sm transition-transform group-hover/btn:translate-x-1">
                  arrow_forward
                </span>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

