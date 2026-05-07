import {
  socialBriefSchema,
  socialBriefSchemaAgency,
  socialBriefSchemaWithDiagnosis,
  socialBriefSchemaWithDiagnosisAgency,
} from "../../briefSchema";
import WizardCore from "./WizardCore";
import { isWizardVariantB } from "../../lib/wizardExperiment";
import { isAgencyEdition } from "../../lib/appEdition";

export default function SocialCampaignWizard() {
  const variantB = isWizardVariantB();
  const agencyEdition = isAgencyEdition();
  const formSchema = variantB
    ? agencyEdition
      ? socialBriefSchemaWithDiagnosisAgency
      : socialBriefSchemaWithDiagnosis
    : agencyEdition
      ? socialBriefSchemaAgency
      : socialBriefSchema;
  return (
    <WizardCore
      formSchema={formSchema}
      draftKey="ai-content-dashboard:wizard-draft:social:v1"
      title="إعداد حملة السوشيال ميديا"
      subtitle="Designed for a social-first approach: pinpoint audience intent, an optimal channel mix, and high-impact posts."
      routeHint="/kits/:id"
      stepOrder={variantB ? ["diagnosis", "brand", "audience", "channels", "creative", "volume"] : ["brand", "audience", "channels", "creative", "volume"]}
      stepTitles={{
        diagnosis: "تشخيص سريع",
        brand: "البراند والمجال",
        audience: "الجمهور والأهداف",
        channels: "القنوات ونبرة الصوت",
        creative: "الاتجاه الإبداعي (Creative Direction)",
        volume: "كمية المحتوى",
        offer: "العرض والمنافسين",
      }}
      stepFields={{
        audience: ["target_audience", "main_goal"],
        channels: ["platforms", "brand_tone"],
        creative: ["visual_notes", "product_details", "reference_image", "best_content_types"],
      }}
      defaults={{
        campaign_mode: "social",
        main_goal: "زيادة التفاعل (Engagement)",
        platforms: ["instagram", "tiktok", "facebook"],
      }}
    />
  );
}
