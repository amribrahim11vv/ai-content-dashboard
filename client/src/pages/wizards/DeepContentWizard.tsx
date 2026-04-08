import { deepBriefSchema } from "../../briefSchema";
import WizardCore from "./WizardCore";

export default function DeepContentWizard() {
  return (
    <WizardCore
      formSchema={deepBriefSchema}
      draftKey="ai-content-dashboard:wizard-draft:deep:v1"
      title="Deep Content Wizard"
      subtitle="For long-form and depth-driven output: strong creative brief, content structure, and production detail."
      routeHint="/kits/:id"
      stepOrder={["brand", "audience", "creative", "volume"]}
      stepTitles={{
        brand: "Brand & industry",
        audience: "Audience intent",
        creative: "Creative framework",
        volume: "Output volumes",
        offer: "Offer narrative",
        channels: "Distribution channels",
      }}
      stepFields={{
        audience: ["target_audience", "main_goal"],
        creative: ["visual_notes", "reference_image", "best_content_types", "campaign_duration"],
      }}
      defaults={{
        campaign_mode: "deep",
        main_goal: "Build authority with high-depth content",
        best_content_types: "case study, educational carousel, deep explainer video",
      }}
    />
  );
}

