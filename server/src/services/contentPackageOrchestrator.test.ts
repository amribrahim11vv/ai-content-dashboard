import { describe, expect, it } from "vitest";
import { buildSubmissionSnapshot } from "../logic/parse.js";
import { PACKAGE_HOOKS_PER_IDEA } from "../logic/packageConstants.js";
import { runContentPackageChain } from "./contentPackageOrchestrator.js";

const settings = { apiKey: "x", model: "m", timeoutMs: 60_000, maxRetries: 0 };

function ideasPayload(n: number) {
  return {
    ideas: Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      title: `Title ${i + 1}`,
      description: `Desc ${i + 1}`,
    })),
  };
}

function hooksPayload(ideaList: { id: number }[]) {
  const hooks = ideaList.flatMap((idea) =>
    Array.from({ length: PACKAGE_HOOKS_PER_IDEA }, (_, j) => ({
      idea_id: idea.id,
      variant_index: j + 1,
      hook_text: `h${idea.id}-${j + 1}`,
    }))
  );
  return { hooks };
}

function templatesPayload(ideaList: { id: number }[]) {
  return {
    templates: ideaList.map((idea) => ({
      idea_id: idea.id,
      template_format: `tf${idea.id}`,
    })),
  };
}

function routingMock(n: number, ideas = ideasPayload(n)) {
  return async (prompt: string) => {
    if (prompt.includes("Generate exactly") && prompt.includes("distinct short-form content ideas")) return { json: ideas };
    if (prompt.includes("You are a hook copywriter")) return { json: hooksPayload(ideas.ideas) };
    if (prompt.includes("You are a content systems designer.")) return { json: templatesPayload(ideas.ideas) };
    throw new Error("unexpected prompt fragment");
  };
}

describe("contentPackageOrchestrator", () => {
  it("runs step1 then parallel hooks+templates and returns merged package", async () => {
    const n = 10;
    const snapshot = buildSubmissionSnapshot({
      brand_name: "Acme",
      industry: "SaaS",
      content_package_idea_count: n,
    });
    const out = await runContentPackageChain(snapshot, settings, undefined, {
      callAPI: routingMock(n),
    });
    expect(out.data.ideas).toHaveLength(n);
    expect(out.data.hooks).toHaveLength(n * PACKAGE_HOOKS_PER_IDEA);
    expect(out.data.templates).toHaveLength(n);
    expect(out.data.ideas[0]?.id).toBe(1);
  });

  it("fails coherence when hooks reuse the same variant_index for an idea", async () => {
    const n = 10;
    const ideas = ideasPayload(n);
    const badHooks = {
      hooks: [
        { idea_id: 1, variant_index: 1, hook_text: "a" },
        { idea_id: 1, variant_index: 1, hook_text: "b" },
        ...ideas.ideas.slice(1).flatMap((idea) =>
          Array.from({ length: PACKAGE_HOOKS_PER_IDEA }, (_, j) => ({
            idea_id: idea.id,
            variant_index: j + 1,
            hook_text: `h${idea.id}-${j + 1}`,
          }))
        ),
      ],
    };
    const callAPI = async (prompt: string) => {
      if (prompt.includes("Generate exactly") && prompt.includes("distinct short-form content ideas")) return { json: ideas };
      if (prompt.includes("You are a hook copywriter")) return { json: badHooks };
      if (prompt.includes("You are a content systems designer.")) return { json: templatesPayload(ideas.ideas) };
      throw new Error("unexpected");
    };
    await expect(
      runContentPackageChain(
        buildSubmissionSnapshot({ content_package_idea_count: n }),
        settings,
        undefined,
        { callAPI }
      )
    ).rejects.toThrow(/content_package_chain coherence failed/);
  });
});
