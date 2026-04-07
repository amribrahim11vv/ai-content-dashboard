const REQUIRED_VARIABLES = [
  "brand_name",
  "industry",
  "target_audience",
  "main_goal",
  "platforms",
  "brand_tone",
  "offer",
  "num_posts",
  "num_image_designs",
  "num_video_prompts",
] as const;

export type PromptTemplateValidation = {
  ok: boolean;
  missingVariables: string[];
  foundVariables: string[];
  mode: "creative_only" | "template_placeholders";
};

export function extractPromptVariables(template: string): string[] {
  const input = String(template ?? "");
  const out = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null = regex.exec(input);
  while (match) {
    const key = String(match[1] ?? "").trim();
    if (key) out.add(key);
    match = regex.exec(input);
  }
  return [...out];
}

/** `{{industry}}` or `{{farming_niche}}` satisfies the industry slot (same brief field). */
function hasIndustryPlaceholder(foundSet: Set<string>): boolean {
  return foundSet.has("industry") || foundSet.has("farming_niche");
}

export function validatePromptTemplateContract(template: string): PromptTemplateValidation {
  const foundVariables = extractPromptVariables(template);
  if (foundVariables.length === 0) {
    return {
      ok: true,
      missingVariables: [],
      foundVariables: [],
      mode: "creative_only",
    };
  }
  const foundSet = new Set(foundVariables);
  const missingVariables = REQUIRED_VARIABLES.filter((v) => {
    if (v === "industry") return !hasIndustryPlaceholder(foundSet);
    return !foundSet.has(v);
  });
  return {
    ok: missingVariables.length === 0,
    missingVariables,
    foundVariables,
    mode: "template_placeholders",
  };
}

export function requiredPromptVariables(): readonly string[] {
  return REQUIRED_VARIABLES;
}
