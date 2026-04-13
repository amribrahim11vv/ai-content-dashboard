import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { isWizardVariantB } from "./lib/wizardExperiment";

function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

export default function ContentWizard() {
  const nav = useNavigate();
  const [selectedPath, setSelectedPath] = useState<string>("/wizard/social");
  const variantB = isWizardVariantB();

  const cards = useMemo(
    () => [
      {
        icon: "hub",
        title: "Social Campaign",
        desc: "Social-first flow for audience growth, platform mix, and post output planning.",
        accent: "primary" as const,
        path: "/wizard/social",
      },
      {
        icon: "shopping_bag",
        title: "Offer Campaign",
        desc: "Conversion-focused flow for offer positioning, CTA strength, and sales messaging.",
        accent: "tertiary" as const,
        path: "/wizard/offer",
      },
      {
        icon: "article",
        title: "Deep Campaign",
        desc: "Depth-focused flow for richer editorial/video directions and structured narrative output.",
        accent: "secondary" as const,
        path: "/wizard/deep",
      },
    ],
    []
  );

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 pb-16">
      <div className="pointer-events-none fixed -bottom-32 -start-32 -z-10 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />
      <div className="pointer-events-none fixed -end-40 top-20 -z-10 h-[500px] w-[500px] rounded-full bg-secondary/5 blur-[120px]" />

      <section className="mt-4 w-full md:mt-8">
        <div className="mb-10 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-tertiary/20 bg-tertiary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-tertiary">
            <span className="material-symbols-outlined text-sm">bolt</span>
            Content routing
          </div>
          <h2 className="mb-4 font-headline text-4xl font-black leading-tight tracking-tight text-on-surface md:text-5xl">
            اختر مسار{" "}
            <span className="bg-gradient-to-r from-primary via-tertiary to-secondary bg-clip-text text-transparent">content path</span>
          </h2>
          <p className="text-lg font-light leading-relaxed text-on-surface-variant md:text-xl">
            كل مسار بيدخلك Wizard مختلف بترتيب أسئلة يناسب هدفك.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/10 p-4 md:p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Quick start</p>
          <h3 className="mt-1 text-xl font-extrabold text-on-surface md:text-2xl">ابدأ بسرعة ومن غير زحمة</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            اختار كارت واحد فقط، وبعدها اضغط زرار واحد للبدء.
          </p>
          {variantB ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary-container transition hover:opacity-95"
                onClick={() => nav("/wizard/social")}
              >
                Start now (recommended)
              </button>
              <button
                type="button"
                className="rounded-xl border border-outline/30 bg-surface-container-high px-4 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-highest"
                onClick={() => nav("/wizard/offer")}
              >
                I need offer-focused flow
              </button>
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">touch_app</span>
            {variantB ? (
              <>
                Use quick actions above, or pick any card below then press{" "}
                <span className="font-bold text-on-surface">Start now</span>.
              </>
            ) : (
              <>
                Pick a card below, then press <span className="font-bold text-on-surface">Start now</span>.
              </>
            )}
          </div>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              onClick={() => setSelectedPath(c.path)}
              className={cn(
                "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-outline-variant/25 bg-surface-container-low p-8 transition duration-500 glow-hover hover:-translate-y-2",
                c.accent === "primary" && "hover:border-primary/20",
                c.accent === "tertiary" && "hover:border-tertiary/20",
                c.accent === "secondary" && "hover:border-secondary/20",
                selectedPath === c.path && "ring-2 ring-primary/50"
              )}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPath(c.path);
                }
              }}
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
              <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {selectedPath === c.path ? "Selected" : "Click to select"}
              </div>
            </div>
          ))}
        </div>
        <div className="mb-10 flex justify-center">
          <button
            type="button"
            onClick={() => nav(selectedPath)}
            className="rounded-xl bg-gradient-to-r from-primary to-primary-container px-6 py-3 text-sm font-bold text-on-primary-container transition hover:opacity-95"
          >
            ابدأ الآن
          </button>
        </div>
      </section>
    </div>
  );
}

