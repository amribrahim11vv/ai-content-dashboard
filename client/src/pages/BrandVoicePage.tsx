import { useEffect, useState } from "react";
import { getBrandVoice, updateBrandVoice, type BrandVoicePillar } from "../api";

export default function BrandVoicePage() {
  const [pillars, setPillars] = useState<BrandVoicePillar[]>([]);
  const [avoidWords, setAvoidWords] = useState<string[]>([]);
  const [sampleSnippet, setSampleSnippet] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getBrandVoice()
      .then((d) => {
        setPillars(d.pillars);
        setAvoidWords(d.avoid_words);
        setSampleSnippet(d.sample_snippet);
        setMessage(null);
      })
      .catch(() => setMessage("Could not load brand voice from API."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="mb-10">
        <h1 className="headline text-4xl font-black tracking-tight text-on-surface md:text-5xl">Brand voice guidelines</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Align generated content with tone, vocabulary, and taboos. Saved to the studio API — reference for your team and the
          Content Wizard.
        </p>
      </div>

      {message && (
        <p className="mb-6 rounded-uniform border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="glass-panel rounded-uniform border border-outline-variant/25 p-8">
          <h2 className="headline mb-4 text-xl font-bold">Core pillars</h2>
          <ul className="space-y-4 text-sm text-on-surface-variant">
            {loading ? (
              <li>Loading…</li>
            ) : (
              pillars.map((p, i) => (
                <li key={i} className="rounded-uniform bg-surface-container-low/40 p-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Title</label>
                  <input
                    type="text"
                    value={p.title}
                    onChange={(e) => {
                      const next = [...pillars];
                      next[i] = { ...next[i]!, title: e.target.value };
                      setPillars(next);
                    }}
                    className="mb-2 mt-1 w-full rounded-uniform border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-on-surface focus:ring-2 focus:ring-primary/35"
                  />
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Body</label>
                  <textarea
                    value={p.body}
                    onChange={(e) => {
                      const next = [...pillars];
                      next[i] = { ...next[i]!, body: e.target.value };
                      setPillars(next);
                    }}
                    rows={3}
                    className="mt-1 w-full rounded-uniform border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-on-surface focus:ring-2 focus:ring-primary/35"
                  />
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="glass-panel rounded-uniform border border-outline-variant/25 p-8">
          <h2 className="headline mb-4 text-xl font-bold">Words to avoid</h2>
          <div className="flex flex-wrap gap-2">
            {avoidWords.map((w, i) => (
              <button
                key={`${w}-${i}`}
                type="button"
                className="rounded-full bg-error-container/20 px-3 py-1 text-xs font-semibold text-error hover:bg-error-container/30"
                onClick={() => setAvoidWords(avoidWords.filter((_, j) => j !== i))}
                title="Remove"
              >
                {w} ×
              </button>
            ))}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const w = String(fd.get("word") ?? "").trim();
              if (w) setAvoidWords([...avoidWords, w]);
              e.currentTarget.reset();
            }}
          >
            <input
              name="word"
              type="text"
              placeholder="Add word…"
              className="flex-1 rounded-uniform border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/35"
            />
            <button type="submit" className="rounded-uniform bg-primary px-4 py-2 text-sm font-bold text-on-primary">
              Add
            </button>
          </form>
          <p className="mt-6 text-sm text-on-surface-variant">
            The wizard&apos;s <em>Brand tone</em> field feeds generation — keep marketing aligned with this list.
          </p>
        </section>
      </div>

      <section className="mt-8 glass-panel rounded-uniform border border-primary/20 p-8">
        <h2 className="headline mb-2 text-xl font-bold">Sample voice snippet</h2>
        <textarea
          value={sampleSnippet}
          disabled={loading}
          onChange={(e) => setSampleSnippet(e.target.value)}
          rows={4}
          className="w-full rounded-uniform border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 font-manrope text-on-surface italic focus:ring-2 focus:ring-primary/35"
        />
        <button
          type="button"
          disabled={loading || saving}
          className="mt-4 rounded-uniform bg-primary px-6 py-3 font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
          onClick={() => {
            setSaving(true);
            setMessage(null);
            updateBrandVoice({ pillars, avoid_words: avoidWords, sample_snippet: sampleSnippet })
              .then(() => setMessage("Brand voice saved."))
              .catch(() => setMessage("Save failed. Please verify API availability."))
              .finally(() => setSaving(false));
          }}
        >
          {saving ? "Saving…" : "Save brand voice"}
        </button>
      </section>
    </>
  );
}
