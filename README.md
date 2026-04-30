# Social Geni

> AI Content Kits in Minutes. Generate, review, and manage social + image + video kits with a visual dashboard.

---

## Product Preview

### Main screens

| Dashboard (Live) | Wizard (Live) |
|---|---|
| ![Dashboard](docs/screenshots/dashboard-real.png) | ![Wizard](docs/screenshots/wizard-real.png) |

| Generated Kits (Live) | Admin Kits Review (Live) |
|---|---|
| ![Generated Kits](docs/screenshots/generated-kits-real.png) | ![Admin Kits Review](docs/screenshots/admin-kits-review-real.png) |

---

## Stack at a glance

| Layer | Tech |
|---|---|
| Frontend | Vite + React + TypeScript |
| Backend (BFF) | Hono |
| Database | PostgreSQL + Drizzle |
| AI | Gemini (server-side only) |
| Testing | Playwright (smoke E2E) |

---

## Documentation map

**New agent / handoff:** [`AI_HANDOFF.md`](AI_HANDOFF.md). For full doc routing (scope, architecture, DB, prompts, tasking), use **[`docs/CONTEXT_INDEX.md`](docs/CONTEXT_INDEX.md)**. Collaboration rules: [`AGENTS.md`](AGENTS.md).

Agency pivot implementation details: [`docs/archive/execution-plans/PIVOT_AGENCY_EXECUTION.md`](docs/archive/execution-plans/PIVOT_AGENCY_EXECUTION.md).
Server debug/export scripts catalog: [`docs/SERVER_SCRIPTS.md`](docs/SERVER_SCRIPTS.md).

---

## Dependency Note (Drizzle)

- The project is currently pinned to the **Drizzle beta stack** for security compliance and tooling compatibility:
  - `drizzle-orm@1.0.0-beta.21`
  - `drizzle-kit@1.0.0-beta.21`
- This was adopted to fully resolve dependency advisories while keeping `drizzle-kit` CLI workflows operational.
- Team guidance: keep these versions aligned, and plan a controlled migration to the first stable `1.x` release when available.

---

## Architecture (simple flow)

```mermaid
flowchart LR
  U[User] --> W[Content Wizard]
  W -->|brief JSON + Idempotency-Key| API[Hono API]
  API --> LLM[Gemini]
  API --> DB[(PostgreSQL / Drizzle)]
  DB --> D[Dashboard + Kit Viewer]
```

---

## Quick Start

```bash
cd ai-content-dashboard
cp .env.example server/.env
cp .env.example client/.env.local

# server/.env
# - GEMINI_API_KEY
# - API_SECRET

# client/.env.local
# - VITE_API_URL

# optional demo mode
# - server/.env: DEMO_MODE=true
# - client/.env.local: VITE_DEMO_MODE=true

# edition switches
# - server/.env: APP_EDITION=self_serve|agency
# - server/.env (agency admin auth): ADMIN_USERNAME=admin, ADMIN_PASSWORD, ADMIN_AUTH_SECRET
# - client/.env.local: VITE_APP_EDITION=self_serve|agency
# - optional auth callback override: VITE_AUTH_REDIRECT_URL=https://ai-content-dashboard-app-v2.onrender.com/wizard/social
# - V1 cutover controls (self-serve deploy only):
#   - VITE_V1_PUBLIC_DECOMMISSION=true
#   - VITE_V2_CANONICAL_URL=https://ai-content-dashboard-app-v2.onrender.com/wizard/social
# - MVP productized-service payment flow:
#   - VITE_WHATSAPP_SALES_NUMBER=201025364905
#   - Premium package CTA routes to WhatsApp (wa.me) with prefilled Arabic payment message
# - optional team routing: TELEGRAM_WEBHOOK_URL or (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID [+ TELEGRAM_THREAD_ID]), ADMIN_BASE_URL
# - optional PDF export branding/runtime:
#   - PDF_AGENCY_NAME=Your Agency
#   - PDF_AGENCY_CONTACT=+20XXXXXXXXXX | support@example.com
#   - PDF_AGENCY_LOGO_URL=https://example.com/logo.png
#   - PDF_PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage

npm install
npm run dev
```

- API: `http://localhost:8787`
- UI: `http://localhost:5173`

---

## E2E Smoke Test

```bash
npx playwright install
npm run test:e2e
```

Runs dev servers in demo mode with a temporary DB.
Set `PLAYWRIGHT_BASE_URL` when you need a non-default URL (default: `http://localhost:5173`).

---

## Pre-Push Quality Gates

Run these commands from the repository root before push/deploy:

```bash
npx tsc --noEmit -p client/tsconfig.json
npx tsc --noEmit -p server/tsconfig.json
npm audit --audit-level=high
```

Required production env guards:
- `API_SECRET` must be present and non-empty in production (service bearer path).
- `CORS_ORIGIN` cannot be `*` in production; startup now fails fast with a security error.

---

## Core Features

- Visual wizard with per-path auto-save drafts in localStorage (`ai-content-dashboard:wizard-draft:social:v1`, `...:offer:v1`, `...:deep:v1`)
- Idempotent synchronous kit generation
- Dashboard list + searchable kit viewer
- V2 client portal with sidebar navigation: **Overview** (`/`) is a dedicated landing (process + portfolio); **Request Content** opens the wizard at `/wizard/social`; plus My Brands and Pricing
- Structured social/image/video rendering (with copy actions)
- Retry flow for failed generation (full regenerate)
- Admin-only hard delete for duplicate/junk kits (`DELETE /api/kits/:id`)
- Admin kit exports with downloadable PDF and styled Excel (`.xlsx`)
- Prompt Catalog authoring as creative direction (client context auto-injected server-side)

---

## Plan behavior (Free vs Paid)

The active plan controls wizard access depth and generation limits:

| Area | Starter (free sample) | Early Adopter (paid) |
|---|---|---|
| Campaign modes | `social` only | `social`, `offer`, `deep` |
| Wizard advanced step (`volume`) | locked (submit free test path) | unlocked |
| Reference image upload | locked | enabled |
| Monthly video prompts | 1 | 2 |
| Monthly image prompts | 2 | 10 |
| Retry / regenerate | not available | available (unlimited by plan policy) |
| Agency intake contact fields | required | required |

In agency mode, users submit once and are routed to `order-received`; internal/admin flow handles fulfillment and export operations.

---

## Prompt Authoring Workflow

- In Prompt Catalog, write **industry creative direction only** (voice, angles, hooks, positioning).
- Backend injects a fixed **Client Context Block** from wizard submission automatically.
- Legacy placeholder templates (`{{brand_name}}` etc.) are still supported for backward compatibility.

---

## Kit JSON schema (`result_json`)

The model output stored on each kit row follows the **Gemini response schema** defined in code:

- **Source of truth:** `server/src/logic/responseSchema.ts` (`getGeminiResponseSchema()`)

### Top-level shape (required keys)

| Key | Type | Notes |
|-----|------|--------|
| `posts` | `object[]` | Social posts: `platform`, `format`, `goal`, **`post_ar`**, **`post_en`**, `hashtags[]`, `cta` |
| `image_designs` | `object[]` | Image briefs: `platform_format`, `design_type`, `goal`, `visual_scene`, `headline_text_overlay`, `supporting_copy`, `full_ai_image_prompt`, **`caption_ar`**, **`caption_en`**, `text_policy`, `conversion_trigger` |
| `video_prompts` | `object[]` | Video briefs: `platform`, `duration`, `style`, `hook_type`, `scenes[]` (`time`, `label`, `visual`, `text`, `audio`), **`caption_ar`**, **`caption_en`**, `ai_tool_instructions`, `why_this_converts` |
| `marketing_strategy` | `object` | `content_mix_plan`, `weekly_posting_plan`, `platform_strategy`, `key_messaging_angles[]`, `brand_positioning_statement` |
| `sales_system` | `object` | `pain_points[]`, `offer_structuring`, `funnel_plan`, `ad_angles[]`, `objection_handling[]` (`objection`, `response`), `cta_strategy` |
| `offer_optimization` | `object` | `rewritten_offer`, `urgency_or_scarcity`, `alternative_offers[]` |
| `diagnosis_plan` | `object` | `quickWin24h`, `focus7d`, `priority`, `rationale` |
| `narrative_summary` | `string` | Single narrative block |

### Optional top-level keys

| Key | Type | Notes |
|-----|------|--------|
| `kpi_tracking` | `object?` | `top_kpis[]`, `benchmarks`, `optimization_actions`, `ab_tests_week1[]` (allowed by schema; may be empty or omitted depending on model) |
| `content_ideas_package` | `object?` | **Not** in the base Gemini schema; merged when the **content package** chain is enabled. Shape consumed by the UI: `ideas[]` (`id`, `title`, `description`), `hooks[]` (`idea_id`, `variant_index`, `hook_text`), `templates[]` (`idea_id`, `template_format`). See `client/src/features/kits/kitViewModel.ts`. |

### Prompt / safety notes (bilingual + visuals)

- Posts and captions are **bilingual** (`*_ar` / `*_en`). Legacy single-field `post` / `caption` may exist on older kits; the viewer normalizes where needed.
- Prompt instructions enforce **no Arabic text burned into** image/video **visuals**; Arabic is fine for scripts and external captions.

### Viewer compatibility (legacy key aliases)

`buildKitViewModel` may resolve older or alternate keys for images/videos (e.g. `image_prompts`, `video_assets`). New generations use `image_designs` and `video_prompts` as above.

---

## Content Wizard — routes and steps

Three campaign modes, each with its own route and draft key (auto-saved in `localStorage`).

| Mode | Route | Draft key suffix | Default `campaign_mode` |
|------|--------|------------------|-------------------------|
| Social-first | `/wizard/social` | `wizard-draft:social:v1` | `social` |
| Offer / product | `/wizard/offer` | `wizard-draft:offer:v1` | `offer` |
| Deep content | `/wizard/deep` | `wizard-draft:deep:v1` | `deep` |

**Experiment (Variant B — “Quick diagnosis” first):** About **20%** of sessions get **Variant B** unless overridden. Force with query param **`?wizard_exp=B`** (or `A`). Stored under `ai-content-dashboard:wizard-exp:v1`.

### Step order by mode

Step **ids** match `stepOrder` in each wizard file; labels are the **chip titles** shown in the UI.

**Social Campaign** (`SocialCampaignWizard.tsx`)

| Variant | Step order (ids → chip title) |
|---------|-------------------------------|
| **A** | `brand` → Brand & industry → `audience` → Audience & goals → `channels` → Channels & tone → `creative` → Creative direction → `volume` → Output volumes |
| **B** | `diagnosis` → Quick diagnosis → then same as A from `brand` … `volume` |

**Offer / Product** (`OfferProductWizard.tsx`)

| Variant | Step order |
|---------|------------|
| **A** | `brand` → Brand & industry → `offer` → Offer & positioning → `audience` → Audience & goals → `volume` → Output volumes |
| **B** | `diagnosis` → Quick diagnosis → `brand` → … → `volume` |

**Deep Content** (`DeepContentWizard.tsx`)

| Variant | Step order |
|---------|------------|
| **A** | `brand` → Brand & industry → `audience` → Audience & goals → `creative` → Creative direction → `volume` → Output volumes |
| **B** | `diagnosis` → Quick diagnosis → `brand` → … → `volume` |

Shared implementation: `client/src/pages/wizards/WizardCore.tsx`. After the last step, submission calls **`POST /api/kits/generate`** with the brief JSON and **`Idempotency-Key`**.

### Wizard UX notes

- Draft autosave is strict: current step + full form snapshot are persisted on each change and restored after refresh.
- Brand step includes optional `business_links` (website/social links) and sends it in the generation brief.
- Active platform pills include recognizable platform logos (Facebook, Instagram, X, LinkedIn, TikTok, YouTube).
- Best content types include `product_demo` and `problem_solving`.

---

## API Reference

Auth boundary contract for guarded routes:

- `Authorization: Bearer <API_SECRET>` for internal service-to-service calls.
- `Authorization: Bearer <JWT>` for user/browser channels (JWT-shaped bearer is accepted at gate, then verified in user auth middleware).
- `X-Agency-Admin-Session: <session-token>` for agency admin channels.

Rate-limit IP resolution (spoofing-resistant defaults):
- `cf-connecting-ip` first (trusted edge header when available)
- `x-real-ip` second (trusted reverse proxy header)
- `x-forwarded-for` is ignored by default and only used when `TRUST_X_FORWARDED_FOR=true`
- fallback is `local`

Request-size guardrails:
- Global `/api/*` payload cap is controlled by `API_MAX_CONTENT_LENGTH_BYTES` (default `262144` bytes).
- Analytics ingest keeps an additional endpoint-specific cap via `ANALYTICS_MAX_CONTENT_LENGTH_BYTES`.

Rejected by default:
- Requests that rely only on `Origin`/`Referer` (no longer trusted as auth signals).
- Production runtime with `CORS_ORIGIN=*`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/kits/generate` | Sync generation (**requires** `Idempotency-Key`) |
| `POST` | `/api/kits/generate?stream=1` | SSE generation stream (`status` / `reasoning` / `partial` / `complete`) |
| `GET` | `/api/kits` | List kits (newest first) |
| `GET` | `/api/kits/:id` | Kit detail |
| `POST` | `/api/kits/:id/retry` | Retry only `failed_generation` with `{ brief_json, row_version }` |
| `POST` | `/api/kits/:id/regenerate-item` | Regenerate one item only with `{ item_type, index, row_version, feedback? }` |
| `GET` | `/api/kits/:id/export-pdf` | Admin-only PDF export (`.pdf`) |
| `GET` | `/api/kits/:id/export-excel` | Admin-only Excel export (`.xlsx`, styled + RTL) |
| `PATCH` | `/api/kits/:id/ui-preferences` | Persist viewer UI state with `{ ui_preferences }` (`lang`, section/panel maps) |
| `POST` | `/api/telemetry/interaction` | Fire-and-forget interaction telemetry with `{ kit_id, interaction_type, meta? }` |
| `POST` | `/api/analytics/wizard-events` | Public ingest with guardrails: per-IP throttling + global/body caps + text-field limits |
| `GET` | `/api/analytics/wizard-summary` | Admin-only wizard telemetry aggregate (`total`, `byName`) |
| `POST` | `/api/auth/agency-admin/login` | Agency admin login (rate-limited; returns `429` + `Retry-After` on throttle) |

Generation quota usage (image/video prompt counters) is consumed only after a successful LLM response and successful kit persistence path.

### Agency mode access behavior

When `APP_EDITION=agency`:

- Public/non-admin access to `/api/kits` and `/api/kits/:id` is blocked.
- Admin access via `scope=all` remains available for internal operations.
- Admin authentication can run without Supabase by using `POST /api/auth/agency-admin/login` (`ADMIN_USERNAME` + `ADMIN_PASSWORD`) and passing `X-Agency-Admin-Session` on admin requests.

### Phase 3 continuity behavior

- Viewer UI state is persisted per kit in `kits.ui_preferences` and restored on reload:
  - `lang`
  - top-level section expansion map
  - grouped posts platform/day expansion maps
- Generation prompt can include an optional **Historical Context** block derived from the latest successful kit for the same owner (bounded/truncated to protect token budget).
- Interaction telemetry is stored first-party in `social_geni.kit_interactions` and is non-blocking (telemetry failures never block core UI actions).

### Phase 4 premium polish behavior

- Viewer card transitions use calibrated motion timing (`framer-motion`) with reduced-motion-safe fallbacks.
- Short-form copy now supports an enhanced Unicode export path (for social platforms like LinkedIn) while preserving normal copy for long-form readability.
- Viewer hotkeys are available in scope:
  - `Cmd/Ctrl + C` copy active block
  - `Cmd/Ctrl + R` regenerate active item
  - `Cmd/Ctrl + Enter` approve/save action context
- Heavy list surfaces (grouped posts + media prompts) use progressive rendering windows to stay responsive on larger kits.
- Expanded card flows preserve focus and scroll context when collapsing back.

### Retry semantics

`/api/kits/:id/retry` performs a full end-to-end regeneration from stored `brief_json`.  
It does **not** patch individual failed nodes in `result_json`.

### Partial regenerate semantics

`/api/kits/:id/regenerate-item` regenerates a single target item (`post`, `image`, or `video`) and merges it back into `result_json` using optimistic concurrency via `row_version`.

### Stream generate semantics (Phase 1)

`/api/kits/generate?stream=1` is additive and does not replace the normal contract.

- Stream emits SSE events in order:
  - `status` (stage updates)
  - `reasoning` (stream-only, bounded rationale trace for UX)
  - `partial` (progressive `result_json` snapshots, light fields first)
  - `complete` (final `KitSummary`)
  - `error` (safe message)
- Idempotency behavior remains the same as standard generate.
- `reasoning` is best-effort and never persisted in `result_json`.
- In production, SSE `error` events are sanitized and do not expose raw server exception text.

---

## Known Future Scope

- Field-level repair endpoint (e.g. `POST /api/kits/:id/repair`)
- Structured validation errors with JSON paths
- Shared schema package/OpenAPI types between client and server

---

## Delivery Phases

1. Generate flow + wizard + dashboard + viewer  
2. `row_version` + retry + notifications + badges/toasts  
3. Rate limiting + baseline security headers + demo mode + RTL/a11y + lazy `KitViewer` + Playwright smoke
