/** Hook variants per idea in the chained package (fixed product choice). */
export const PACKAGE_HOOKS_PER_IDEA = 2;

/** Merged into kit `result_json` when the chained package runs successfully. */
export const CONTENT_IDEAS_PACKAGE_KEY = "content_ideas_package" as const;

export function expectedHooksTotal(ideaCount: number): number {
  return ideaCount * PACKAGE_HOOKS_PER_IDEA;
}
