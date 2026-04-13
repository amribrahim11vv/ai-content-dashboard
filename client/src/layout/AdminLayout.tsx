import { NavLink, Link, Outlet } from "react-router-dom";

function navClass(isActive: boolean) {
  return [
    "rounded-lg px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-primary/15 text-primary dark:bg-brand-primary/25 dark:text-brand-darkText"
      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:text-brand-darkText/80 dark:hover:bg-earth-darkBg/60 dark:hover:text-brand-darkText",
  ].join(" ");
}

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface dark:bg-earth-darkBg dark:text-brand-darkText">
      <header className="sticky top-0 z-30 border-b border-outline/20 bg-surface/80 backdrop-blur dark:border-brand-muted/35 dark:bg-earth-darkBg/80">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <p className="font-headline text-xl font-extrabold tracking-tight text-primary dark:text-brand-sand">Social Geni</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Admin Console</p>
          </div>

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
      </header>

      <main className="mx-auto w-full max-w-7xl px-2 pb-10 pt-4 sm:px-4 sm:pt-6">
        <Outlet />
      </main>
    </div>
  );
}

