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

      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/10 to-tertiary/10 p-5 shadow-sm dark:border-primary/40 dark:from-primary/20 dark:via-primary/10 dark:to-surface-container-high">
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-tertiary/20 blur-2xl" />
        <div className="relative">
          <p className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            <span className="material-symbols-outlined text-sm">bolt</span>
            Instant Free Trial
          </p>
          <h2 className="mt-3 font-headline text-xl font-black tracking-tight text-on-surface sm:text-2xl">
            Try now for free — no payment, no login required
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Start immediately with the Starter plan using your device. When you are ready to scale, upgrade to Early Adopter with instant manual activation.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-outline/30 bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
              100% free start
            </span>
            <span className="rounded-full border border-outline/30 bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
              No card required
            </span>
            <span className="rounded-full border border-outline/30 bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
              No login required
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {planCards.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const ctaLabel =
            plan.id === "starter"
              ? "Start Free"
              : isCurrent
                ? "Current Plan"
                : "Upgrade to Early Adopter";
          const isDisabled = plan.id === "starter" || isCurrent || !buildUpgradeUrl(plan.id);
          return (
            <article
              key={plan.id}
              className={[
                "flex h-full flex-col rounded-3xl border p-6 sm:p-8 transition-all hover:-translate-y-1 hover:shadow-xl",
                plan.highlight
                  ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/15"
                  : "border-outline/25 bg-surface-container-low hover:border-outline/40",
              ].join(" ")}
            >
              {plan.highlight ? (
                <p className="mb-4 inline-flex self-start rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                  Recommended
                </p>
              ) : null}
              <h2 className="font-headline text-2xl font-bold text-on-surface">{plan.title}</h2>
              <p className="mt-2 text-on-surface-variant">{plan.subtitle}</p>
              <p className="mt-6 text-4xl font-black text-on-surface">
                {plan.price}
                <span className="text-sm font-semibold text-on-surface-variant"> launch</span>
              </p>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <FeatureItem key={f}>{f}</FeatureItem>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onUpgradeClick(plan.id)}
                disabled={isDisabled}
                className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-base font-bold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {ctaLabel}
              </button>
              {!buildUpgradeUrl(plan.id) && plan.id !== "starter" ? (
                <p className="mt-3 text-center text-xs text-error">
                  Upgrade link is not configured. Set `VITE_UPGRADE_WHATSAPP_URL` or `VITE_UPGRADE_WHATSAPP_PHONE`.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-outline/20 bg-surface-container-low p-4 text-sm text-on-surface-variant">
        Payment is currently handled directly via WhatsApp (Vodafone Cash / InstaPay), then your plan is activated immediately from admin panel.
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
