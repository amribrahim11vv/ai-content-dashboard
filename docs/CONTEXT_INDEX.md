# Documentation index (for humans and LLM context routing)

**Start here for handoff:** **[`AI_HANDOFF.md`](../AI_HANDOFF.md)** — project status, mandatory paths by task type, and strict “no massive refactoring” directive for future agents.

Use this file when the **full** [PROJECT_BRIEF.md](PROJECT_BRIEF.md) does not fit in context (~770 lines). Prefer **targeted reads** below.

| Document | Approx. role | Read when you need… |
|----------|----------------|---------------------|
| [AI_HANDOFF.md](../AI_HANDOFF.md) | First entry point for new agents | Handoff: stability statement, path map, strict maintenance rules |
| [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | Product narrative + technical map | Wizard UX (§5.2), DB columns (§10.3), kit JSON (§10.4), prompt pipeline (§10.5), APIs (§10.8) |
| [PROJECT_BRIEF_EXECUTIVE.md](PROJECT_BRIEF_EXECUTIVE.md) | One-page investor/product summary | Pitch-level overview; links to deeper sections |
| [README.md](../README.md) | Run, env, API table, kit schema summary | Commands, quality gates, deployment notes |
| [SCOPE.md](SCOPE.md) | In/out of scope | Avoid proposing out-of-scope features |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Locked stack diagram | Stack questions, where Hono/DB/Gemini sit |
| [docs/DATABASE.md](DATABASE.md) | Tables + columns (from Drizzle) | Telemetry/schema proposals, migrations, SQL |
| [docs/GEMINI_PROMPTS.md](GEMINI_PROMPTS.md) | `composePrompt` order + excerpts | Prompt engineering, Category-2 surgical tweaks |
| [docs/TASKING.md](TASKING.md) | Task granularity rules | Breaking work into PR-sized units |
| [docs/templates/phase-audit.md](templates/phase-audit.md) | Requirements vs codebase table | Phase verification (guideline #4) |
| [docs/TESTING.md](TESTING.md) | Commands + self-review checklist | guideline #6 |
| [docs/SERVER_SCRIPTS.md](SERVER_SCRIPTS.md) | Server-side operational/debug/export scripts | Running PDF/export debugging utilities safely |
| [docs/GIT_WORKFLOW.md](GIT_WORKFLOW.md) | Commits and branches | guideline #8 |
| [docs/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Tailwind / tokens / constraints | guideline #7 |
| [AGENTS.md](../AGENTS.md) | AI agent collaboration rules | guidelines #9–11 |

## Mandatory entry points by task type

**Before editing code**, identify the task type and read these paths **in order** (then open any additional files you touch). This list is the default onboarding path for agents; the quick table below stays aligned with it.

| Task type | Read first (ordered) | Notes |
|-----------|----------------------|--------|
| **Frontend / UI** | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) → [`client/src/main.tsx`](../client/src/main.tsx) → [`client/src/App.tsx`](../client/src/App.tsx) | If changing wizard fields: [`client/src/briefSchema.ts`](../client/src/briefSchema.ts). If changing wizard flow/UI: [`client/src/pages/wizards/WizardCore.tsx`](../client/src/pages/wizards/WizardCore.tsx). Then dive into the specific page/feature folder under `client/src/`. |
| **Backend / API** | [`server/src/index.ts`](../server/src/index.ts) (route mount) → [`server/src/middleware/auth.ts`](../server/src/middleware/auth.ts) → affected route(s), e.g. [`server/src/routes/kits.ts`](../server/src/routes/kits.ts) | If generation behavior changes from HTTP layer: [`server/src/services/kitGenerationService.ts`](../server/src/services/kitGenerationService.ts). Add other `server/src/routes/*.ts` as needed. |
| **Database / schema** | [`server/src/db/schema.ts`](../server/src/db/schema.ts) → [`server/src/db/migrations.ts`](../server/src/db/migrations.ts) → [DATABASE.md](DATABASE.md) | After schema edits, update `DATABASE.md` per [`docs/TASKING.md`](TASKING.md) (documentation sync). |
| **AI / prompts / orchestration** | [GEMINI_PROMPTS.md](GEMINI_PROMPTS.md) → [`server/src/logic/promptComposer.ts`](../server/src/logic/promptComposer.ts) → [`server/src/logic/promptResolver.ts`](../server/src/logic/promptResolver.ts) → [`server/src/logic/responseSchema.ts`](../server/src/logic/responseSchema.ts) → [`server/src/logic/geminiClient.ts`](../server/src/logic/geminiClient.ts) → [`server/src/services/aiGenerationProvider.ts`](../server/src/services/aiGenerationProvider.ts) | Content-package work: [`server/src/services/contentPackageOrchestrator.ts`](../server/src/services/contentPackageOrchestrator.ts) + `server/src/logic/package*.ts` (e.g. `packagePrompts.ts`, `packageResponseSchema.ts`). |
| **Product / scope** (behavior or positioning) | [SCOPE.md](SCOPE.md) → relevant sections of [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | Use when the change affects what the product promises or user-visible flows documented in the brief. |

## Suggested read order by agent type (shortcut)

Same intent as **Mandatory entry points** above; use this row-only view when you already know your role.

| Goal | Start with | Then |
|------|------------|------|
| **Product / UX** | [SCOPE.md](SCOPE.md), PROJECT_BRIEF §1–6, §5.2 | README Core Features; mandatory row **Product / scope** if scope changes |
| **Backend / API** | PROJECT_BRIEF §10.8, README API | Mandatory row **Backend / API** |
| **Database** | [DATABASE.md](DATABASE.md) | `schema.ts`, `migrations.ts` — mandatory row **Database / schema** |
| **Prompts / Gemini** | [GEMINI_PROMPTS.md](GEMINI_PROMPTS.md) | Mandatory row **AI / prompts / orchestration** |
| **Frontend** | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Mandatory row **Frontend / UI** |

## Single source of truth (avoid drift)

| Topic | Canonical file |
|-------|------------------|
| Table definitions | `server/src/db/schema.ts` |
| Kit output JSON shape | `server/src/logic/responseSchema.ts` |
| Composed user prompt | `server/src/logic/promptComposer.ts` (`composePrompt`) |
| Wizard fields | `client/src/briefSchema.ts`, `WizardCore.tsx` |

## Directory Navigation

- Planning docs: [`docs/planning/`](planning/)
- Archived execution plans: [`docs/archive/execution-plans/`](archive/execution-plans/)
- Archived state snapshots: [`docs/archive/states/`](archive/states/)
