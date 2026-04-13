import { deepBriefSchema, deepBriefSchemaWithDiagnosis } from "../../briefSchema";
import WizardCore from "./WizardCore";
import { isWizardVariantB } from "../../lib/wizardExperiment";

export default function DeepContentWizard() {
  const variantB = isWizardVariantB();
  return (
    <WizardCore
      formSchema={variantB ? deepBriefSchemaWithDiagnosis : deepBriefSchema}
      draftKey="ai-content-dashboard:wizard-draft:deep:v1"
      title="Deep Campaign Wizard"
      subtitle="Designed for depth-first execution: stronger narrative structure, richer creative briefs, and production-ready detail."
      routeHint="/kits/:id"
      stepOrder={variantB ? ["diagnosis", "brand", "audience", "creative", "volume"] : ["brand", "audience", "creative", "volume"]}
      stepTitles={{
        diagnosis: "Quick diagnosis",
        brand: "Brand & industry",
        audience: "Audience & goals",
        creative: "Creative direction",
        volume: "Output volumes",
        offer: "Offer & positioning",
        channels: "Channels & tone",
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

