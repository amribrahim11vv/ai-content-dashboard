import { useState } from "react";
import { postExtrasWaitlist } from "../api";

const tools = [
  {
    id: "batch-rephrase",
    title: "Batch rephrase",
    desc: "Rewrite dozens of captions with one prompt.",
    icon: "translate",
    tag: "Labs",
  },
  {
    id: "competitor-radar",
    title: "Competitor radar",
    desc: "Track tone shifts across rival brands.",
    icon: "radar",
    tag: "Soon",
  },
  {
    id: "asset-upscaler",
    title: "Asset upscaler",
    desc: "4× neural upscale for campaign visuals.",
    icon: "hd",
    tag: "Beta",
  },
  {
    id: "voice-clone-lite",
    title: "Voice clone lite",
    desc: "Short-form audio from brand guidelines.",
    icon: "mic",
    tag: "Waitlist",
  },
];

export default function ExtrasPage() {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <>
      <div className="mb-10">
        <h1 className="headline text-4xl font-black tracking-tight text-on-surface md:text-5xl">Future tools</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Experimental capabilities on the Ethereal roadmap. Joining the waitlist is stored on the studio API.
        </p>
      </div>
      {status && (
        <p className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          {status}
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {tools.map((t) => (
          <div
            key={t.id}
            className="group relative overflow-hidden rounded-uniform border border-outline-variant/25 bg-surface-container-low p-8 transition-all hover:border-primary/25"
          >
            <div className="absolute -end-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-100" />
            <div className="mb-4 flex items-start justify-between">
              <span className="material-symbols-outlined text-3xl text-primary">{t.icon}</span>
              <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tertiary">
                {t.tag}
              </span>
            </div>
            <h3 className="headline mb-2 text-xl font-bold">{t.title}</h3>
            <p className="text-sm text-on-surface-variant">{t.desc}</p>
            <button
              type="button"
              className="mt-6 text-xs font-bold uppercase tracking-widest text-primary opacity-80 transition-all group-hover:opacity-100"
              onClick={() => {
                postExtrasWaitlist(t.id)
                  .then(() => setStatus(`You're on the waitlist for “${t.title}”.`))
                  .catch(() => setStatus("Could not save. Please verify API availability."));
              }}
            >
              Notify me →
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
