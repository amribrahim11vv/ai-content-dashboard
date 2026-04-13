import { offerBriefSchema } from "../../briefSchema";
import WizardCore from "./WizardCore";

export default function OfferProductWizard() {
  return (
    <WizardCore
      formSchema={offerBriefSchema}
      draftKey="ai-content-dashboard:wizard-draft:offer:v1"
      title="Offer & Product Wizard"
      subtitle="Designed for commercial clarity: offer framing, competitive position, and conversion intent."
      routeHint="/kits/:id"
      stepOrder={["brand", "offer", "audience", "volume"]}
      stepTitles={{
        brand: "Brand & industry",
        offer: "Offer & positioning",
        audience: "Buyer persona",
        volume: "Output volumes",
        channels: "Channels & voice",
        creative: "Creative packaging",
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

