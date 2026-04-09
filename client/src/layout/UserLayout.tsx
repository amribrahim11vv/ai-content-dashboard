import type { ReactNode } from "react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

function linkClass(isActive: boolean) {
  return [
    "rounded-lg px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-primary/15 text-primary dark:bg-primary/25 dark:text-secondary"
      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:text-secondary/80 dark:hover:bg-earth-darkBg/60 dark:hover:text-secondary",
  ].join(" ");
}

export default function UserLayout({ demoBanner }: { demoBanner?: ReactNode }) {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

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
    <div className="min-h-screen bg-surface text-on-surface dark:bg-earth-darkBg dark:text-secondary">
      <header className="sticky top-0 z-30 border-b border-outline/20 bg-surface/80 backdrop-blur dark:border-muted/35 dark:bg-earth-darkBg/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="font-headline text-xl font-extrabold tracking-tight text-primary dark:text-secondary">
            Social Geni
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:border-muted/40 dark:bg-surface-container-high dark:text-secondary"
              aria-label="Toggle theme"
              title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="material-symbols-outlined text-sm">{themeMode === "dark" ? "light_mode" : "dark_mode"}</span>
              <span className="hidden sm:inline">{themeMode === "dark" ? "Light" : "Dark"}</span>
            </button>
            <nav className="flex items-center gap-1" aria-label="User navigation">
            <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
              Home
            </NavLink>
            <NavLink to="/wizard" className={({ isActive }) => linkClass(isActive)}>
              Wizard
            </NavLink>
            <NavLink to="/generated-kits" className={({ isActive }) => linkClass(isActive)}>
              Kits
            </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-2 pb-10 pt-4 sm:px-4 sm:pt-6">
        {demoBanner}
        <Outlet />
      </main>
    </div>
  );
}


