/**
 * Gemini responseSchema fragments for chained content-package generation.
 * Each step uses a small OBJECT root to constrain hallucinations.
 */

import { expectedHooksTotal, PACKAGE_HOOKS_PER_IDEA } from "./packageConstants.js";

const ideaItem = {
  type: "OBJECT",
  required: ["id", "title", "description"],
  properties: {
    id: { type: "INTEGER" },
    title: { type: "STRING" },
    description: { type: "STRING" },
  },
} as const;

export function getIdeasStepSchema(ideaCount: number): Record<string, unknown> {
  return {
    type: "OBJECT",
    required: ["ideas"],
    properties: {
      ideas: {
        type: "ARRAY",
        minItems: ideaCount,
        maxItems: ideaCount,
        items: ideaItem,
      },
    },
  };
}

export function getHooksStepSchema(ideaCount: number): Record<string, unknown> {
  const totalHooks = expectedHooksTotal(ideaCount);
  return {
    type: "OBJECT",
    required: ["hooks"],
    properties: {
      hooks: {
        type: "ARRAY",
        minItems: totalHooks,
        maxItems: totalHooks,
        items: {
          type: "OBJECT",
          required: ["idea_id", "variant_index", "hook_text"],
          properties: {
            idea_id: { type: "INTEGER" },
            variant_index: { type: "INTEGER", minimum: 1, maximum: PACKAGE_HOOKS_PER_IDEA },
            hook_text: { type: "STRING" },
          },
        },
      },
    },
  };
}

export function getTemplatesStepSchema(ideaCount: number): Record<string, unknown> {
  return {
    type: "OBJECT",
    required: ["templates"],
    properties: {
      templates: {
        type: "ARRAY",
        minItems: ideaCount,
        maxItems: ideaCount,
        items: {
          type: "OBJECT",
          required: ["idea_id", "template_format"],
          properties: {
            idea_id: { type: "INTEGER" },
            template_format: { type: "STRING" },
          },
        },
      },
    },
  };
}
