# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Read the warning above first.** This is a modified/future Next.js (`16.2.9`) and React (`19.2.4`) whose APIs may differ from your training data. Before writing framework code (route handlers, config, fonts, metadata, caching), read the relevant guide under `node_modules/next/dist/docs/01-app/` and heed deprecation notices — do not assume the API from memory.

## Commands

Run these from the `apollo-mockup-site/` directory (the project root — where `package.json` lives).

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + TypeScript)

There is **no test runner** configured. Verify changes by running the app.

## Environment

The mockup backend requires `OPENROUTER_API_KEY` (an [OpenRouter](https://openrouter.ai) key) in a gitignored `.env` / `.env.local`. Without it, `POST /api/generate-mockups` returns a 500. The key is read only server-side (`process.env.OPENROUTER_API_KEY`) and is never exposed to the browser — see the frontend/backend split below. The color simplifier needs no key (it runs entirely client-side).

## What the app is

"Apollo Studio" turns one uploaded logo into production-grade apparel mockups. Three independent pieces live on **separate routes**:

1. **Landing page** (`/`) — hero + "how it works" marketing sections. No generation logic; the primary CTA links to `/studio`.
2. **Mockup studio** (`/studio`) — upload a logo, pick products (embroidered/screen-printed shirts, hats, beanies, blankets), tune color/placement/size/scene, and generate a set of AI images per product (a flat product shot, a stitch-level close-up, and an on-model photo).
3. **Color simplifier** (`/simplify`) — a screen-print prep tool that reduces a logo to N solid spot colors via in-browser k-means, so nothing here touches the network.

The whole UI is bilingual (English / 简体中文), toggled at runtime. Language state is **per-page** (each route owns its own `lang` `useState`); switching languages on one page doesn't affect the other.

## Architecture

- **[app/page.js](app/page.js)** — the landing page at route `/`: hero section + "how it works" steps, its own `STRINGS` i18n dict, its own `lang` state. No product/generation logic lives here — the "Try the studio" CTA is a plain link to `/studio`.

- **[app/studio/page.js](app/studio/page.js)** — the mockup studio frontend (one big `"use client"` component) at route `/studio`. Holds all UI state, the product/color/placement/size catalogs, and the `STRINGS` i18n dictionary. **Generation history is an append-only list of immutable `batches`** — each Generate run captures the logo + settings it used and is never mutated, so changing the logo/products and regenerating never destroys earlier results. It calls **only** `/api/generate-mockups`, never OpenRouter directly (this is what keeps the API key server-side).

- **[app/simplify/page.js](app/simplify/page.js)** — thin route wrapper at `/simplify` that renders `SiteHeader` + `ColorSimplifier` + `SiteFooter` with its own `lang` state.

- **[app/api/generate-mockups/route.js](app/api/generate-mockups/route.js)** — the backend Route Handler (`runtime = "nodejs"`, `maxDuration = 120`). This is the heart of the app: a **composable prompt system**. See below.

- **[app/ColorSimplifier.js](app/ColorSimplifier.js)** — self-contained `"use client"` k-means color quantizer (canvas `getImageData` → cluster → snap pixels → `toDataURL`). Uses a seeded PRNG (`mulberry32`) so the same image + color count is deterministic. No server, no API cost. Carries its own copy of the `STRINGS` i18n dict. Rendered only by `app/simplify/page.js`.

- **[app/SiteChrome.js](app/SiteChrome.js)** — shared `SiteHeader` / `SiteFooter` `"use client"` components used by all routes so the nav/footer stay identical across pages. Owns its own `STRINGS` dict (nav labels, lang toggle, footer note) per the i18n convention below. "Studio" and "Simplify" are real `next/link` navigations (`/studio`, `/simplify`), each bolded in the nav when active; "How it works" is a hash link (`/#how`) back to a section on `/`.

- **[app/layout.tsx](app/layout.tsx)** — root layout, Geist fonts, metadata. **[app/globals.css](app/globals.css)** — Tailwind v4 (`@import "tailwindcss"`, `@theme inline`), the `--background`/`--foreground` theme tokens, dark mode via `prefers-color-scheme`, and the `animate-fade-up` / `skeleton-shimmer` utilities the components reference.

### The prompt system (route.js) — read before touching generation

The output quality lives almost entirely in the prompt composition, not the code flow. Key concepts:

- **`PRESETS`** — one entry per product defining its garment, decoration method, default placement/color, which `views` (shots) to produce, and its lifestyle `scene`. Embroidered items get 3 shots (product/closeup/model); screen-print gets 2 (no close-up). A blanket overrides the body-based framing via `productShot` / `modelUsage`.
- **`buildPrompt(preset, view, opts)`** assembles a prompt from named blocks: shot-type + garment/placement + size + method + lighting/background + quality + negatives. Every prompt is then suffixed in `generateOne` with the four global clauses — `PLACEMENT_LOCK`, `LOGO_FIDELITY`, `CONTRAST_ADAPTATION` (and `GARMENT_MATCH` for chained shots). These clauses are the levers for logo faithfulness; edit them deliberately.
- **Chained-generation-for-consistency** (`generateProductSet`): a product's shots are **not** independent. The flat product shot is generated **first**, then its rendered image is passed as a *second reference image* (alongside the logo) to the close-up and on-model shots, with `GARMENT_MATCH` telling the model to copy that exact garment. This is the strongest lock on identical placement/size/color across a product's shots. If the anchor shot fails, the rest fall back to logo-only references. Products run in parallel with each other; shots within a product are chained.
- **Placement/size wording is geometry-precise** because each shot is generated separately and must land the logo in the same spot. Pocket/left-chest placement is sized in absolute inches (so wide logos scale *down* to fit the chest panel instead of drifting to center); centered placement is sized as a % of garment width. Placement (pocket vs center) only applies to `placeable` products (shirts) — hats/beanies always use their natural spot.
- **Resilience**: `fetchWithRetry` retries only transient network codes and 429/502/503/504 (3 attempts, backoff). `generateProductSet` **never throws** — every failure is returned as a per-view result object so one flaky shot can't sink the batch. The frontend renders per-shot error cards.
- **Model constraint** (documented in-file): OpenAI image models reject any request carrying a reference image, and this app *always* sends the logo as a reference — so the `MODEL` must be a Gemini image model (currently `google/gemini-3.1-flash-image`).

## Conventions worth knowing

- **Mixed `.js` / `.tsx`.** App logic is JS (`page.js`, `route.js`, `ColorSimplifier.js`); only `layout.tsx` is TypeScript. `tsconfig` has `allowJs` + `strict`, and the `@/*` path alias maps to the project root.
- **i18n is a plain object, duplicated.** Each client component owns a `STRINGS = { en, zh }` dict and indexes it by a `lang` prop/state. When you add UI copy, add both languages. Language state lives in `page.js` and is passed down (e.g. to `ColorSimplifier`).
- **Images flow as base64 data URLs** end to end: the browser reads the upload with `FileReader.readAsDataURL`, the route returns `b64_json` strings, and the page renders them as `data:image/png;base64,...`. Native `<img>` is used intentionally (with `eslint-disable-next-line @next/next/no-img-element`) because sources are runtime data URLs, not static assets.
