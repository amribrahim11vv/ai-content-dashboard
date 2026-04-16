import { useEffect, useMemo, useState } from "react";
import LoginModal from "../components/LoginModal";
import { useAuth } from "../auth/AuthContext";

type PlanId = "starter" | "early_adopter";

const WHATSAPP_BASE = "https://wa.me/";
const DEFAULT_PHONE = "";

function planToLabel(plan: PlanId) {
  if (plan === "early_adopter") return "Early Adopter";
  return "Starter";
}

function buildUpgradeUrl(plan: PlanId): string {
  const direct = String(import.meta.env.VITE_UPGRADE_WHATSAPP_URL ?? "").trim();
  if (direct) return direct;

  const phone = String(import.meta.env.VITE_UPGRADE_WHATSAPP_PHONE ?? DEFAULT_PHONE).trim();
  if (!phone) return "";

  const message = encodeURIComponent(
    `Hi, I want to upgrade to ${planToLabel(plan)} plan in Social Geni.`
  );
  return `${WHATSAPP_BASE}${phone}?text=${message}`;
}

function FeatureItem({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
      <span className="material-symbols-outlined text-[18px] text-gray-900 dark:text-white mt-0.5">check_circle</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

export default function PricingPage() {
  const { session, signInWithGoogle, entitlements } = useAuth();
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const currentPlan = entitlements?.plan_code ?? "starter";

  useEffect(() => {
    if (!session || !pendingPlan) return;
    const url = buildUpgradeUrl(pendingPlan);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    setLoginModalOpen(false);
    setPendingPlan(null);
  }, [session, pendingPlan]);

  const planCards = useMemo(
    () => [
      {
        id: "starter" as const,
        title: "Starter",
        price: "$0",
        subtitle: "For trial and quick evaluation",
        highlight: false,
        features: [
          "1 video prompt / month",
          "2 image prompts / month",
          "Social mode only",
          "No reference image upload",
          "Perfect for testing output quality",
        ],
      },
      {
        id: "early_adopter" as const,
        title: "Early Adopter",
        price: "$3",
        subtitle: "Symbolic paid beta for first users",
        highlight: true,
        features: [
          "2 video prompts / month",
          "10 image prompts / month",
          "All campaign modes unlocked",
          "Reference image enabled",
          "Manual instant activation via WhatsApp",
          "Early adopter discount (limited time)",
        ],
      },
    ],
    []
  );

  const onUpgradeClick = (plan: PlanId) => {
    if (plan === "starter") return;
    const url = buildUpgradeUrl(plan);
    if (!url) return;
    setPendingPlan(plan);
    if (!session) {
      setLoginModalOpen(true);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onLogin = async () => {
    setLoginLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <section className="space-y-12">
      <header className="text-center max-w-3xl mx-auto py-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Choose the plan that fits your growth
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Start free, then upgrade when you are ready. Server-side gatekeeping is active for all plan limits.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Current plan:</span>
          <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 py-1 px-3 text-xs font-semibold uppercase tracking-widest text-gray-900 dark:text-white shadow-sm">
            {currentPlan}
          </span>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-indigo-500/10 bg-white dark:bg-[#111] p-8 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-[64px]" />
        <div className="pointer-events-none absolute -bottom-16 left-16 h-48 w-48 rounded-full bg-blue-500/10 blur-[64px]" />
        
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 shadow-sm">
            <span className="material-symbols-outlined text-sm">bolt</span>
            Instant Free Trial
          </p>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Try now for free — no payment, no login required
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Start immediately with the Starter plan using your device. When you are ready to scale, upgrade to Early Adopter with instant manual activation.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-gray-600 dark:text-gray-400">
              100% Free Start
            </span>
            <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-gray-600 dark:text-gray-400">
              No Card Required
            </span>
            <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-gray-600 dark:text-gray-400">
              No Login Required
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 max-w-4xl mx-auto">
        {planCards.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isMissingUrl = !buildUpgradeUrl(plan.id) && plan.id !== "starter";
          const ctaLabel =
            plan.id === "starter"
              ? "Start Free"
              : isCurrent
                ? "Current Plan"
                : "Upgrade to Early Adopter";
          const isDisabled = plan.id === "starter" || isCurrent || isMissingUrl;
          
          return (
            <article
              key={plan.id}
              className={[
                "relative flex flex-col rounded-3xl p-8 bg-white dark:bg-[#111] shadow-xl transition-transform hover:-translate-y-1 border",
                plan.highlight
                  ? "border-gray-900/50 dark:border-white/30 ring-1 ring-inset ring-gray-900/10 dark:ring-white/10 lg:-mt-4 lg:mb-4 lg:scale-105"
                  : "border-gray-200 dark:border-white/10",
              ].join(" ")}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="rounded-full bg-gray-900 dark:bg-white px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white dark:text-black shadow-sm">
                    Recommended
                  </span>
                </div>
              )}
              
              <div className="mb-6 mt-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{plan.title}</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{plan.subtitle}</p>
              </div>

              <div className="mb-8 flex items-baseline text-gray-900 dark:text-white">
                <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">{plan.id === 'starter' ? '/month' : <span className="text-gray-400">launch</span>}</span>
              </div>

              <ul className="mb-10 space-y-4 flex-1">
                {plan.features.map((f) => (
                  <FeatureItem key={f}>{f}</FeatureItem>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onUpgradeClick(plan.id)}
                disabled={isDisabled}
                className={[
                  "w-full rounded-xl px-4 py-3.5 text-sm font-bold shadow-sm transition-all focus-visible:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-[#111]",
                  plan.highlight && !isDisabled
                    ? "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 focus:ring-gray-900 dark:focus:ring-white"
                    : isDisabled
                    ? "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-600 cursor-not-allowed border border-transparent"
                    : "bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100 dark:bg-[#111] dark:text-white dark:border-white/20 dark:hover:bg-white/5 focus:ring-gray-200 dark:focus:ring-white/20"
                ].join(" ")}
              >
                {ctaLabel}
              </button>
              
              {isMissingUrl && (
                <div className="mt-3 text-center">
                  <p className="text-xs text-red-500 dark:text-red-400 opacity-90 font-medium">
                    Upgrade link is not configured. Set `VITE_UPGRADE_WHATSAPP_URL`.
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="max-w-2xl mx-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-[#111] px-5 py-4 text-center text-sm text-gray-600 dark:text-gray-400 shadow-sm backdrop-blur-sm">
        Payment is currently handled directly via WhatsApp (Vodafone Cash / InstaPay), then your plan is activated immediately from admin panel.
      </div>

      <LoginModal
        open={loginModalOpen}
        loading={loginLoading}
        onClose={() => setLoginModalOpen(false)}
        onLogin={onLogin}
        title="Sign in to upgrade"
        description="Securely link your account before proceeding to checkout."
        footer={
          pendingPlan ? (
            <span className="font-medium">
              Target plan: <strong className="text-gray-900 dark:text-white ml-1">{planToLabel(pendingPlan)}</strong>
            </span>
          ) : null
        }
      />
    </section>
  );
}
