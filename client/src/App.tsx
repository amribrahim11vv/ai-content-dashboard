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
import ProfilePage from "./pages/ProfilePage";
import BrandVoicePage from "./pages/BrandVoicePage";
import HelpPage from "./pages/HelpPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ExtrasPage from "./pages/ExtrasPage";
import { useAuth } from "./auth/AuthContext";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

export default function App() {
  const { entitlements } = useAuth();
  const plan = entitlements?.plan_code ?? "starter";
  const modeLocked = plan === "starter";
  const LockedMode = ({ mode }: { mode: "offer" | "deep" }) => (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-8 shadow-sm text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
           <span className="material-symbols-outlined text-gray-900 dark:text-white text-2xl">lock</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
          {mode === "offer" ? "Offer Engine" : "Deep Content"} Locked
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
          This advanced capability is exclusively available on the Early Adopter plan. Upgrade your studio to unlock it immediately.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link
            to="/pricing"
            className="inline-flex w-full justify-center items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Upgrade Plan
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Current Plan: {plan}
          </p>
        </div>
      </div>
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
                  className="mb-4 rounded-xl border border-amber-400/30 bg-amber-50 px-4 py-3 text-sm text-amber-800"
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
        <Route path="/help" element={<HelpPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/extras" element={<ExtrasPage />} />
        <Route path="/brand-voice" element={<BrandVoicePage />} />
        <Route path="/profile" element={<ProfilePage />} />
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
