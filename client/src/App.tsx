import { Routes, Route, Navigate } from "react-router-dom";
import ContentWizard from "./ContentWizard";
import KitDetail from "./KitDetail";
import Dashboard from "./Dashboard";
import GeneratedKitsPage from "./GeneratedKitsPage";
import AppLayout from "./layout/AppLayout";
import PromptCatalogPage from "./pages/PromptCatalogPage";
import SocialCampaignWizard from "./pages/wizards/SocialCampaignWizard";
import OfferProductWizard from "./pages/wizards/OfferProductWizard";
import DeepContentWizard from "./pages/wizards/DeepContentWizard";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

export default function App() {
  return (
    <AppLayout
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
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/generated-kits" element={<GeneratedKitsPage />} />
        <Route path="/wizard" element={<ContentWizard />} />
        <Route path="/wizard/social" element={<SocialCampaignWizard />} />
        <Route path="/wizard/offer" element={<OfferProductWizard />} />
        <Route path="/wizard/deep" element={<DeepContentWizard />} />
        <Route path="/kits/:id" element={<KitDetail />} />
        <Route path="/help" element={<Navigate to="/wizard" replace />} />
        <Route path="/integrations" element={<Navigate to="/wizard" replace />} />
        <Route path="/analytics" element={<Navigate to="/wizard" replace />} />
        <Route path="/extras" element={<Navigate to="/wizard" replace />} />
        <Route path="/brand-voice" element={<Navigate to="/wizard" replace />} />
        <Route path="/prompt-catalog" element={<PromptCatalogPage />} />
        <Route path="/profile" element={<Navigate to="/wizard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
