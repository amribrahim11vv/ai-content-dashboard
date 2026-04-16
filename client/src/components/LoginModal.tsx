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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-black/60 px-4 backdrop-blur-md transition-all duration-300 ${
        props.open ? "visible opacity-100" : "invisible opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-sm rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-8 shadow-2xl transition-all duration-300 ${
          props.open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
            <span className="material-symbols-outlined text-gray-900 dark:text-white text-3xl">login</span>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {props.title ?? "Welcome back"}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {props.description ?? "Please sign in to continue accessing SocialGeni's tools."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void props.onLogin()}
          disabled={props.loading}
          className="mt-2 inline-flex w-full justify-center items-center gap-3 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 px-4 py-3.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-2 dark:focus:ring-offset-black"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
          {props.loading ? "Connecting..." : "Continue with Google"}
        </button>
        
        <button
          type="button"
          onClick={props.onClose}
          className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Cancel
        </button>

        {props.footer ? <div className="mt-6 border-t border-gray-100 dark:border-white/10 pt-4 text-center text-xs text-gray-500 dark:text-gray-400">{props.footer}</div> : null}
      </div>
    </div>
  );
}
