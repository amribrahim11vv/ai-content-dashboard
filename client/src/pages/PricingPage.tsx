import { useEffect, useMemo, useState } from "react";
import LoginModal from "../components/LoginModal";
import { useAuth } from "../auth/AuthContext";

type PlanId = "free" | "creator_pro" | "agency";

const WHATSAPP_BASE = "https://wa.me/";
const DEFAULT_PHONE = "";

function planToLabel(plan: PlanId) {
  if (plan === "creator_pro") return "Creator Pro";
  if (plan === "agency") return "Agency";
  return "Free Trial";
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
    <li className="flex items-start gap-2 text-sm text-on-surface-variant">
      <span className="material-symbols-outlined text-base text-primary">check_circle</span>
      <span>{children}</span>
    </li>
  );
}

export default function PricingPage() {
  const { session, signInWithGoogle, entitlements } = useAuth();
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const currentPlan = entitlements?.plan_code ?? "free";

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
        id: "free" as const,
        title: "Free Trial",
        price: "$0",
        subtitle: "Start and feel the product",
        highlight: false,
        features: [
          "2 kits / month",
          "Social campaign only",
          "No reference image upload",
          "Device-based history",
        ],
      },
      {
        id: "creator_pro" as const,
        title: "Creator Pro",
        price: "$15",
        subtitle: "Best for creators and founders",
        highlight: true,
        features: [
          "30 kits / month",
          "Social + Offer + Deep modes",
          "Reference image enabled",
          "Full account history",
        ],
      },
      {
        id: "agency" as const,
        title: "Agency",
        price: "$39",
        subtitle: "For managers and teams",
        highlight: false,
        features: [
          "150 kits / month",
          "All Creator Pro features",
          "Retry/Regenerate practically unlimited",
          "Built for heavy production workflows",
        ],
      },
    ],
    []
  );

  const onUpgradeClick = (plan: PlanId) => {
    if (plan === "free") return;
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
    <section className="space-y-8">
      <header className="rounded-2xl border border-outline/25 bg-surface-container-low p-6 dark:border-muted/40 dark:bg-earth-darkCard/70">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Pricing</p>
        <h1 className="mt-2 font-headline text-3xl font-black tracking-tight text-on-surface sm:text-4xl">
          Choose the plan that fits your growth
        </h1>
        <p className="mt-3 max-w-3xl text-on-surface-variant">
          Start free, then upgrade when you are ready. Server-side gatekeeping is already active for all plan limits.
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Current plan: <strong className="text-on-surface">{currentPlan}</strong>
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {planCards.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const ctaLabel =
            plan.id === "free"
              ? "Start Free"
              : isCurrent
                ? "Current Plan"
                : plan.id === "creator_pro"
                  ? "Upgrade to Creator Pro"
                  : "Upgrade to Agency";
          const isDisabled = plan.id === "free" || isCurrent || !buildUpgradeUrl(plan.id);
          return (
            <article
              key={plan.id}
              className={[
                "rounded-2xl border p-5",
                plan.highlight
                  ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/15"
                  : "border-outline/25 bg-surface-container-low",
              ].join(" ")}
            >
              {plan.highlight ? (
                <p className="mb-3 inline-flex rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                  Recommended
                </p>
              ) : null}
              <h2 className="font-headline text-2xl font-bold text-on-surface">{plan.title}</h2>
              <p className="mt-1 text-on-surface-variant">{plan.subtitle}</p>
              <p className="mt-4 text-3xl font-black text-on-surface">
                {plan.price}
                <span className="text-sm font-semibold text-on-surface-variant">/month</span>
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <FeatureItem key={f}>{f}</FeatureItem>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onUpgradeClick(plan.id)}
                disabled={isDisabled}
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {ctaLabel}
              </button>
              {!buildUpgradeUrl(plan.id) && plan.id !== "free" ? (
                <p className="mt-2 text-xs text-error">
                  Upgrade link is not configured. Set `VITE_UPGRADE_WHATSAPP_URL` or `VITE_UPGRADE_WHATSAPP_PHONE`.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-outline/20 bg-surface-container-low p-4 text-sm text-on-surface-variant">
        Activation is currently handled quickly by support on WhatsApp until direct checkout is enabled.
      </div>

      <LoginModal
        open={loginModalOpen}
        loading={loginLoading}
        onClose={() => setLoginModalOpen(false)}
        onLogin={onLogin}
        title="Login to continue upgrade"
        description="Please sign in first, then continue to WhatsApp to complete your plan upgrade."
        footer={
          pendingPlan ? (
            <span>
              Target plan: <strong className="text-on-surface">{planToLabel(pendingPlan)}</strong>
            </span>
          ) : null
        }
      />
    </section>
  );
}
