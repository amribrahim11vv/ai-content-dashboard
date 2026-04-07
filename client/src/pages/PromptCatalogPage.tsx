import { useEffect, useMemo, useState } from "react";
import {
  activatePromptVersion,
  createPromptCatalogIndustry,
  createPromptVersion,
  deletePromptVersion,
  getFallbackPrompt,
  listPromptCatalogIndustries,
  listPromptVersions,
  validatePromptTemplate,
  type PromptCatalogIndustry,
  type PromptCatalogPrompt,
} from "../api";
import { normalizeIndustrySlug } from "../lib/industrySlug";

export default function PromptCatalogPage() {
  const [industries, setIndustries] = useState<PromptCatalogIndustry[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("__fallback__");
  const [versions, setVersions] = useState<PromptCatalogPrompt[]>([]);
  const [requiredVars, setRequiredVars] = useState<readonly string[]>([]);
  const [template, setTemplate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [message, setMessage] = useState<string | null>(null);
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [strictMode, setStrictMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingIndustry, setCreatingIndustry] = useState(false);
  const [newIndustryName, setNewIndustryName] = useState("");
  const [newIndustrySlug, setNewIndustrySlug] = useState("");

  const selectedSlug = useMemo(
    () => (selectedIndustry === "__fallback__" ? null : selectedIndustry),
    [selectedIndustry]
  );
  const isCreativeOnlyTemplate = useMemo(
    () => !/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(template),
    [template]
  );

  async function refreshIndustries() {
    const data = await listPromptCatalogIndustries();
    setIndustries(data.items);
  }

  async function refreshVersions() {
    if (selectedSlug) {
      const data = await listPromptVersions(selectedSlug);
      setVersions(data.items);
      setRequiredVars(data.required_variables);
      return;
    }
    const fallback = await getFallbackPrompt().catch(() => null);
    const allFallback = await listPromptVersions(undefined);
    setVersions(allFallback.items);
    setRequiredVars(allFallback.required_variables);
    if (fallback?.item?.prompt_template) {
      setTemplate((old) => old || fallback.item.prompt_template);
    }
  }

  useEffect(() => {
    Promise.all([refreshIndustries(), refreshVersions()])
      .catch(() => setMessage("Failed to load prompt catalog data."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshVersions().catch(() => setMessage("Failed to load prompt versions."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="headline text-4xl font-black tracking-tight text-on-surface md:text-5xl">Prompt Catalog</h1>
        <p className="max-w-3xl text-brand-muted dark:text-on-surface-variant">
          Dynamic prompt management per industry with versioning and global fallback. Write the creative direction only —
          client data from the wizard is injected automatically before generation. Placeholder templates remain supported
          for legacy versions.
        </p>
      </header>

      {message && (
        <div
          className="rounded-xl border border-brand-sand/30 bg-earth-card px-4 py-3 text-sm text-brand-muted dark:border-outline/30 dark:bg-surface-container-low dark:text-on-surface-variant"
          role="status"
        >
          {message}
        </div>
      )}
      {loading && (
        <p className="text-xs text-on-surface-variant" role="status">
          Loading catalog…
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-brand-sand/30 bg-earth-card p-6 lg:col-span-2 dark:border-outline/30 dark:bg-surface-container-low">
          <h2 className="headline mb-4 text-xl font-bold">Add industry</h2>
          <div className="grid grid-cols-1 gap-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Name
              <input
                value={newIndustryName}
                onChange={(e) => setNewIndustryName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
                placeholder="e.g. Travel"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Slug
              <input
                value={newIndustrySlug}
                onChange={(e) => setNewIndustrySlug(e.target.value)}
                className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
                placeholder="e.g. travel"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={creatingIndustry}
                className="h-[38px] w-full rounded-xl bg-brand-primary px-6 text-sm font-bold text-white disabled:opacity-50 hover:bg-brand-primary/90 dark:bg-primary dark:text-on-primary"
                onClick={() => {
                  const name = newIndustryName.trim();
                  const slugInput = newIndustrySlug.trim();
                  if (!name || !slugInput) {
                    setMessage("Industry name and slug are required.");
                    return;
                  }
                  const normalizedSlug = normalizeIndustrySlug(slugInput);
                  const existsByName = industries.some((i) => i.name.trim().toLowerCase() === name.toLowerCase());
                  if (existsByName) {
                    setMessage("Industry name already exists. Please choose a different name.");
                    return;
                  }
                  const existsBySlug = industries.some((i) => i.slug === normalizedSlug);
                  if (existsBySlug) {
                    setMessage("Industry slug already exists.");
                    return;
                  }
                  setCreatingIndustry(true);
                  setMessage(null);
                  createPromptCatalogIndustry({ name, slug: normalizedSlug, is_active: true })
                    .then(async (created) => {
                      setMessage("Industry created.");
                      setNewIndustryName("");
                      setNewIndustrySlug("");
                      await refreshIndustries();
                      setSelectedIndustry(created.slug);
                    })
                    .catch((e) => setMessage(e instanceof Error ? e.message : "Failed to create industry."))
                    .finally(() => setCreatingIndustry(false));
                }}
              >
                {creatingIndustry ? "Creating..." : "Add industry"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-brand-sand/30 bg-earth-card p-6 dark:border-outline/30 dark:bg-surface-container-low">
          <h2 className="headline mb-4 text-xl font-bold">Create new version</h2>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Industry
            <select
              className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
            >
              <option value="__fallback__">Global fallback</option>
              {industries.map((i) => (
                <option key={i.id} value={i.slug}>
                  {i.name} ({i.slug})
                </option>
              ))}
            </select>
          </label>

          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Status
            <select
              className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "active")}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
            </select>
          </label>

          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
              placeholder="What changed in this version?"
            />
          </label>

          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Prompt template
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={14}
              className="mt-2 w-full rounded-xl border border-brand-sand/30 bg-earth-card px-3 py-2 font-mono text-xs focus:ring-2 focus:ring-primary/35 dark:border-outline/30 dark:bg-surface-container-high"
              placeholder="Paste template here..."
            />
            <p className="mt-2 text-xs leading-relaxed text-brand-muted dark:text-on-surface-variant">
              This must be <strong className="text-on-surface">instruction text for the model</strong>, not a JSON &quot;output schema&quot;.{" "}
              <strong className="text-on-surface">Placeholders are optional.</strong> If{" "}
              <code className="rounded bg-surface-container-high px-1">STRICT_PROMPT_TEMPLATES</code> is off (default), legacy templates with missing placeholders can still be saved and missing values render as empty strings.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-brand-muted dark:text-on-surface-variant">
              Recommended workflow: enter only the industry creative strategy here (tone, hooks, angles, offers). The
              backend appends a fixed client-context block automatically (brand, audience, goals, counts, etc.).
            </p>
          </label>

          {!isCreativeOnlyTemplate ? (
            <div className="mb-3 rounded-xl border border-brand-primary/20 bg-brand-primary/10 p-3 text-xs text-brand-muted dark:border-primary/20 dark:bg-primary/10 dark:text-on-surface-variant">
              <p className="font-semibold text-on-surface">Required variables (legacy placeholder mode)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(requiredVars.length ? requiredVars : []).map((v) => (
                  <span key={v} className="rounded-full bg-earth-alt px-2 py-1 dark:bg-surface-container-high">
                    {"{{"}
                    {v}
                    {"}}"}
                  </span>
                ))}
              </div>
              {missingVars.length > 0 && (
                <p className={strictMode === true ? "mt-2 text-error" : "mt-2 text-tertiary"}>
                  {strictMode === true ? "Missing (required in strict mode): " : "Missing (warning — save still allowed): "}
                  {missingVars.map((v) => `{{${v}}}`).join(", ")}
                </p>
              )}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              className="rounded-xl border border-brand-sand/30 bg-earth-alt px-4 py-2 text-sm font-bold text-brand-text disabled:opacity-50 dark:border-outline/30 dark:bg-surface-container-high dark:text-on-surface"
              onClick={() => {
                validatePromptTemplate(template)
                  .then((r) => {
                    setMissingVars(r.missing_variables);
                    setStrictMode(r.strict_mode ?? false);
                    setMessage(
                      r.ok
                        ? r.mode === "creative_only"
                          ? "Creative-only prompt is valid. Placeholders optional."
                          : "Template contract is valid."
                        : r.strict_mode
                          ? "Template is missing required variables (strict mode would block save)."
                          : "Template is missing some placeholders — placeholders are optional in creative-only mode, and save is still allowed."
                    );
                  })
                  .catch(() => setMessage("Validation failed."));
              }}
            >
              Validate
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-brand-primary/90 dark:bg-primary dark:text-on-primary"
              onClick={() => {
                const trimmed = template.trim();
                if (!trimmed) {
                  setMessage("Paste a prompt template first.");
                  return;
                }
                setSaving(true);
                setMessage(null);
                createPromptVersion({
                  industry_slug: selectedSlug,
                  prompt_template: template,
                  notes,
                  status,
                })
                  .then(async (res) => {
                    setTemplate("");
                    setNotes("");
                    setStatus("draft");
                    setMissingVars(res.template_warnings?.missing_variables ?? []);
                    setMessage(
                      res.template_warnings?.missing_variables?.length
                        ? `Prompt version saved. Warning: missing ${res.template_warnings.missing_variables.map((v) => `{{${v}}}`).join(", ")} — will render empty in generation.`
                        : "Prompt version created."
                    );
                    await refreshIndustries();
                    await refreshVersions();
                  })
                  .catch((e) => setMessage(e instanceof Error ? e.message : "Create failed."))
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Saving..." : "Create version"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-brand-sand/30 bg-earth-card p-6 dark:border-outline/30 dark:bg-surface-container-low">
          <h2 className="headline mb-4 text-xl font-bold">Version history</h2>
          <div className="space-y-3">
            {versions.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No versions found.</p>
            ) : (
              versions.map((v) => (
                <article key={v.id} className="rounded-xl border border-brand-sand/30 bg-earth-card p-3 dark:border-outline/30 dark:bg-surface-container-high">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        v{v.version} · <span className="uppercase">{v.status}</span>
                      </p>
                      <p className="text-xs text-on-surface-variant">{v.notes || "No notes"}</p>
                    </div>
                    <button
                      type="button"
                      disabled={v.status === "active"}
                      className="rounded-lg bg-brand-primary px-3 py-1 text-xs font-bold text-white disabled:opacity-55 dark:bg-primary dark:text-on-primary"
                      title={v.status === "active" ? "Already active" : `Activate version v${v.version}`}
                      onClick={() => {
                        activatePromptVersion(v.id)
                          .then(async () => {
                            setMessage(`Activated v${v.version}`);
                            await refreshIndustries();
                            await refreshVersions();
                          })
                          .catch(() => setMessage("Activation failed."));
                      }}
                    >
                      Activate
                    </button>
                    <button
                      type="button"
                      disabled={v.status === "active"}
                      className="rounded-lg bg-brand-accent px-3 py-1 text-xs font-bold text-white disabled:opacity-55 dark:bg-error dark:text-on-error"
                      title={
                        v.status === "active"
                          ? "Cannot delete an active version. Activate another version first."
                          : `Delete version v${v.version}`
                      }
                      onClick={() => {
                        const ok = window.confirm(
                          `Delete prompt version v${v.version}? This cannot be undone.`
                        );
                        if (!ok) return;
                        deletePromptVersion(v.id)
                          .then(async () => {
                            setMessage(`Deleted v${v.version}`);
                            await refreshIndustries();
                            await refreshVersions();
                          })
                          .catch((e) => setMessage(e instanceof Error ? e.message : "Delete failed."));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <pre className="mt-3 max-h-44 overflow-auto rounded-lg bg-earth-alt p-2 text-[11px] text-brand-muted dark:bg-surface-container-low dark:text-on-surface-variant">
                    {v.prompt_template}
                  </pre>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
