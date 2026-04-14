import type { ReactNode } from "react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Skeleton } from "../components/Skeleton";

function linkClass(isActive: boolean) {
  return [
    "rounded-lg px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-primary/15 text-primary dark:bg-primary/25 dark:text-secondary"
      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:text-secondary/80 dark:hover:bg-earth-darkBg/60 dark:hover:text-secondary",
  ].join(" ");
}

export default function UserLayout({ demoBanner }: { demoBanner?: ReactNode }) {
  const { entitlements, session, signInWithGoogle, signOut, ready } = useAuth();
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

  if (!ready) {
    return (
      <div className="min-h-screen bg-surface text-on-surface dark:bg-earth-darkBg dark:text-secondary">
        <header className="sticky top-0 z-30 border-b border-outline/20 bg-surface/80 backdrop-blur dark:border-muted/35 dark:bg-earth-darkBg/80">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Skeleton className="h-7 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="hidden h-7 w-16 sm:inline-flex" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
              <nav className="flex items-center gap-1">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-8 w-14" />
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-2 pb-10 pt-4 sm:px-4 sm:pt-6">
          <Skeleton className="mb-6 h-24 w-full rounded-2xl" />
          <Skeleton className="mb-4 h-[300px] w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface dark:bg-earth-darkBg dark:text-secondary">
      <header className="sticky top-0 z-30 border-b border-outline/20 bg-surface/80 backdrop-blur dark:border-muted/35 dark:bg-earth-darkBg/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="font-headline text-xl font-extrabold tracking-tight text-primary dark:text-secondary">
            Social Geni
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-lg border border-outline/25 bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant sm:inline-flex">
              Plan: {entitlements?.plan_code ?? "free"}
            </span>
            {session ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-2 rounded-lg border border-outline/30 bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <span className="material-symbols-outlined text-sm">login</span>
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )}
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
            <NavLink to="/pricing" className={({ isActive }) => linkClass(isActive)}>
              Pricing
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


