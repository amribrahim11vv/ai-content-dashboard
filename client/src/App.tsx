import { Routes, Route, Navigate, Link } from "react-router-dom";
import KitDetail from "./KitDetail";
import Dashboard from "./Dashboard";
import GeneratedKitsPage from "./GeneratedKitsPage";
import WizardAnalyticsPage from "./pages/WizardAnalyticsPage";
import AdminPlansPage from "./pages/AdminPlansPage";
import SocialCampaignWizard from "./pages/wizards/SocialCampaignWizard";
import OfferProductWizard from "./pages/wizards/OfferProductWizard";
import DeepContentWizard from "./pages/wizards/DeepContentWizard";
import PricingPage from "./pages/PricingPage";
import UserLayout from "./layout/UserLayout";
import AdminLayout from "./layout/AdminLayout";
import { useAuth } from "./auth/AuthContext";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

export default function App() {
  const { entitlements } = useAuth();
  const plan = entitlements?.plan_code ?? "free";
  const modeLocked = plan === "free";
  const LockedMode = ({ mode }: { mode: "offer" | "deep" }) => (
    <div className="rounded-2xl border border-outline/25 bg-surface-container-low p-6 text-on-surface">
      <h2 className="font-headline text-xl font-bold">🔒 {mode === "offer" ? "Offer" : "Deep"} mode is locked</h2>
      <p className="mt-2 text-on-surface-variant">
        This mode is available in Creator Pro and Agency plans. Upgrade your account to unlock it.
      </p>
      <p className="mt-3 text-xs text-on-surface-variant">Current plan: {plan}</p>
      <Link
        to="/pricing"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:opacity-90"
      >
        <span className="material-symbols-outlined text-base">rocket_launch</span>
        Upgrade plan
      </Link>
    </div>
  );
  return (
    <Routes>
      <Route
        element={
          <UserLayout
            demoBanner={
              demoMode ? (
                <div
                  className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
                  role="status"
                >
                  Demo mode — the real Gemini path is not invoked
                </div>
              ) : undefined
            }
          />
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/generated-kits" element={<GeneratedKitsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/wizard" element={<Navigate to="/wizard/social" replace />} />
        <Route path="/wizard/social" element={<SocialCampaignWizard />} />
        <Route path="/wizard/offer" element={modeLocked ? <LockedMode mode="offer" /> : <OfferProductWizard />} />
        <Route path="/wizard/deep" element={modeLocked ? <LockedMode mode="deep" /> : <DeepContentWizard />} />
        <Route path="/kits/:id" element={<KitDetail />} />
        <Route path="/help" element={<Navigate to="/wizard" replace />} />
        <Route path="/integrations" element={<Navigate to="/wizard" replace />} />
        <Route path="/extras" element={<Navigate to="/wizard" replace />} />
        <Route path="/brand-voice" element={<Navigate to="/wizard" replace />} />
        <Route path="/profile" element={<Navigate to="/wizard" replace />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/analytics" replace />} />
        <Route path="analytics" element={<WizardAnalyticsPage />} />
        <Route path="plans" element={<AdminPlansPage />} />
        <Route path="generated-kits" element={<GeneratedKitsPage adminMode />} />
        <Route path="kits/:id" element={<KitDetail showTechnical />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      {/* Legacy admin routes kept as temporary redirects */}
      <Route path="/prompt-catalog" element={<Navigate to="/admin/analytics" replace />} />
      <Route path="/analytics" element={<Navigate to="/admin/analytics" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
