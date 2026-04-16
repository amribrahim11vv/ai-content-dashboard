import { useState } from "react";
import { postExtrasWaitlist } from "../api";

const tools = [
  {
    id: "batch-rephrase",
    title: "Batch Rephrase",
    desc: "Rewrite dozens of captions with one prompt.",
    icon: "translate",
    tag: "Labs",
  },
  {
    id: "competitor-radar",
    title: "Competitor Radar",
    desc: "Track tone shifts across rival brands.",
    icon: "radar",
    tag: "Soon",
  },
  {
    id: "asset-upscaler",
    title: "Asset Upscaler",
    desc: "4x neural upscale for campaign visuals.",
    icon: "hd",
    tag: "Beta",
  },
  {
    id: "voice-clone-lite",
    title: "Voice Clone Lite",
    desc: "Short-form audio from brand guidelines.",
    icon: "mic",
    tag: "Waitlist",
  },
];

export default function ExtrasPage() {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-5xl">Future Tools</h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600 dark:text-gray-400 mx-auto md:mx-0">
          Experimental capabilities currently on our roadmap. Joining the waitlist notifies you via email when these features become available in your studio.
        </p>
      </div>

      {status && (
        <div className="mb-8 flex items-center gap-2 rounded-lg border border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400 shadow-sm animate-in fade-in slide-in-from-top-2">
           <span className="material-symbols-outlined text-[18px]">check_circle</span>
           {status}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tools.map((t) => (
          <div
            key={t.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 sm:p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-gray-300 dark:hover:border-white/20"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-20 transition-opacity group-hover:opacity-10 dark:group-hover:opacity-30 pointer-events-none">
               <span className="material-symbols-outlined text-[100px] -m-8">{t.icon}</span>
            </div>
            
            <div className="relative z-10 block">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 text-gray-900 dark:text-white shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(255,255,255,0.02)] transition-colors group-hover:bg-gray-100 dark:group-hover:bg-white/10">
                  <span className="material-symbols-outlined text-[24px]">{t.icon}</span>
                </div>
                <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  {t.tag}
                </span>
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">{t.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">{t.desc}</p>
            </div>
            
            <div className="relative z-10 mt-auto">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-2 dark:focus:ring-offset-[#111]"
                onClick={() => {
                  postExtrasWaitlist(t.id)
                    .then(() => setStatus(`You've been added to the waitlist for “${t.title}”.`))
                    .catch(() => setStatus("Could not process your request at this time."));
                }}
              >
                Join Waitlist
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
