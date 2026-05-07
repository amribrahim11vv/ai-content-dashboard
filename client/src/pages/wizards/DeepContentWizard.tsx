import {
  deepBriefSchema,
  deepBriefSchemaAgency,
  deepBriefSchemaWithDiagnosis,
  deepBriefSchemaWithDiagnosisAgency,
} from "../../briefSchema";
import WizardCore from "./WizardCore";
import { isWizardVariantB } from "../../lib/wizardExperiment";
import { isAgencyEdition } from "../../lib/appEdition";

export default function DeepContentWizard() {
  const variantB = isWizardVariantB();
  const agencyEdition = isAgencyEdition();
  const formSchema = variantB
    ? agencyEdition
      ? deepBriefSchemaWithDiagnosisAgency
      : deepBriefSchemaWithDiagnosis
    : agencyEdition
      ? deepBriefSchemaAgency
      : deepBriefSchema;
  return (
    <WizardCore
      formSchema={formSchema}
      draftKey="ai-content-dashboard:wizard-draft:deep:v1"
      title="إعداد حملة المحتوى العميق"
      subtitle="Built for depth-first execution: robust narrative structure, richer creative briefs, and production-ready details."
      routeHint="/kits/:id"
      stepOrder={variantB ? ["diagnosis", "brand", "audience", "creative", "volume"] : ["brand", "audience", "creative", "volume"]}
      stepTitles={{
        diagnosis: "تشخيص سريع",
        brand: "البراند والمجال",
        audience: "الجمهور والأهداف",
        creative: "الاتجاه الإبداعي (Creative Direction)",
        volume: "كمية المحتوى",
        offer: "العرض والتموضع (Positioning)",
        channels: "القنوات ونبرة الصوت",
      }}
      stepFields={{
        audience: ["target_audience", "main_goal"],
        creative: ["visual_notes", "product_details", "reference_image", "best_content_types", "campaign_duration"],
      }}
      defaults={{
        campaign_mode: "deep",
        main_goal: "بناء ثقة ومصداقية (Authority) بمحتوى عميق",
        best_content_types: ["testimonials", "educational", "product_demo"],
      }}
    />
  );
}
