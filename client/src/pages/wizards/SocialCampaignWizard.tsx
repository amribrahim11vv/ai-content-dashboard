import { socialBriefSchema, socialBriefSchemaWithDiagnosis } from "../../briefSchema";
import WizardCore from "./WizardCore";
import { isWizardVariantB } from "../../lib/wizardExperiment";

export default function SocialCampaignWizard() {
  const variantB = isWizardVariantB();
  return (
    <WizardCore
      formSchema={variantB ? socialBriefSchemaWithDiagnosis : socialBriefSchema}
      draftKey="ai-content-dashboard:wizard-draft:social:v1"
      title="Social Campaign Wizard"
      subtitle="Designed for social-first execution: clear audience intent, sharp channel mix, and strong posting output."
      routeHint="/kits/:id"
      stepOrder={variantB ? ["diagnosis", "brand", "audience", "channels", "creative", "volume"] : ["brand", "audience", "channels", "creative", "volume"]}
      stepTitles={{
        diagnosis: "Quick diagnosis",
        brand: "Brand & industry",
        audience: "Audience & goals",
        channels: "Channels & tone",
        creative: "Creative direction",
        volume: "Output volumes",
        offer: "Offer & competitors",
      }}
      stepFields={{
        audience: ["target_audience", "main_goal"],
        channels: ["platforms", "brand_tone"],
        creative: ["visual_notes", "reference_image", "best_content_types"],
      }}
      defaults={{
        campaign_mode: "social",
        main_goal: "Grow social reach and engagement",
        platforms: ["instagram", "tiktok", "facebook"],
      }}
    />
  );
}

