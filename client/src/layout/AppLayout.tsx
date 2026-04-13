import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  listKits,
  listNotifications,
  markAllNotificationsRead,
  getPreferences,
  updatePreferences,
  getProfile,
  getHealth,
  type NotificationItem,
} from "../api";
import type { KitSummary } from "../types";
import GlobalSearchOverlay from "./GlobalSearchOverlay";
import { CompactTableProvider } from "./compactTableContext";
import { useThemeMode } from "./hooks/useThemeMode";

function icon(name: string) {
  return (
    <span className="material-symbols-outlined" aria-hidden>
      {name}
    </span>
  );
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function navLinkClass(active: boolean) {
  return [
    "flex items-center gap-3 rounded-xl px-4 py-3 font-manrope text-xs font-semibold uppercase tracking-wider transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    active
      ? "scale-[1.02] border-e-2 border-primary bg-primary/15 text-primary dark:border-secondary dark:bg-primary/20 dark:text-secondary"
      : "text-on-surface-variant hover:bg-surface-container-high/70 hover:text-on-surface dark:text-secondary/80 dark:hover:bg-earth-darkBg/55 dark:hover:text-secondary",
  ].join(" ");
}

export default function AppLayout({
  children,
  demoBanner,
}: {
  children: ReactNode;
  demoBanner?: ReactNode;
}) {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [compactTable, setCompactTable] = useState(() => {
    try {
      return localStorage.getItem("ethereal_compact_table") === "1";
    } catch {
      return false;
    }
  });
  const [profileName, setProfileName] = useState("User");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [apiStatus, setApiStatus] = useState<"checking" | "active" | "offline">("checking");
  const { themeMode, toggleTheme } = useThemeMode();

  const notifWrap = useRef<HTMLDivElement>(null);
  const settingsWrap = useRef<HTMLDivElement>(null);
  const userWrap = useRef<HTMLDivElement>(null);

  const closeHeaderPanels = useCallback(() => {
    setNotifOpen(false);
    setSettingsOpen(false);
    setUserOpen(false);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    getPreferences()
      .then((p) => {
        setCompactTable(p.compact_table);
        try {
          localStorage.setItem("ethereal_compact_table", p.compact_table ? "1" : "0");
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        try {
          setCompactTable(localStorage.getItem("ethereal_compact_table") === "1");
        } catch {
          /* ignore */
        }
      });
    getProfile()
      .then((p) => setProfileName(p.display_name || "User"))
      .catch(() => {});
    listNotifications()
      .then((r) => setNotifications(r.items))
      .catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const health = await getHealth();
        if (!cancelled) setApiStatus(health.ok ? "active" : "offline");
      } catch {
        if (!cancelled) setApiStatus("offline");
      }
    };
    void checkHealth();
    const id = window.setInterval(() => {
      void checkHealth();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    listKits()
      .then(setKits)
      .catch(() => setKits([]));
  }, [searchOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    listNotifications()
      .then((r) => setNotifications(r.items))
      .catch(() => {});
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen && !settingsOpen && !userOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (notifOpen && !notifWrap.current?.contains(t)) setNotifOpen(false);
      if (settingsOpen && !settingsWrap.current?.contains(t)) setSettingsOpen(false);
      if (userOpen && !userWrap.current?.contains(t)) setUserOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notifOpen, settingsOpen, userOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHeaderPanels();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHeaderPanels]);

  const openSearch = () => {
    closeHeaderPanels();
    setSearchOpen(true);
  };

  const onNavItemClick = () => setMobileNavOpen(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface text-on-surface dark:bg-earth-darkBg dark:text-secondary">
      <GlobalSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        kits={kits}
        query={searchQuery}
        onQueryChange={setSearchQuery}
      />

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 md:hidden"
        />
      )}

      <aside
        className={[
          "fixed start-0 top-0 z-50 flex h-screen w-64 flex-col border-e border-outline/25 bg-surface-container-low/70 px-4 py-8 shadow-[20px_0_40px_rgb(var(--c-on-surface)/0.2)] backdrop-blur-3xl transition-transform duration-300 dark:border-muted/40 dark:bg-surface-container-high/85",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="mb-3 ms-auto rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high md:hidden"
          aria-label="Close menu"
        >
          {icon("close")}
        </button>
        <div className="mb-10 px-4">
          <h1 className="font-headline text-2xl font-bold tracking-tighter text-primary">
            Social Geni
          </h1>
          <p className="mt-1 font-manrope text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant dark:text-secondary/75">
            AI Content Kits in Minutes
          </p>
        </div>
        <nav className="flex flex-grow flex-col gap-2" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)} onClick={onNavItemClick}>
            {icon("dashboard")}
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/generated-kits" className={({ isActive }) => navLinkClass(isActive)} onClick={onNavItemClick}>
            {icon("inventory_2")}
            <span>Generated Kits</span>
          </NavLink>
          <NavLink to="/wizard" className={({ isActive }) => navLinkClass(isActive)} onClick={onNavItemClick}>
            {icon("auto_awesome")}
            <span>Content Wizard</span>
          </NavLink>
        </nav>
        <div className="mt-auto space-y-2 border-t border-outline/25 pt-6">
          <Link
            to="/wizard"
            className="mb-6 block w-full scale-[1.02] rounded-xl bg-primary py-3 text-center font-headline font-bold text-on-primary shadow-lg shadow-primary-container/20 transition-opacity hover:opacity-90 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Create new Kit
          </Link>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-outline/20 bg-surface/65 px-4 backdrop-blur-xl dark:border-muted/35 dark:bg-earth-darkBg/80 md:start-64 md:w-[calc(100%-16rem)] md:px-8">
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high/70 focus-visible:ring-2 focus-visible:ring-primary/40 md:hidden"
            aria-label="Open menu"
          >
            {icon("menu")}
          </button>
          <button
            type="button"
            onClick={openSearch}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high/70 focus-visible:ring-2 focus-visible:ring-primary/40 sm:hidden"
            aria-label="Open search"
          >
            {icon("search")}
          </button>
          <div className="group relative hidden sm:block">
            <span className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">
              search
            </span>
            <input
              type="search"
              readOnly
              onFocus={openSearch}
              onClick={openSearch}
              className="w-32 cursor-pointer rounded-full border-none bg-surface-container-lowest py-1.5 ps-10 pe-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:ring-2 focus:ring-primary/45 dark:bg-surface-container-high/80 dark:text-secondary sm:w-56 md:w-64"
              placeholder="Search kits…"
              aria-label="Open search"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
            />
          </div>
          <div className="mx-1 hidden h-4 w-px bg-outline/35 sm:block sm:mx-2" />
          <span
            className={[
              "font-manrope text-sm font-bold tracking-tight transition-colors hidden sm:inline",
              apiStatus === "active" ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]" : "",
              apiStatus === "offline" ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.55)]" : "",
              apiStatus === "checking" ? "text-on-surface-variant" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            API: {apiStatus === "active" ? "Active" : apiStatus === "offline" ? "Offline" : "Checking..."}
          </span>
          <span
            className={[
              "font-manrope text-xs font-bold tracking-tight transition-colors sm:hidden",
              apiStatus === "active" ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]" : "",
              apiStatus === "offline" ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.55)]" : "",
              apiStatus === "checking" ? "text-on-surface-variant" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {apiStatus === "active" ? "API ON" : apiStatus === "offline" ? "API OFF" : "API…"}
          </span>
          <div className="hidden items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary lg:flex">
            <span className="material-symbols-outlined text-sm">north_east</span>
            Start from Content Wizard
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:border-outline/30 dark:bg-surface-container-high dark:text-secondary"
            aria-label="Toggle theme"
            title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="material-symbols-outlined text-sm">
              {themeMode === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span className="hidden sm:inline">{themeMode === "dark" ? "Light" : "Dark"}</span>
          </button>
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="relative" ref={notifWrap}>
              <button
                type="button"
                className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high/70 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setSettingsOpen(false);
                  setUserOpen(false);
                }}
              >
                {icon("notifications")}
                {notifications.some((n) => !n.read) && (
                  <span className="absolute end-2 top-2 h-2 w-2 rounded-full border border-surface bg-secondary" />
                )}
              </button>
              {notifOpen && (
                <div
                  className="absolute end-0 top-full z-[70] mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-outline-variant/35 bg-surface-container-high/95 p-4 shadow-2xl backdrop-blur-xl dark:border-muted/40 dark:bg-surface-container-high/95"
                  role="region"
                  aria-label="Notifications"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-headline text-sm font-bold">Notifications</h3>
                    <button
                      type="button"
                      className="text-xs font-bold text-primary"
                      onClick={() => {
                        markAllNotificationsRead()
                          .then(() => listNotifications())
                          .then((r) => setNotifications(r.items))
                          .catch(() => {});
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                    {notifications.length === 0 ? (
                      <li className="rounded-xl p-4 text-center text-on-surface-variant">No notifications yet.</li>
                    ) : (
                      notifications.map((n) => (
                        <li
                          key={n.id}
                          className={
                            "rounded-xl p-3 " + (n.read ? "hover:bg-surface-container-low/50" : "bg-surface-container-low")
                          }
                        >
                          <p className="font-semibold text-on-surface">{n.title}</p>
                          <p className="text-on-surface-variant">{n.body}</p>
                          <p className="mt-1 text-[10px] text-on-surface-variant/70">{formatRelativeTime(n.created_at)}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="relative hidden sm:block" ref={settingsWrap}>
              <button
                type="button"
                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high/70 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                aria-label="Quick settings"
                aria-expanded={settingsOpen}
                onClick={() => {
                  setSettingsOpen((v) => !v);
                  setNotifOpen(false);
                  setUserOpen(false);
                }}
              >
                {icon("settings_input_component")}
              </button>
              {settingsOpen && (
                <div
                  className="absolute end-0 top-full z-[70] mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-outline-variant/35 bg-surface-container-high/95 p-4 shadow-2xl backdrop-blur-xl dark:border-muted/40 dark:bg-surface-container-high/95"
                  role="region"
                  aria-label="Quick settings"
                >
                  <h3 className="mb-4 font-headline text-sm font-bold">Quick settings</h3>
                  <label className="flex cursor-pointer items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-on-surface-variant">Compact table rows</span>
                    <input
                      type="checkbox"
                      checked={compactTable}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setCompactTable(v);
                        try {
                          localStorage.setItem("ethereal_compact_table", v ? "1" : "0");
                        } catch {
                          /* ignore */
                        }
                        updatePreferences(v).catch(() => {});
                      }}
                      className="h-4 w-4 rounded border-outline-variant text-primary"
                    />
                  </label>
                  <p className="mt-2 text-xs text-on-surface-variant/80">
                    Synced to the studio API (falls back to this device if offline).
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="relative flex items-center gap-2 border-s border-outline/25 ps-2 sm:gap-3 sm:ps-4" ref={userWrap}>
            <button
              type="button"
              className="flex items-center gap-3 rounded-lg px-1 text-end outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-expanded={userOpen}
              aria-haspopup="menu"
              onClick={() => {
                setUserOpen((v) => !v);
                setNotifOpen(false);
                setSettingsOpen(false);
              }}
            >
              <div className="hidden sm:block">
                <p className="font-manrope text-sm font-bold text-on-surface">{profileName}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant dark:text-secondary/75">Social Geni</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 font-headline text-sm font-bold text-on-primary ring-2 ring-primary/30">
                {(profileName.trim().slice(0, 2) || "AI").toUpperCase()}
              </div>
            </button>
            {userOpen && (
              <div
                className="absolute end-0 top-full z-[70] mt-2 w-56 rounded-2xl border border-outline-variant/35 bg-surface-container-high/95 py-2 shadow-2xl backdrop-blur-xl dark:border-muted/40 dark:bg-surface-container-high/95"
                role="menu"
                aria-label="Account menu"
              >
                <Link
                  to="/admin/analytics"
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
                  onClick={() => setUserOpen(false)}
                >
                  Admin analytics
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <CompactTableProvider value={compactTable}>
        <main className="min-h-screen px-4 pb-12 pt-20 sm:px-6 md:ms-64 md:px-10 md:pt-24">
          {demoBanner}
          {children}
        </main>
      </CompactTableProvider>
    </div>
  );
}
