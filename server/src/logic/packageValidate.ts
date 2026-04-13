import { z } from "zod";
import { isPlainObject } from "./parse.js";
import { PACKAGE_HOOKS_PER_IDEA, expectedHooksTotal } from "./packageConstants.js";

const ideaSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  description: z.string().min(1),
});

function hookSchemaFor(hooksPerIdea: number) {
  return z.object({
    idea_id: z.number().int(),
    variant_index: z.number().int().min(1).max(hooksPerIdea),
    hook_text: z.string().min(1),
  });
}

const templateSchema = z.object({
  idea_id: z.number().int(),
  template_format: z.string().min(1),
});

export type ContentIdea = z.infer<typeof ideaSchema>;
const hookRowSchema = hookSchemaFor(PACKAGE_HOOKS_PER_IDEA);
export type ContentHook = z.infer<typeof hookRowSchema>;
export type ContentTemplate = z.infer<typeof templateSchema>;

export type ContentIdeasPackage = {
  ideas: ContentIdea[];
  hooks: ContentHook[];
  templates: ContentTemplate[];
};

function ideasRootSchemaFor(ideaCount: number) {
  return z.object({
    ideas: z.array(ideaSchema).length(ideaCount),
  });
}

function hooksRootSchemaFor(ideaCount: number) {
  const total = expectedHooksTotal(ideaCount);
  return z.object({
    hooks: z.array(hookSchemaFor(PACKAGE_HOOKS_PER_IDEA)).length(total),
  });
}

function templatesRootSchemaFor(ideaCount: number) {
  return z.object({
    templates: z.array(templateSchema).length(ideaCount),
  });
}

function zodErrors(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

export function validateIdeasStep(
  raw: unknown,
  ideaCount: number
): { ok: true; data: z.infer<ReturnType<typeof ideasRootSchemaFor>> } | { ok: false; errors: string[] } {
  const parsed = ideasRootSchemaFor(ideaCount).safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: zodErrors(parsed.error) };
}

export function validateHooksStep(
  raw: unknown,
  ideaCount: number
): { ok: true; data: z.infer<ReturnType<typeof hooksRootSchemaFor>> } | { ok: false; errors: string[] } {
  const parsed = hooksRootSchemaFor(ideaCount).safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: zodErrors(parsed.error) };
}

export function validateTemplatesStep(
  raw: unknown,
  ideaCount: number
): { ok: true; data: z.infer<ReturnType<typeof templatesRootSchemaFor>> } | { ok: false; errors: string[] } {
  const parsed = templatesRootSchemaFor(ideaCount).safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: zodErrors(parsed.error) };
}

/** Cross-step: hooks/templates must reference the same idea ids as `ideas`. */
export function validatePackageCoherence(ideas: ContentIdea[], hooks: ContentHook[], templates: ContentTemplate[]): string[] {
  const errors: string[] = [];
  const ideaCount = ideas.length;
  if (ideaCount < 1) {
    errors.push("ideas must be non-empty.");
    return errors;
  }

  const expectedIds = new Set(ideas.map((i) => i.id));
  if (expectedIds.size !== ideaCount) {
    errors.push(`ideas must have ${ideaCount} distinct integer ids.`);
  }

  for (const h of hooks) {
    if (!expectedIds.has(h.idea_id)) errors.push(`hooks: unknown idea_id ${h.idea_id}`);
  }
  for (const t of templates) {
    if (!expectedIds.has(t.idea_id)) errors.push(`templates: unknown idea_id ${t.idea_id}`);
  }
  const templateIds = templates.map((t) => t.idea_id);
  if (new Set(templateIds).size !== ideaCount) {
    errors.push("templates: each idea_id must appear exactly once.");
  }

  for (const idea of ideas) {
    const forIdea = hooks.filter((h) => h.idea_id === idea.id);
    if (forIdea.length !== PACKAGE_HOOKS_PER_IDEA) {
      errors.push(`hooks: idea_id ${idea.id} must have exactly ${PACKAGE_HOOKS_PER_IDEA} hooks.`);
      continue;
    }
    const variants = new Set(forIdea.map((h) => h.variant_index));
    for (let v = 1; v <= PACKAGE_HOOKS_PER_IDEA; v += 1) {
      if (!variants.has(v)) {
        errors.push(`hooks: idea_id ${idea.id} missing variant_index ${v}.`);
      }
    }
  }

  return errors;
}

export function asRecordForValidation(raw: unknown): Record<string, unknown> | null {
  return isPlainObject(raw) ? raw : null;
}
