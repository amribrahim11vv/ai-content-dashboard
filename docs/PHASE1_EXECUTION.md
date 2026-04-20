# Phase 1 Execution Spec (Trust + Streaming)

This document is the implementation baseline for Phase 1:

- 1.4 Graceful Schema Degradation
- 1.1 Progressive Structured Hydration
- 2.2 Implicit Property Ordering

## 1) Baseline contract for `/api/kits/generate`

Current baseline behavior (before streaming extension):

- Method: `POST /api/kits/generate`
- Headers:
  - `Authorization` (handled by middleware stack)
  - `X-Device-ID` (required and UUID)
  - `Idempotency-Key` (required by service)
- Request body: `BriefForm` payload + `submitted_at`
- Response:
  - `201` with `KitSummary` on new generation
  - `200` with `KitSummary` on idempotent replay hit

Idempotency semantics:

- Key hash is reserved first; replay with different brief hash returns `409`.
- Existing finished key returns prior kit.
- Pending key returns `409 in progress`.

## 2) Streaming route behavior spec (additive)

Phase 1 adds optional progressive mode without breaking baseline:

- Method: `POST /api/kits/generate?stream=1`
- Response content type: `text/event-stream`
- Event stream (SSE) payloads:
  - `event: status` for stage updates
  - `event: partial` for progressive `result_json` snapshots
  - `event: complete` final `KitSummary`
  - `event: error` safe message

Server chunk format:

- JSON object per event data
- `partial` includes:
  - `progress` in range `[0..1]`
  - `snapshot` object shaped as safe partial of `result_json`
  - `section` string hint

## 3) `result_json` criticality map for graceful degradation

Critical (viewer should show regenerate/refine CTA if missing or invalid):

- `posts` (core social output)
- `image_designs` OR equivalent mapped image section
- `video_prompts` OR equivalent mapped video section
- For each image item: `full_ai_image_prompt`
- For each video item: `ai_tool_instructions` OR valid `scenes`

Non-critical (silent fallback/hide/empty-safe):

- `hashtags`, `cta`
- Optional bilingual duplicates where one language exists
- `kpi_tracking`
- Secondary metadata fields (e.g. `conversion_trigger`, `text_policy`)

Strategy blocks:

- `marketing_strategy`, `sales_system`, `offer_optimization` degrade per sub-field.
- Missing sub-field must not crash section rendering.

## 4) UI fallback rules

Non-critical missing data:

- Hide micro-block or show empty-state text.
- Keep card/section mounted.

Critical missing data:

- Render local warning chip and CTA:
  - `Regenerate specific asset` (existing endpoint)
  - Keep rest of page usable

Never:

- No global crash / no unmount for single-node parse failure.

## 5) Partial parse strategy (client)

Client maintains:

- Raw incoming buffer
- Last valid parsed snapshot
- Progressive hydration state

Rules:

- Parse defensively from stream snapshots.
- Ignore malformed chunk payloads and keep last valid snapshot.
- Use throttled state updates to avoid render storms.

## 6) Skeleton + incremental render plan

Immediate on generation start:

- Show skeleton containers for:
  - Narrative summary
  - Diagnosis quick win
  - Posts list
  - Image/video sections

Incremental reveal order:

1. `narrative_summary`
2. `diagnosis_plan.quickWin24h`
3. `posts`
4. `image_designs`
5. `video_prompts`
6. strategy blocks

## 7) Property ordering target

Light-first ordering for perceived speed:

1. `narrative_summary`
2. `diagnosis_plan`
3. `posts`
4. `image_designs`
5. `video_prompts`
6. `marketing_strategy`
7. `sales_system`
8. `offer_optimization`
9. optional `kpi_tracking`

## 8) Observability minimum

Server logs:

- stream start, stage transitions, stream complete/error
- correlation id only
- no sensitive prompt/body dumps

Client logs (dev only):

- stream status transitions
- parser recoveries

## 9) Validation checklist for Phase 1 done

- Progressive UI appears before final completion.
- Missing optional fields do not break section rendering.
- Missing critical fields show localized CTA.
- Legacy keys remain compatible.
- Baseline `generateKit` response still works for non-stream mode.

---

Phase 2 continuation is documented in:

- `docs/PHASE2_EXECUTION.md`
