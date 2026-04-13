import { offerBriefSchema, offerBriefSchemaWithDiagnosis } from "../../briefSchema";
import WizardCore from "./WizardCore";
import { isWizardVariantB } from "../../lib/wizardExperiment";

export default function OfferProductWizard() {
  const variantB = isWizardVariantB();
  return (
    <WizardCore
      formSchema={variantB ? offerBriefSchemaWithDiagnosis : offerBriefSchema}
      draftKey="ai-content-dashboard:wizard-draft:offer:v1"
      title="Offer Campaign Wizard"
      subtitle="Designed for commercial execution: focused offer framing, clear buyer intent, and stronger conversion outcomes."
      routeHint="/kits/:id"
      stepOrder={variantB ? ["diagnosis", "brand", "offer", "audience", "volume"] : ["brand", "offer", "audience", "volume"]}
      stepTitles={{
        diagnosis: "Quick diagnosis",
        brand: "Brand & industry",
        offer: "Offer & positioning",
        audience: "Audience & goals",
        volume: "Output volumes",
        channels: "Channels & tone",
        creative: "Creative direction",
      }}
      stepFields={{
        offer: ["offer", "competitors"],
        audience: ["target_audience", "main_goal"],
        creative: ["visual_notes", "reference_image", "best_content_types"],
      }}
      defaults={{
        campaign_mode: "offer",
        main_goal: "Increase qualified leads and purchases",
        offer: "Highlight value proposition, guarantee, and CTA",
      }}
    />
  );
}

