import type { ReactNode } from "react";

type LoginModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  loading?: boolean;
  onClose: () => void;
  onLogin: () => void | Promise<void>;
  footer?: ReactNode;
};

export default function LoginModal(props: LoginModalProps) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-outline/30 bg-surface p-5 shadow-2xl dark:bg-earth-darkCard dark:border-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-headline text-xl font-bold text-on-surface">
              {props.title ?? "Login to continue"}
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {props.description ?? "Please sign in first to continue with upgrade."}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => void props.onLogin()}
          disabled={props.loading}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-base">login</span>
          {props.loading ? "Opening Google..." : "Continue with Google"}
        </button>

        {props.footer ? <div className="mt-3 text-xs text-on-surface-variant">{props.footer}</div> : null}
      </div>
    </div>
  );
}
