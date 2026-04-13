import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProfile, updateProfile } from "../api";

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setDisplayName(p.display_name);
        setEmail(p.email);
        setMessage(null);
      })
      .catch(() => setMessage("Could not load profile from API."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/40 font-headline text-xl font-bold text-on-primary ring-2 ring-primary/30">
            {(displayName.trim().slice(0, 2) || "AI").toUpperCase()}
          </div>
          <div>
            <h1 className="headline text-3xl font-black text-on-surface">Account</h1>
            <p className="text-sm text-on-surface-variant">Studio profile · stored on the API</p>
          </div>
        </div>
        <Link
          to="/"
          className="rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high"
        >
          Back to dashboard
        </Link>
      </div>

      {message && (
        <p className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="glass-panel lg:col-span-2 rounded-uniform border border-outline-variant/25 p-8">
          <h2 className="headline mb-6 text-lg font-bold">Profile details</h2>
          <div className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Display name
              <input
                type="text"
                value={displayName}
                disabled={loading}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Email
              <input
                type="email"
                value={email}
                disabled={loading}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <button
              type="button"
              disabled={loading || saving}
              className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
              onClick={() => {
                setSaving(true);
                setMessage(null);
                updateProfile({ display_name: displayName, email })
                  .then((p) => {
                    setDisplayName(p.display_name);
                    setEmail(p.email);
                    setMessage("Saved.");
                  })
                  .catch(() => setMessage("Save failed. Please verify API availability."))
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </section>
        <section className="glass-panel rounded-uniform border border-outline-variant/25 p-8">
          <h2 className="headline mb-4 text-lg font-bold">Shortcuts</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/help" className="text-primary hover:underline">
                Help & support
              </Link>
            </li>
            <li>
              <Link to="/integrations" className="text-primary hover:underline">
                Integrations
              </Link>
            </li>
            <li>
              <Link to="/brand-voice" className="text-primary hover:underline">
                Brand voice
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
