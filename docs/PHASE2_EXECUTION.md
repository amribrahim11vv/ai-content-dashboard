# Phase 2 Execution Spec (Prompt Intelligence + Trace UX)

This document is the implementation baseline for Phase 2:

- 2.1 `strategic_rationale` metadata
- 2.3 `algorithmic_advantage` metadata
- 2.4 bilingual localization enforcement (`localization_check_passed`)
- 1.3 stream-only labor-illusion reasoning trace

## 1) Contract extensions

Root `result_json` adds:

- `localization_check_passed: boolean`

Each asset entry in:

- `posts[]`
- `image_designs[]`
- `video_prompts[]`

must include:

- `strategic_rationale` object with:
  - `trigger_used`
  - `contrast_note`
  - `engagement_vector`
- `algorithmic_advantage` string

## 2) Stream-only reasoning trace

`POST /api/kits/generate?stream=1` now supports:

- `event: reasoning`

Payload contract:

- `index` (monotonic integer per stream)
- `section` (optional section key)
- `line` (single bounded text line)

Guardrails:

- line count capped per section
- line length capped
- best-effort emission only (trace issues must not fail generation)
- never persisted to `result_json`

## 3) UI behavior

Wizard loading overlay should:

- keep existing progress/status behavior
- render bounded trace lines incrementally
- honor reduced-motion preferences
- avoid replacing primary progress affordances

## 4) Viewer behavior

For post/image/video cards:

- display strategy metadata only when fields are non-empty
- hide invalid/missing blocks silently
- keep full compatibility with legacy kits missing Phase 2 fields

## 5) Rollout gates

Before enabling broadly:

1. Server tests pass (`kits` route + `logic` suite).
2. Client typecheck/build passes.
3. Stream checks confirm lifecycle order with `reasoning` present.
4. Legacy kit rendering smoke check passes.

## 6) Rollback plan

If reasoning trace causes noise/perf regressions:

1. Keep backend generation path unchanged.
2. Disable reasoning panel rendering in wizard UI (client-only rollback).
3. Retain schema metadata fields (non-breaking additive contract).
4. Re-run Phase 2 validation checklist before re-enable.

