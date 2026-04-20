# Gemini prompt pipeline (map + excerpts)

**Canonical implementation:** [server/src/logic/promptComposer.ts](../server/src/logic/promptComposer.ts) (`composePrompt` and helpers).  
**Resolution (templates, DB, env):** [server/src/logic/promptResolver.ts](../server/src/logic/promptResolver.ts).  
**JSON contract:** [server/src/logic/responseSchema.ts](../server/src/logic/responseSchema.ts) (`getGeminiResponseSchema`).  
**HTTP + guardrails:** [server/src/services/aiGenerationProvider.ts](../server/src/services/aiGenerationProvider.ts), [server/src/logic/geminiClient.ts](../server/src/logic/geminiClient.ts).

Full narrative: [PROJECT_BRIEF.md](../PROJECT_BRIEF.md) §10.5. This file gives **surgical** context when the brief is not loaded.

---

## `composePrompt` — section order

The final **user** message is one concatenated string. Non-empty sections are joined in this **fixed order**:

1. **`campaignPrefix`** — from resolver (campaign / mode framing).
2. **`Meta Strategy Core`** — if `useMetaPrompt`: `buildMetaPromptBlock(snapshot)` (“Creative Director…”, internal meta sequence).
3. **`Brand Voice & Tone`** — `buildBrandVoiceBlock(brandVoice)` (optional if no voice).
4. **`Creative Direction`** — resolver-provided template body (catalog / meta).
5. **`Client Context (auto-injected)`** — `buildClientContextBlock(snapshot)` (labeled lines + diagnostic JSON).
6. **`Conditional Diagnostic Rules`** — `buildDiagnosticRulesBlock(snapshot)`.
7. **`Few-shot Guidance`** — `buildFewShotGuidanceBlock()`.
8. **`Diversity Rules`** — `buildDiversityPolicyBlock(snapshot)` (per-run salt).
9. **`Video Director Rules`** — `buildVideoDirectorPolicyBlock()`.
10. **`Output Rules`** — `buildOutputPolicyBlock(mode)` (JSON, bilingual, Arabic strategy fields, video clause shape, no Arabic in-scene text, etc.).

See `composePrompt` at the bottom of `promptComposer.ts`.

---

## Excerpt: video negative suffix (constant)

Every `ai_tool_instructions` must **end** with this exact sentence (also referenced in Output Rules):

```text
Ensure no text, no floating letters, no watermarks. Maintain strict physical consistency.
```

(Source: `VIDEO_NEGATIVE_SUFFIX` in `promptComposer.ts`.)

---

## Excerpt: meta block opening (`buildMetaPromptBlock`)

```text
You are a Creative Director and strategic marketer.
Use a meta-prompting workflow internally before producing output.
Internal-only sequence (never expose chain-of-thought):
1) Deduce psychological triggers for this audience and buying context.
2) Deduce an effective tone/style that fits trust level and goal urgency.
3) Deduce visual identity direction that can convert on the requested platforms.
```

(Followed by client industry, audience, goal, offer, platforms, reference-image flag — see file.)

---

## Excerpt: client context lines (`buildClientContextBlock`)

The block includes lines such as:

- `Brand name: …`
- `Industry: …`
- `Target audience: …` (joined list)
- `Main goal: …`, `Platforms: …`, `Brand tone: …`, `Offer: …`, etc.
- `Requested posts/image/video counts`
- `Diagnostic context (JSON):` — serialized diagnostic fields

Full list: `buildClientContextBlock` in `promptComposer.ts`.

---

## Excerpt: output policy bullets (`buildOutputPolicyBlock`)

Representative rules (not exhaustive — see source):

- Return strict JSON matching the response schema; use `post_ar` / `post_en`; long-form bilingual posts.
- Preserve property order exactly as schema-defined (light fields first).
- Strategy sections (`marketing_strategy`, `sales_system`, etc.): **Arabic** for strings/lists; Latin only for unavoidable names.
- **CRITICAL:** no Arabic typography inside **image** prompts or **video scene** visuals; captions/scripts may be Arabic.
- Each `video_prompts[].ai_tool_instructions`: **3 clauses** — camera-work, motion-control, then the **VIDEO_NEGATIVE_SUFFIX** line exactly.

---

## Phase 1 ordering assumption (stream hydration)

Phase 1 viewer hydration expects top-level keys to arrive in this sequence:

1. `narrative_summary`
2. `diagnosis_plan`
3. `posts`
4. `image_designs`
5. `video_prompts`
6. `marketing_strategy`
7. `sales_system`
8. `offer_optimization`
9. `kpi_tracking` (optional)

If prompt/schema ordering changes, update:

- `server/src/logic/responseSchema.ts`
- `server/src/logic/promptComposer.ts`
- `server/src/routes/kits.ts` (stream partial snapshots ordering)

## Chained generation (content package)

Separate JSON steps (ideas / hooks / templates) use **their own** schemas via `generateJsonStepWithGuardrails`; see `contentPackageOrchestrator` and [PROJECT_BRIEF.md](../PROJECT_BRIEF.md) §10.5.5.

---

## Phase 2 contract (prompt intelligence + localization)

Phase 2 extends each generated asset object (`posts[]`, `image_designs[]`, `video_prompts[]`) with:

- `strategic_rationale` object:
  - `trigger_used`
  - `contrast_note`
  - `engagement_vector`
- `algorithmic_advantage` string

Root contract adds:

- `localization_check_passed` boolean

Localization rules in output policy:

- Arabic and English variants (`*_ar`, `*_en`) must be semantically equivalent.
- Literal word-by-word translation is explicitly disallowed.
- `localization_check_passed` should be `true` only when parity and cultural appropriateness are satisfied.

Relevant code:

- `server/src/logic/responseSchema.ts`
- `server/src/logic/promptComposer.ts`
- `server/src/logic/validate.ts`

---

## Environment knobs (non-exhaustive)

`GEMINI_MODEL`, `GEMINI_TEMPERATURE`, `GEMINI_TOP_P`, `USE_META_PROMPT`, `STRICT_PROMPT_TEMPLATES`, `DEMO_MODE`, `CONTENT_PACKAGE_CHAIN_ENABLED` (see `.env.example` and `constants.ts`).
