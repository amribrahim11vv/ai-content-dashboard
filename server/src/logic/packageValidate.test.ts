import { describe, expect, it } from "vitest";
import { PACKAGE_HOOKS_PER_IDEA } from "./packageConstants.js";
import { validatePackageCoherence } from "./packageValidate.js";

const ideaCount = 5;
const ideas = Array.from({ length: ideaCount }, (_, i) => ({
  id: i + 1,
  title: `t${i}`,
  description: `d${i}`,
}));

const goodHooks = ideas.flatMap((idea) =>
  Array.from({ length: PACKAGE_HOOKS_PER_IDEA }, (_, j) => ({
    idea_id: idea.id,
    variant_index: j + 1,
    hook_text: "h",
  }))
);

const goodTemplates = ideas.map((idea) => ({
  idea_id: idea.id,
  template_format: "fmt",
}));

describe("validatePackageCoherence", () => {
  it("accepts a consistent package", () => {
    expect(validatePackageCoherence(ideas, goodHooks, goodTemplates)).toEqual([]);
  });

  it("rejects duplicate template idea_id", () => {
    const templates = [...goodTemplates];
    templates[1] = { ...templates[1]!, idea_id: 1 };
    const errs = validatePackageCoherence(ideas, goodHooks, templates);
    expect(errs.some((e) => e.includes("templates"))).toBe(true);
  });
});
