import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

function linkClass(isActive: boolean) {
  return [
    "rounded-lg px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-primary/15 text-primary dark:bg-brand-primary/25 dark:text-brand-darkText"
      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:text-brand-darkText/80 dark:hover:bg-earth-darkBg/60 dark:hover:text-brand-darkText",
  ].join(" ");
}

export default function UserLayout({ demoBanner }: { demoBanner?: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-on-surface dark:bg-earth-darkBg dark:text-brand-darkText">
      <header className="sticky top-0 z-30 border-b border-outline/20 bg-surface/80 backdrop-blur dark:border-brand-muted/35 dark:bg-earth-darkBg/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="font-headline text-xl font-extrabold tracking-tight text-primary dark:text-brand-sand">
            Social Geni
          </Link>
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
      </header>

      <main className="mx-auto w-full max-w-6xl px-2 pb-10 pt-4 sm:px-4 sm:pt-6">
        {demoBanner}
        <Outlet />
      </main>
    </div>
  );
}

