import type { SubmissionSnapshot } from "./constants.js";
import { isHighBudget } from "./industry.js";
import { PACKAGE_HOOKS_PER_IDEA } from "./packageConstants.js";
import type { ContentIdeasPackage } from "./packageValidate.js";

/** Deterministic chained package for DEMO_MODE when `include_content_package` is on. */
export function buildDemoContentIdeasPackage(ideaCount: number): ContentIdeasPackage {
  const ideas = Array.from({ length: ideaCount }, (_, i) => {
    const id = i + 1;
    return {
      id,
      title: `(Demo) Idea ${id}`,
      description: `Demo short-form concept ${id} aligned to the brief.`,
    };
  });
  const hooks = ideas.flatMap((idea) =>
    Array.from({ length: PACKAGE_HOOKS_PER_IDEA }, (_, j) => ({
      idea_id: idea.id,
      variant_index: j + 1,
      hook_text: `Demo hook variant ${j + 1} for idea ${idea.id}.`,
    }))
  );
  const templates = ideas.map((idea) => ({
    idea_id: idea.id,
    template_format: `Demo reusable template outline for idea ${idea.id} (carousel / reel beats).`,
  }));
  return { ideas, hooks, templates };
}

/** Minimal valid kit for DEMO_MODE — counts match snapshot. */
export function buildDemoKitContent(data: SubmissionSnapshot): Record<string, unknown> {
  const mkPost = (i: number) => ({
    platform: data.platforms || "Instagram",
    format: "Reel caption",
    goal: data.main_goal || "engagement",
    caption: `(Demo) Hook أول سطر قوي للبوست ${i} لبراند ${data.brand_name}. نص قصير جاهز للتجربة.`,
    hashtags: ["#demo", "#brand"],
    cta: "تواصل معنا الآن",
  });

  const mkImage = (i: number) => ({
    platform_format: "Instagram 1:1",
    design_type: "Hero",
    goal: data.main_goal || "awareness",
    visual_scene: `Demo scene ${i}`,
    headline_text_overlay: data.brand_name,
    supporting_copy: "Demo supporting copy",
    full_ai_image_prompt: `9:16 or 1:1, detailed demo prompt ${i} for ${data.brand_name}, soft light, brand colors: ${data.brand_colors}`,
    text_policy: "Arabic primary for overlays unless brand is international English-first.",
    conversion_trigger: "Demo CTA visual",
  });

  const mkVideo = (i: number) => ({
    platform: "TikTok",
    duration: "15s",
    style: "UGC",
    hook_type: "Question",
    scenes: [
      { time: "0-3s", label: "Hook", visual: "Face to camera", text: "سؤال سريع", audio: "Trending beat" },
    ],
    ai_tool_instructions: `Shot plan demo ${i}: jump cuts, captions burned-in, ${data.brand_name} logo end card.`,
    why_this_converts: "Demo reason",
  });

  const posts = Array.from({ length: data.num_posts }, (_, i) => mkPost(i + 1));
  const image_designs = Array.from({ length: data.num_image_designs }, (_, i) => mkImage(i + 1));
  const video_prompts = Array.from({ length: data.num_video_prompts }, (_, i) => mkVideo(i + 1));

  const base: Record<string, unknown> = {
    posts,
    image_designs,
    video_prompts,
    marketing_strategy: {
      content_mix_plan: "Demo mix",
      weekly_posting_plan: "Demo weekly",
      platform_strategy: "Demo platforms",
      key_messaging_angles: ["Demo angle"],
      brand_positioning_statement: "Demo positioning",
    },
    sales_system: {
      pain_points: ["Demo pain"],
      offer_structuring: "Demo offer structure",
      funnel_plan: "Demo funnel",
      ad_angles: ["Demo ad angle"],
      objection_handling: [{ objection: "Demo?", response: "Demo response." }],
      cta_strategy: "Demo CTA strategy",
    },
    offer_optimization: {
      rewritten_offer: "Demo rewritten offer",
      urgency_or_scarcity: "Demo urgency",
      alternative_offers: ["Alt A"],
    },
  };

  if (isHighBudget(data.budget_level)) {
    base.kpi_tracking = {
      top_kpis: ["CTR", "CPL"],
      benchmarks: "Demo benchmarks",
      optimization_actions: "Demo actions",
      ab_tests_week1: ["Test A vs B"],
    };
  }

  return base;
}
