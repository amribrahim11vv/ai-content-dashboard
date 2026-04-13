import { normalizeKey } from "./parse.js";

type IndustryRule = {
  keywords: string[];
  module: string;
};

const INDUSTRY_RULES: IndustryRule[] = [
  {
    keywords: ["restaurant", "food", "مطعم", "أكل"],
    module: `=== RESTAURANT & FOOD MODULE ===
VISUAL PSYCHOLOGY: Food triggers CRAVING. Hero is always the dish.
Appetite colors: warm reds, oranges, golden yellows, rich browns.
KEY ELEMENTS: Steam / dripping / golden crispy texture / hands / rustic surfaces.
VIDEO: First bite reaction, chef hands prep, dish assembly time-lapse.
CONTENT MIX: 3x appetite-trigger | 2x offer/deal | 2x occasion (Ramadan/Eid/Friday) | 2x social proof | 1x brand story
=== END MODULE ===`,
  },
  {
    keywords: ["real estate", "property", "عقار"],
    module: `=== REAL ESTATE MODULE ===
VISUAL PSYCHOLOGY: Sell LIFESTYLE not walls. "Can I picture myself here?"
KEY ELEMENTS: Golden hour exterior / wide interiors / lifestyle staging / drone views.
VIDEO: Drone fly-through, virtual walkthrough, ROI split-screen, client testimonial.
FUNNEL MIX: 2x dream | 2x features | 2x trust | 2x urgency | 2x investment ROI
=== END MODULE ===`,
  },
  {
    keywords: ["fashion", "clothing", "فاشون", "ملابس"],
    module: `=== FASHION & CLOTHING MODULE ===
VISUAL PSYCHOLOGY: Sell IDENTITY — "This is who you become."
TIERS: Luxury=minimalism | Bold=urban | Friendly=modest earthy | Fun=colorful movement.
KEY ELEMENTS: Fabric texture / movement shots / flat lays / styling breakdowns.
VIDEO: Get ready with me, slow-motion fabric, "style it 3 ways".
CONTENT MIX: 3x product showcase | 2x lifestyle | 2x styling | 2x drop/launch | 1x social proof
=== END MODULE ===`,
  },
  {
    keywords: ["clinic", "health", "عياد", "طب"],
    module: `=== CLINIC & HEALTHCARE MODULE ===
VISUAL PSYCHOLOGY: Trigger TRUST and SAFETY — never fear.
KEY ELEMENTS: Smiling doctor / clean clinic / satisfied patient / simple infographics.
VIDEO: Doctor reacts to myth, before/after journey, procedure explainer, clinic tour.
CONTENT MIX: 2x doctor trust | 2x education | 2x explainer | 2x booking CTA | 2x seasonal
AVOID: Anxiety-inducing imagery / exaggerated claims / cold grey tones
=== END MODULE ===`,
  },
  {
    keywords: ["coach", "education", "training", "تدريب"],
    module: `=== COACHING & EDUCATION MODULE ===
VISUAL PSYCHOLOGY: Sell the TRANSFORMATION — not the course.
KEY ELEMENTS: Coach in action / student breakthrough / transformation quotes / results.
VIDEO: Hot take 15s, student transformation, free value drop, enrollment urgency.
CONTENT MIX: 2x authority | 2x transformation | 2x free value | 2x urgency | 2x community
=== END MODULE ===`,
  },
  {
    keywords: ["ecommerce", "product", "منتج", "متجر"],
    module: `=== E-COMMERCE & PRODUCT MODULE ===
VISUAL PSYCHOLOGY: Remove purchase friction. Product is always the hero.
KEY ELEMENTS: Product hero shots / unboxing / texture close-ups / variant colorways.
VIDEO: UGC unboxing, problem→product→result 15s, flash sale countdown.
CONTENT MIX: 3x product hero | 2x social proof | 2x offer/urgency | 2x lifestyle | 1x comparison
=== END MODULE ===`,
  },
];

const DEFAULT_INDUSTRY_MODULE = `=== GENERAL BRAND MODULE ===
Focus on brand identity, key offer, and target audience pain points.
Mix: educational, promotional, social proof, and engagement content.
=== END MODULE ===`;

export function getIndustryModule(industry: string): string {
  const i = String(industry ?? "").toLowerCase();
  const matched = INDUSTRY_RULES.find((rule) => rule.keywords.some((kw) => i.includes(kw)));
  return matched?.module ?? DEFAULT_INDUSTRY_MODULE;
}

export function getContentTypeRules(types: string): string {
  const t = normalizeKey(types);
  let r = "";

  if (t.includes("short form") || t.includes("ريل") || t.includes("تيك توك")) r += "→ Short-form: Hook in first 2s. 15–30s Reel/TikTok format.\n";
  if (t.includes("static") || t.includes("single image") || t.includes("صوره") || t.includes("صور"))
    r += "→ Static image: Thumb-stopping single frame. Strong visual hierarchy.\n";
  if (t.includes("carousel") || t.includes("كاروسيل")) r += "→ Carousel: 30%+ of designs as slide sequences. Slide 1=hook, middle=value, last=CTA.\n";
  if (t.includes("long form") || t.includes("يوتيوب") || t.includes("longform"))
    r += "→ Long-form: Full narrative arc 60–90s. Story-driven.\n";
  if (t.includes("text only") || t.includes("thread") || t.includes("نصي") || t.includes("بوستات كتابيه"))
    r += "→ Text/threads: Strong opening line. High-value information thread format.\n";

  return r || "→ Adapt to best format for the target audience.";
}

export function getGoalRules(goal: string): string {
  const g = normalizeKey(goal);
  if (g.includes("sales") || g.includes("مبيعات") || g.includes("بيع")) return "Direct CTA in 60% of outputs. Show offer/price. Create urgency.";
  if (g.includes("awareness") || g.includes("وعي")) return "Brand story focus. No hard-sell. Build curiosity and recognition.";
  if (g.includes("engagement") || g.includes("تفاعل")) return "Poll / question / 'tag a friend' formats. Relatable and shareable.";
  if (g.includes("launch") || g.includes("اطلاق")) return "Teaser → Reveal → Launch sequence across all sections.";
  return "Balance awareness, engagement, and conversion.";
}

export function parseBudgetLevel(budget: unknown): number {
  const numericMatch = String(budget ?? "").match(/\d+/);
  const parsed = numericMatch ? parseInt(numericMatch[0], 10) : NaN;
  if (Number.isNaN(parsed)) return 3;
  return Math.min(7, Math.max(1, parsed));
}

export function getBudgetRules(budget: string): string {
  const b = parseBudgetLevel(budget);
  if (b <= 2) return "Organic: Native feel, shareable, authentic. No ad-looking designs.";
  if (b <= 5) return "Mid budget: 50% organic / 50% promotional mix.";
  return "High paid: Scroll-stopping. You MAY add one optional A/B alternate for the strongest concept in each section.";
}

export function isHighBudget(budget: string): boolean {
  return parseBudgetLevel(budget) >= 6;
}
