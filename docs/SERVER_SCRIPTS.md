# Server Scripts Catalog

Central reference for server-side operational scripts under `server/scripts/`.

## Scope and usage

- Run from repository root unless noted otherwise.
- These scripts are intended for debugging/export operations and are not part of normal request handling.
- Use production-like credentials with care and prefer local/staging datasets first.

## Scripts

| Script | Purpose | Typical use |
|---|---|---|
| `server/scripts/debug-latest-pdf-export.ts` | Debug PDF export for the latest kit in DB | Reproduce PDF rendering issues against newest record |
| `server/scripts/debug-prod-pdf-export.ts` | Validate PDF export flow against production-target behavior | Diagnose prod-only PDF breakages |
| `server/scripts/debug-prod-kit-local-pdf.ts` | Generate PDF locally from a prod-like kit payload | Isolate layout/font/RTL issues outside live API calls |
| `server/scripts/export-latest-admin-kits-pdfs.ts` | Batch export latest admin-visible kits as PDFs | Manual QA pack generation or stakeholder review drops |
| `server/scripts/export-largest-real-kit-fixture.ts` | Export the largest real kit as fixture data | Stress-test viewer/export paths with worst-case payloads |
| `server/scripts/generate-max-kit-pdf.ts` | Generate PDF from max-size synthetic/fixture-like content | Capacity/performance testing for PDF renderer |

## Related docs

- Run/test gates: [`TESTING.md`](TESTING.md)
- Product/API overview: [`../README.md`](../README.md)
- Prompt/response constraints that affect export content: [`GEMINI_PROMPTS.md`](GEMINI_PROMPTS.md)
