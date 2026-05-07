import {
  offerBriefSchema,
  offerBriefSchemaAgency,
  offerBriefSchemaWithDiagnosis,
  offerBriefSchemaWithDiagnosisAgency,
} from "../../briefSchema";
import WizardCore from "./WizardCore";
import { isWizardVariantB } from "../../lib/wizardExperiment";
import { isAgencyEdition } from "../../lib/appEdition";

export default function OfferProductWizard() {
  const variantB = isWizardVariantB();
  const agencyEdition = isAgencyEdition();
  const formSchema = variantB
    ? agencyEdition
      ? offerBriefSchemaWithDiagnosisAgency
      : offerBriefSchemaWithDiagnosis
    : agencyEdition
      ? offerBriefSchemaAgency
      : offerBriefSchema;
  return (
    <WizardCore
      formSchema={formSchema}
      draftKey="ai-content-dashboard:wizard-draft:offer:v1"
      title="إعداد حملة العروض والمنتجات"
      subtitle="Built for commercial success: focused offer framing, clear buyer intent, and higher conversion rates."
      routeHint="/kits/:id"
      stepOrder={variantB ? ["diagnosis", "brand", "offer", "audience", "volume"] : ["brand", "offer", "audience", "volume"]}
      stepTitles={{
        diagnosis: "تشخيص سريع",
        brand: "البراند والمجال",
        offer: "العرض والمنافسين",
        audience: "الجمهور والأهداف",
        volume: "كمية المحتوى",
        channels: "القنوات ونبرة الصوت",
        creative: "الاتجاه الإبداعي (Creative Direction)",
      }}
      stepFields={{
        offer: ["offer", "competitors", "product_details"],
        audience: ["target_audience", "main_goal"],
        creative: ["visual_notes", "reference_image", "best_content_types"],
      }}
      defaults={{
        campaign_mode: "offer",
        main_goal: "زيادة المبيعات (Sales)",
        offer: "إبراز قيمة العرض، الضمان، والـ CTA",
      }}
    />
  );
}
