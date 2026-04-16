const integrations = [
  { name: "Slack", desc: "Team notifications & approvals", icon: "chat", status: "Connected", code: "slack" },
  { name: "Shopify", desc: "E-commerce catalog sync", icon: "shopping_bag", status: "Syncing", code: "shopify" },
  { name: "Gmail", desc: "Automated outreach drafts", icon: "mail", status: "Active", code: "gmail" },
  { name: "GitHub", desc: "Repo-aware content snippets", icon: "code", status: "Idle", code: "github" },
  { name: "Discord", desc: "Community pulse & alerts", icon: "forum", status: "Beta", code: "discord" },
  { name: "Notion", desc: "Docs & wikis as context", icon: "description", status: "Soon", code: "notion" },
];

export default function IntegrationsPage() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-6 rounded-lg border border-indigo-200/50 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-3 text-sm text-indigo-800 dark:text-indigo-300 shadow-sm">
        <strong className="font-bold">UI Placeholder:</strong> Integrations stay as design placeholders — no backend sync. The rest
        of the studio uses the real API.
      </div>
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Integrations Hub</h1>
          <p className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
            Connect Social Geni to the tools your team already uses. OAuth-ready placeholders — wire backend when ready.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-2 dark:focus:ring-offset-[#111]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Request Integration
        </button>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((it) => (
          <div
            key={it.name}
            className="group relative flex flex-col rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 shadow-sm transition-all hover:border-gray-300 dark:hover:border-white/20 hover:-translate-y-0.5"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 transition-colors group-hover:bg-gray-100 dark:group-hover:bg-white/10">
              <span className="material-symbols-outlined text-[24px] text-gray-900 dark:text-white">{it.icon}</span>
            </div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{it.name}</h3>
              <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                {it.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">{it.desc}</p>
            <div className="mt-6 flex gap-2">
              <button type="button" className="flex-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black px-3 py-2 text-xs font-semibold hover:opacity-90 transition-opacity">
                Configure
              </button>
              <button type="button" className="rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                Docs
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 sm:p-8 shadow-sm">
        <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Webhooks & API Keys</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Manage signing secrets and callback URLs for server-to-server integrations (mock UI).
        </p>
        <div className="flex flex-wrap gap-4">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-white/20 px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/40 transition-colors bg-gray-50/50 dark:bg-white/[0.02]">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Webhook Endpoint
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-white/20 px-5 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/40 transition-colors bg-gray-50/50 dark:bg-white/[0.02]">
            <span className="material-symbols-outlined text-[18px]">key</span>
            Rotate API Key
          </button>
        </div>
      </section>
    </div>
  );
}
