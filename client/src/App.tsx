import type { ReactElement } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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
import OrderReceivedPage from "./pages/OrderReceivedPage";
import MyBrandsPage from "./pages/MyBrandsPage";
import ClientOverview from "./pages/ClientOverview";
import { useAuth } from "./auth/AuthContext";
import { getV2CanonicalUrl, isAgencyEdition, isV1PublicDecommissionEnabled } from "./lib/appEdition";
import AdminLoginPage from "./pages/AdminLoginPage";
import { validateAgencyAdminSession } from "./api";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

function RequireAgencyAdmin({ children }: { children: ReactElement }) {
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "ok" | "blocked">("checking");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const valid = await validateAgencyAdminSession();
        if (!cancelled) setStatus(valid ? "ok" : "blocked");
      } catch {
        if (!cancelled) setStatus("blocked");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (status === "checking") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Checking admin session...
      </div>
    );
  }
  if (status === "blocked") {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  return children;
}

function RequireLegacySelfServeAdmin({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { ready, session, entitlements } = useAuth();

  if (!ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Checking admin access...
      </div>
    );
  }

  if (!session || entitlements?.plan_code !== "admin_unlimited") {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}

function V1PublicRedirect() {
  const target = getV2CanonicalUrl();
  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-lg rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">This experience moved to V2</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Redirecting you to the new official flow. If you are an internal admin, use the legacy backdoor.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <a
            href={target}
            className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            Open V2
          </a>
          <Link
            to="/admin/legacy-v1"
            className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-white/10 dark:text-gray-200"
          >
            Internal Legacy
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { entitlements } = useAuth();
  const agencyEdition = isAgencyEdition();
  const v1PublicDecommission = isV1PublicDecommissionEnabled();
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
        <Route path="/" element={agencyEdition ? <ClientOverview /> : v1PublicDecommission ? <V1PublicRedirect /> : <Dashboard />} />
        <Route path="/my-brands" element={<MyBrandsPage />} />
        <Route path="/generated-kits" element={agencyEdition ? <Navigate to="/" replace /> : v1PublicDecommission ? <V1PublicRedirect /> : <GeneratedKitsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/wizard" element={v1PublicDecommission && !agencyEdition ? <V1PublicRedirect /> : <Navigate to="/wizard/social" replace />} />
        <Route path="/wizard/social" element={v1PublicDecommission && !agencyEdition ? <V1PublicRedirect /> : <SocialCampaignWizard />} />
        <Route path="/wizard/offer" element={v1PublicDecommission && !agencyEdition ? <V1PublicRedirect /> : modeLocked ? <LockedMode mode="offer" /> : <OfferProductWizard />} />
        <Route path="/wizard/deep" element={v1PublicDecommission && !agencyEdition ? <V1PublicRedirect /> : modeLocked ? <LockedMode mode="deep" /> : <DeepContentWizard />} />
        <Route path="/kits/:id" element={agencyEdition ? <Navigate to="/order-received" replace /> : v1PublicDecommission ? <V1PublicRedirect /> : <KitDetail />} />
        <Route path="/order-received" element={<OrderReceivedPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/brand-voice" element={<BrandVoicePage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="/admin/login" element={agencyEdition ? <AdminLoginPage /> : <Navigate to="/" replace />} />
      <Route
        path="/admin/legacy-v1"
        element={
          agencyEdition ? (
            <Navigate to="/admin" replace />
          ) : (
            <RequireLegacySelfServeAdmin>
              <AdminLayout />
            </RequireLegacySelfServeAdmin>
          )
        }
      >
        <Route index element={<Navigate to="/admin/legacy-v1/wizard/social" replace />} />
        <Route path="wizard/social" element={<SocialCampaignWizard />} />
        <Route path="wizard/offer" element={modeLocked ? <LockedMode mode="offer" /> : <OfferProductWizard />} />
        <Route path="wizard/deep" element={modeLocked ? <LockedMode mode="deep" /> : <DeepContentWizard />} />
        <Route path="generated-kits" element={<GeneratedKitsPage />} />
        <Route path="kits/:id" element={<KitDetail />} />
        <Route path="*" element={<Navigate to="/admin/legacy-v1" replace />} />
      </Route>
      <Route
        path="/admin"
        element={
          agencyEdition ? (
            <RequireAgencyAdmin>
              <AdminLayout />
            </RequireAgencyAdmin>
          ) : v1PublicDecommission ? (
            <Navigate to="/admin/legacy-v1" replace />
          ) : (
            <AdminLayout />
          )
        }
      >
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
