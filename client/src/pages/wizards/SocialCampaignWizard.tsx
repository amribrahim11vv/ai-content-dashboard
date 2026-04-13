import { socialBriefSchema } from "../../briefSchema";
import WizardCore from "./WizardCore";

export default function SocialCampaignWizard() {
  return (
    <WizardCore
      formSchema={socialBriefSchema}
      draftKey="ai-content-dashboard:wizard-draft:social:v1"
      title="Social Campaign Wizard"
      subtitle="Built for social-first campaigns: audience, channels, tone, and posting output."
      routeHint="/kits/:id"
      stepOrder={["brand", "audience", "channels", "creative", "volume"]}
      stepTitles={{
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
        platforms: "instagram, tiktok, facebook",
      }}
    />
  );
}

