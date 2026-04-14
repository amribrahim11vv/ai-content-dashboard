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
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm transition-all duration-300 ${
        props.open ? "visible opacity-100" : "invisible opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-md transform rounded-2xl border border-outline/30 bg-surface p-6 shadow-2xl transition-all duration-300 dark:border-muted/40 dark:bg-earth-darkCard ${
          props.open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
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
