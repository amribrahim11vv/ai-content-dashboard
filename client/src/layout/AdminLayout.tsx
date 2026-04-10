import { useEffect, useState } from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import { getHealth } from "../api/misc";

function navClass(isActive: boolean) {
  return [
    "rounded-lg px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-primary/15 text-primary dark:bg-brand-primary/25 dark:text-brand-darkText"
      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:text-brand-darkText/80 dark:hover:bg-earth-darkBg/60 dark:hover:text-brand-darkText",
  ].join(" ");
}

export default function AdminLayout() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
  const [apiStatus, setApiStatus] = useState<"checking" | "active" | "offline">("checking");

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

  const toggleTheme = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme_mode", next);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface dark:bg-earth-darkBg dark:text-brand-darkText">
      <header className="sticky top-0 z-30 border-b border-outline/20 bg-surface/80 backdrop-blur dark:border-brand-muted/35 dark:bg-earth-darkBg/80">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <p className="font-headline text-xl font-extrabold tracking-tight text-primary dark:text-brand-sand">Social Geni</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Admin Console</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface md:inline-flex dark:border-brand-muted/40 dark:bg-earth-darkCard dark:text-brand-darkText">
              <span
                className={[
                  "material-symbols-outlined text-sm",
                  apiStatus === "active" ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]" : "",
                  apiStatus === "offline" ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.55)]" : "",
                  apiStatus === "checking" ? "text-on-surface-variant" : "",
                ].join(" ")}
                aria-hidden
              >
                radio_button_checked
              </span>
              {apiStatus === "active" ? "API ON" : apiStatus === "offline" ? "API OFF" : "API…"}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:border-brand-muted/40 dark:bg-earth-darkCard dark:text-brand-darkText"
              aria-label="Toggle theme"
              title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="material-symbols-outlined text-sm">{themeMode === "dark" ? "light_mode" : "dark_mode"}</span>
              <span className="hidden sm:inline">{themeMode === "dark" ? "Light" : "Dark"}</span>
            </button>
            <nav className="flex items-center gap-1" aria-label="Admin navigation">
              <NavLink to="/admin/prompt-catalog" className={({ isActive }) => navClass(isActive)}>
                Prompt Catalog
              </NavLink>
              <NavLink to="/admin/analytics" className={({ isActive }) => navClass(isActive)}>
                Analytics
              </NavLink>
              <NavLink to="/admin/generated-kits" className={({ isActive }) => navClass(isActive)}>
                Kits Review
              </NavLink>
              <Link
                to="/wizard"
                className="rounded-lg border border-outline/30 px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              >
                Open User App
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-2 pb-10 pt-4 sm:px-4 sm:pt-6">
        <Outlet />
      </main>
    </div>
  );
}

