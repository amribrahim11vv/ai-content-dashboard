# Project Brief: AI Content Dashboard 🚀

A premium, full-stack AI-powered content strategy and asset generation platform. This dashboard empowers brands to generate high-fidelity marketing kits—including social media plans, AI image prompts, and video strategies—tailored to their specific industry and budget.

---

## 1. Product Vision 👁️
The **AI Content Dashboard** is designed to be the "Creative Director in a Box" for small to medium-sized agencies and brands. It bridges the gap between raw AI potential and practical marketing execution by applying industry-specific visual psychology and Egyptian-market-aware brand logic.

### Core Value Propositions:
- **Instant High-Fidelity Strategy**: Move from a brief to a full monthly content plan in under 60 seconds.
- **Visual Excellence**: Professional-grade AI prompts (for Midjourney/DALL-E) that include camera angles, lighting, and aspect ratios.
- **Budget-Aware Action**: Generation logic that adapts the content mix based on the client's spending level (Organic vs. High-Paid).

---

## 2. Key Features 🛠️

### 🔮 The Content Wizard
A guided 6-step experience that extracts the "Brand Essence":
1.  **Identity**: Brand name and industry.
2.  **Context**: Target audience and competitors.
3.  **Ambition**: Main goal and active platforms.
4.  **Style**: Brand tone and colors.
5.  **Focus**: Current offer/message and visual notes.
6.  **Configuration**: Campaign duration, budget, and content counts.

> [!NOTE]
> **Draft Persistence**: The wizard features automatic `localStorage` saving. Users can close the tab mid-wizard and resume exactly where they left off.

### 📊 Tactical Dashboard
A central hub for tracking all generated marketing kits.
- **Status Badges**: Real-time tracking (`Generating`, `Completed`, `Failed`).
- **History**: Quick access to all past strategies for brand consistency.

### 🖼️ The Kit Viewer
A deep-dive interface for viewing generated assets:
- **Social Posts**: Hook-first captions (Arabic/Egyptian Dialect) with hashtag strategies.
- **Visual Design**: Technical prompts for high-end AI image generation.
- **Video Strategy**: Scene-by-scene scripts and camera move instructions for short-form video (TikTok/Reels).
- **Growth System**: Actionable marketing tasks and objection handling for sales teams.

---

## 3. Technical Architecture 🏗️

### **Frontend (The Client)**
- **Framework**: React 19 + Vite.
- **Styling**: Vanilla CSS + Tailwind for a "Glassmorphic" premium aesthetic.
- **Icons**: Custom Lucide-React integration.
- **State Management**: Local component state + focused hooks (`useWizardOrchestrator`, `useRecentSearches`, `useThemeMode`).

### **Backend (The BFF)**
- **Engine**: Hono (Lightweight, ultra-fast, and edge-ready).
- **Communication**: REST API with Bearer token authentication.
- **Database**: PostgreSQL + **Drizzle ORM**.
- **Data Layer**: Separated modules for connection/migrations/seeds and standardized route-level HTTP error mapping.

### **AI Execution**
- **Model**: Google Gemini Pro.
- **Prompt Engineering**: 
    - **Industry Modules**: Specialist rules for Real Estate, Restaurants, Clinics, E-commerce, Fashion, and Education.
    - **Arabic Brand Logic**: Custom logic to maintain correct Arabic spelling and Egyptian-dialect hooks for the MENA market.
    - **Structured Output**: Enforced JSON schema for zero-fail parsing.
    - **Retry Semantics**: Retries are scoped to transient transport/network failures only.

### **Dependency Baseline (Current)**
- `drizzle-orm@1.0.0-beta.21`
- `drizzle-kit@1.0.0-beta.21`
- Selected to fully resolve security advisories while keeping Drizzle CLI workflows operational.

---

## 4. Engineering Excellence 🛡️

### **Idempotency & Reliability**
- **Idempotency Keys**: Every generation request is locked with a unique key to prevent duplicate costs or database entries during network retries.
- **Retry Mechanics**: Support for `failed_generation` recovery using `row_version` concurrency control.
- **Input Validation**: Double-layer validation using **Zod** (Frontend and Backend) ensuring the LLM always receives high-quality context.
- **Route Error Consistency**: Unified HTTP error response mapping across API routes.

### **Performance**
- **Lazy Loading**: Heavy components like `KitViewer` are code-split.
- **Edge-Ready Architecture**: The Hono server is designed to run on Cloudflare Workers or Node.js with minimal changes.
- **Query Efficiency**: N+1 pattern removed from prompt catalog industry listing endpoint.

---

## 5. Design System 🎨
The UI follows the **Stitch Design Philosophy**:
- **Palette**: Sleek Dark Mode with harmonious accents (Indigo/Cyan).
- **Typography**: Inter/Outfit for modern, readable hierarchies.
- **Micro-animations**: Smooth hover effects and loading transitions to enhance the "Premium AI" feel.

---

## 6. Getting Started 🏁
1.  **Clone & Install**: `npm install`
2.  **Environment**: 
    - `server/.env`: Provide `GEMINI_API_KEY` and `API_SECRET`.
    - `client/.env.local`: Provide `VITE_API_URL` and optional `VITE_DEMO_MODE`.
    - For local Postgres chains with self-signed certificates: set `DB_SSL_INSECURE=true` in `server/.env`.
3.  **Development**: `npm run dev`
4.  **Tests**: `npm run test:e2e` for Playwright validation.

---
*Created by Antigravity AI Engineering & Design.*
