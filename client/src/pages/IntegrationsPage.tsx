import PrimaryFlowBanner from "../components/PrimaryFlowBanner";

const integrations = [
  { name: "Slack", desc: "Team notifications & approvals", icon: "chat", color: "from-primary to-primary-container", status: "Connected" },
  { name: "Shopify", desc: "E-commerce catalog sync", icon: "shopping_bag", color: "from-tertiary to-tertiary-container", status: "Syncing" },
  { name: "Gmail", desc: "Automated outreach drafts", icon: "mail", color: "from-primary-container to-primary", status: "Active" },
  { name: "GitHub", desc: "Repo-aware content snippets", icon: "code", color: "from-surface-container-highest to-surface-container-low", status: "Idle" },
  { name: "Discord", desc: "Community pulse & alerts", icon: "forum", color: "from-tertiary-container to-tertiary", status: "Beta" },
  { name: "Notion", desc: "Docs & wikis as context", icon: "description", color: "from-surface-container to-surface-container-highest", status: "Soon" },
];

export default function IntegrationsPage() {
  return (
    <>
      <PrimaryFlowBanner />
      <p className="mb-6 rounded-xl border border-tertiary/25 bg-tertiary/10 px-4 py-3 text-sm text-on-surface">
        <strong className="text-tertiary">UI only:</strong> Integrations stay as design placeholders — no backend sync. The rest
        of the studio (kits, profile, notifications, brand voice, extras waitlist, help) uses the real API.
      </p>
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="headline text-4xl font-black tracking-tight text-on-surface md:text-5xl">Integrations Hub</h1>
          <p className="mt-2 max-w-xl text-on-surface-variant">
            Connect Social Geni to the tools your team already uses. OAuth-ready placeholders — wire backend when ready.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-primary to-primary-container px-6 py-3 font-bold text-on-primary-container shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
        >
          Request integration
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((it) => (
          <div
            key={it.name}
            className="glass-panel group relative overflow-hidden rounded-2xl border border-outline-variant/25 p-6 transition-all hover:border-primary/30"
          >
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${it.color}`}>
              <span className="material-symbols-outlined text-2xl text-on-primary">{it.icon}</span>
            </div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="headline text-lg font-bold">{it.name}</h3>
              <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {it.status}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">{it.desc}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary">
                Configure
              </button>
              <button type="button" className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-on-surface-variant">
                Docs
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className="glass-panel rounded-3xl border border-outline-variant/25 p-8">
        <h2 className="headline mb-2 text-xl font-bold">Webhooks & API keys</h2>
        <p className="mb-6 text-sm text-on-surface-variant">
          Manage signing secrets and callback URLs for server-to-server integrations (mock UI).
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded-xl border border-dashed border-outline-variant/40 px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-tertiary/50">
            + Add webhook endpoint
          </button>
          <button type="button" className="rounded-xl border border-dashed border-outline-variant/40 px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-tertiary/50">
            Rotate API key
          </button>
        </div>
      </section>
    </>
  );
}
