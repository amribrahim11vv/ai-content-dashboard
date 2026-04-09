import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../connection.js";
import { industries, industryPrompts } from "../schema.js";

export async function seedPromptCatalog() {
  const now = new Date();
  const industrySeeds = [
    { slug: "ecommerce", name: "E-commerce" },
    { slug: "real-estate", name: "Real Estate" },
    { slug: "restaurants", name: "Restaurants" },
    { slug: "clinics", name: "Clinics" },
    { slug: "education", name: "Education" },
  ];

  for (const item of industrySeeds) {
    await db
      .insert(industries)
      .values({
        id: nanoid(),
        slug: item.slug,
        name: item.name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: industries.slug });
  }

  const activeFallback = await db
    .select({ id: industryPrompts.id })
    .from(industryPrompts)
    .where(and(isNull(industryPrompts.industryId), eq(industryPrompts.status, "active")))
    .limit(1);

  if (activeFallback.length > 0) return;

  const fallbackTemplate = [
    "You are a world-class AI Creative Director and Growth Strategist.",
    "Return ONLY valid JSON, no markdown, no code fences, no extra text.",
    "Brand Name: {{brand_name}}",
    "Industry: {{industry}}",
    "Target Audience: {{target_audience}}",
    "Main Goal: {{main_goal}}",
    "Platforms: {{platforms}}",
    "Brand Tone: {{brand_tone}}",
    "Brand Colors: {{brand_colors}}",
    "Offer: {{offer}}",
    "Competitors: {{competitors}}",
    "Visual Notes: {{visual_notes}}",
    "Campaign Duration: {{campaign_duration}}",
    "Budget Level: {{budget_level}}",
    "Best Content Types: {{best_content_types}}",
    "Counts: posts={{num_posts}}, images={{num_image_designs}}, videos={{num_video_prompts}}",
    "Now output valid JSON only.",
  ].join("\n");

  await db.insert(industryPrompts).values({
    id: nanoid(),
    industryId: null,
    version: 1,
    status: "active",
    promptTemplate: fallbackTemplate,
    notes: "Global fallback prompt",
    createdAt: now,
    updatedAt: now,
  });
}
