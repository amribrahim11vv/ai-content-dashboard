import type { ReactNode } from "react";

type AdminPageShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AdminPageShell({ eyebrow, title, description, actions, children }: AdminPageShellProps) {
  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-outline/25 bg-surface-container-low p-5 sm:p-6 dark:border-outline/30 dark:bg-surface-container-low">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            {eyebrow ? (
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</p>
            ) : null}
            <h1 className="mt-1 font-headline text-3xl font-black tracking-tight text-on-surface sm:text-4xl">
              {title}
            </h1>
            {description ? <p className="mt-2 text-sm text-on-surface-variant sm:text-base">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

type AdminNoticeProps = {
  tone?: "info" | "success" | "error";
  children: ReactNode;
};

export function AdminNotice({ tone = "info", children }: AdminNoticeProps) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "error"
        ? "border-error/35 bg-error/10 text-error"
        : "border-outline/30 bg-surface-container-low text-on-surface-variant";

  return <div className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>{children}</div>;
}

