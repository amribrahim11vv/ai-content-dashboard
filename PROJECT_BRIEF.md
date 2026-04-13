# Project Brief: Social Geni (AI Content Dashboard)

This document explains **what the product is for**, **why it exists**, and **how users are meant to experience it**. Package name in the repo is `social-geni`; the product narrative is **AI Content Kits**—turning a brand brief into a **single, reviewable bundle** of copy, creative direction, and strategy you can actually ship.

For API details, env vars, and commands, see [`README.md`](README.md).

---

## 1. The idea in one sentence

**Social Geni helps a brand or marketer go from a structured interview (the wizard) to a complete “marketing kit”—posts, image prompts, video plans, and supporting strategy—in one synchronous generation, then review, copy, and refine individual pieces without starting over.**

The site is not “another chat with AI.” It is a **pipeline**: capture context once, enforce a **fixed output shape**, store the result as a **first-class artifact** (a kit), and present it in a UI built for **execution** (copy buttons, sections, retries), not open-ended conversation.

---

## 2. The problem it tries to solve

Small teams, freelancers, and regional brands often hit the same wall:

- They know their offer and audience but **lack time** to produce a coherent month of content.
- Generic AI chat gives **fragments**—a caption here, a vague image idea there—with no **single document** that matches their brief, tone, and constraints.
- **Bilingual** markets (e.g. Arabic and English for social captions and metadata) multiply the work: two languages, one brand voice, easy to drift.
- **Creative tools** (image/video generators) need **technical prompts**; marketing people do not always know how to write scene-level instructions that survive real tools.

Social Geni compresses that work: one submission, one stored **kit** that bundles **executable assets** (copy + prompts) with **reasoning layers** (strategy, offer framing, objections) so the output is useful for both **content** and **sales** conversations.

---

## 3. What a “kit” means in this product

A **kit** is the persisted result of one generation run. Conceptually it contains:

- **Social layer**: Platform-aware posts with goals, bilingual long-form body copy where the schema requires it, hashtags, and CTAs—ready to adapt and paste.
- **Visual layer**: Image-oriented blocks with scene descriptions, overlay guidance, full AI image prompts, captions, and conversion-oriented notes—so design or AI tooling has a **spec**, not a whim.
- **Video layer**: Short-form oriented plans—structure, scenes, tool-oriented instructions, and “why this converts” style rationale.
- **Strategy layer**: Not fluff—**marketing strategy** (mix, cadence, platforms, angles, positioning), **sales system** (pains, funnel thinking, ad angles, objection handling), **offer optimization** (sharpened offer line, urgency framing, alternatives), plus **diagnosis** and a **narrative summary** so the user sees *why* the assets fit together.

The UI (**Kit Viewer**) is organized around these layers so a user can **jump to the section they need** (e.g. only video prompts for an editor, only posts for a community manager) instead of scrolling an unstructured wall of text.

---

## 4. Who it is for (and how they use it)

| Persona | What they get from the product |
|--------|--------------------------------|
| **Brand owner / marketing lead** | A fast **baseline plan** aligned to budget, duration, and platforms they selected in the wizard; a **summary** they can share internally. |
| **Social manager** | **Copy-paste-ready posts** and hashtag/CTA structure; language toggle where the kit exposes Arabic and English fields. |
| **Designer or AI operator** | **Image and video prompt blocks** detailed enough to feed Midjourney, DALL·E, Runway-class tools, etc. |
| **Sales or growth** | **Pain points, objections, funnel and CTA angles** from the sales-system portion of the kit—useful for landing pages, ads, or call scripts. |
| **Internal admin / strategist** | **Prompt catalog** and industry templates so the *voice of the machine* stays on-brand across many kits; **analytics** on wizard usage; ability to **see all kits** for QA or support. |

The public flow assumes **no full user accounts** for kit listing: kits created from a browser are **scoped to a stable device identity** so the same visitor sees **their** history when they return. Admins use separate routes to see **everything**. That trade-off favors **speed to value** for anonymous or lightweight use while still allowing operational oversight.

---

## 5. The user journey (purpose of each major surface)

### 5.1 Dashboard and “Generated kits”

Purpose: **Orientation and history**. Users see whether generation succeeded or failed, open past kits, and avoid losing work. Status and list views answer: *“Do I have something to work with, and where is it?”*

### 5.2 The wizard (three campaign modes)

Purpose: **Turn implicit knowledge into explicit constraints** the model cannot guess—brand, industry, audience, goals, platforms, tone, offer, budget band, counts of posts/images/videos, and mode of campaign (`social`, `offer`, `deep`).  

**Draft saving** exists so the journey respects real life: users abandon tabs and return. The product goal is to **reduce abandonment** and **increase completion quality** (fuller briefs → better kits).

### 5.3 Generation moment

Purpose: **One authoritative run** per logical request. **Idempotency** exists so double-clicks and network retries do not create duplicate kits or double cost—this is a product promise of **predictability**, not just an engineering detail.

### 5.4 Kit detail (viewer)

Purpose: **Make the kit actionable**. Collapsible sections, copy actions, optional technical JSON, and **partial regeneration** (one post, one image block, one video item) support the real workflow: *“Everything else is fine—redo item 3 with this feedback.”*

### 5.5 Admin: Prompt catalog

Purpose: **Separate “how we want the AI to think” from “what this client typed.”** Authors maintain **industry creative direction** (hooks, angles, tone rules). The server still injects **client context from the wizard** so each kit stays anchored to that submission. That separation is core to scaling quality across many brands without editing code for every tweak.

### 5.6 Admin: Analytics and full kit review

Purpose: **Improve prompts and spot failures**. Seeing all kits and how people move through the wizard informs product and content strategy—not just debugging.

---

## 6. Why structured JSON (and strict validation) matters to the *idea*

If the model returned free-form prose, the app could not reliably show **“Video prompt #2”** or **merge a regenerated post back into the kit**. The product promise of a **kit** depends on a **contract**: known keys for posts, designs, videos, strategy objects, etc.

That is why the backend uses a **response schema** and validation: the **UX is designed around predictable blocks**. The user should feel they received a **designed deliverable**, not a lucky paste from a chat window.

Creative-policy rules (e.g. constraints around **Arabic text inside image/video visual frames** vs. captions and scripts) exist so outputs stay **usable** in real creative pipelines and regional contexts.

---

## 7. Reliability and iteration as product features

- **Failed generation**: The user should be able to **retry** with a clear path (full retry from stored brief), not lose the brief or start from zero manually.
- **Row versioning**: Prevents two tabs from silently overwriting each other’s updates—again, about **trust** in the artifact.
- **Regenerate one item**: Matches how people work—“fix this asset only.”

These are not secondary; they reinforce that a **kit is an object you own and refine**, not a disposable chat transcript.

---

## 8. Positioning summary

| Dimension | Intent |
|-----------|--------|
| **Vs. generic ChatGPT** | Fixed structure, stored kits, wizard-driven context, bilingual fields where defined, copy-oriented UI. |
| **Vs. a static template shop** | Every kit is **generated** from the user’s brief and industry prompts, not a dead PDF. |
| **Vs. a pure scheduling tool** | Strong on **creation** (copy + prompts + strategy); scheduling is out of scope unless added later. |

---

## 9. Under the hood (short pointer)

- **Stack**: React (Vite) + Hono API + PostgreSQL (Drizzle), Gemini for generation. See README for diagrams and versions.
- **Auth model**: Browser calls from allowed origins or Bearer `API_SECRET` for tools; kits list/detail for normal users tied to **`X-Device-ID`**; admin uses broader list scope.
- **Key code**: `server/src/logic/responseSchema.ts` (output shape), `server/src/services/kitGenerationService.ts` (orchestration), `client/src/KitViewer.tsx` (presentation), `client/src/features/kits/kitViewModel.ts` (mapping `result_json` to UI).

---

## 10. Future direction (product-level)

Ideas already noted in the repo include field-level repair endpoints, richer validation errors for power users, and shared typing between client and server—each would further strengthen the **“kit as a reliable artifact”** story.

---

*This brief prioritizes purpose and experience. Operational and API specifics live in `README.md` and the codebase.*
