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
2. **Mockup studio** (`/studio`) — upload a logo AND a photo of the actual product, pick the decoration method (embroidered / screen print), multi-select which shots to generate (flat product shot, stitch-level close-up, on-model photo), tune placement/size/scene, and generate. There is no product catalog — the uploaded product photo IS the product.
3. **Color simplifier** (`/simplify`) — a screen-print prep tool that reduces a logo to N solid spot colors via in-browser k-means, so nothing here touches the network.

The whole UI is bilingual (English / 简体中文), toggled at runtime. Language state is **per-page** (each route owns its own `lang` `useState`); switching languages on one page doesn't affect the other.

## Architecture

- **[app/page.js](app/page.js)** — the landing page at route `/`: hero section + "how it works" steps, its own `STRINGS` i18n dict, its own `lang` state. No product/generation logic lives here — the "Try the studio" CTA is a plain link to `/studio`.

- **[app/studio/page.js](app/studio/page.js)** — the mockup studio frontend (one big `"use client"` component) at route `/studio`. Holds all UI state, the method/view/placement/size catalogs, and the `STRINGS` i18n dictionary. Two `UploadZone`s (logo + product photo), a method segmented control, and a multi-select of shot types (`views`). **Generation history is an append-only list of immutable `batches`** — each Generate run captures the two images + settings it used and is never mutated, so changing the inputs and regenerating never destroys earlier results. It calls **only** `/api/generate-mockups`, never OpenRouter directly (this is what keeps the API key server-side).

- **[app/simplify/page.js](app/simplify/page.js)** — thin route wrapper at `/simplify` that renders `SiteHeader` + `ColorSimplifier` + `SiteFooter` with its own `lang` state.

- **[app/api/generate-mockups/route.js](app/api/generate-mockups/route.js)** — the backend Route Handler (`runtime = "nodejs"`, `maxDuration = 120`). This is the heart of the app: a **composable prompt system**. See below.

- **[app/ColorSimplifier.js](app/ColorSimplifier.js)** — self-contained `"use client"` k-means color quantizer (canvas `getImageData` → cluster → snap pixels → `toDataURL`). Uses a seeded PRNG (`mulberry32`) so the same image + color count is deterministic. No server, no API cost. Carries its own copy of the `STRINGS` i18n dict. Rendered only by `app/simplify/page.js`.

- **[app/SiteChrome.js](app/SiteChrome.js)** — shared `SiteHeader` / `SiteFooter` `"use client"` components used by all routes so the nav/footer stay identical across pages. Owns its own `STRINGS` dict (nav labels, lang toggle, footer note) per the i18n convention below. "Studio" and "Simplify" are real `next/link` navigations (`/studio`, `/simplify`), each bolded in the nav when active; "How it works" is a hash link (`/#how`) back to a section on `/`.

- **[app/layout.tsx](app/layout.tsx)** — root layout, Geist fonts, metadata. **[app/globals.css](app/globals.css)** — Tailwind v4 (`@import "tailwindcss"`, `@theme inline`), the `--background`/`--foreground` theme tokens, dark mode via `prefers-color-scheme`, and the `animate-fade-up` / `skeleton-shimmer` utilities the components reference.

### The prompt system (route.js) — read before touching generation

The output quality lives almost entirely in the prompt composition, not the code flow. Key concepts:

- **Two reference images, always**: every shot is generated with the logo (first reference) and the customer's product photo (second reference). `PRODUCT_REFERENCE` tells the model the second reference IS the product to decorate — no catalog, no garment presets.
- **`buildPrompt(view, opts)`** assembles a prompt from named blocks: shot-type + product/placement + size + method + lighting/background + quality + negatives. Every prompt is then suffixed in `generateOne` with the global clauses — `PLACEMENT_LOCK`, `LOGO_FIDELITY`, `PRODUCT_REFERENCE`, `CONTRAST_ADAPTATION` (and `DECORATED_MATCH` for chained shots). These clauses are the levers for logo/product faithfulness; edit them deliberately.
- **`views` are user-selected**: the request carries any subset of `["product", "closeup", "model"]` (`VIEW_ORDER`); only those shots are generated.
- **Chained-generation-for-consistency** (`generateShotSet`): when the flat product shot is among the requested views it is generated **first**, then its rendered image is passed as a *third reference image* (alongside logo + product photo) to the close-up and on-model shots, with `DECORATED_MATCH` telling the model to copy that exact decorated item. If the anchor shot fails or wasn't requested, the rest fall back to logo+product references and run in parallel.
- **Placement/size wording is geometry-precise** because each shot is generated separately and must land the logo in the same spot. Pocket/left-chest placement is sized in absolute inches (so wide logos scale *down* to fit the chest panel instead of drifting to center); default/centered placement is sized as a % of the product's front width. `"default"` placement lets the model pick the product's natural decoration spot.
- **Drawn placement marker**: the user can drag a circle onto the product photo (`MarkerEditor` in the studio page). The circle overrides placement AND size, and travels to the backend two ways at once: as numbers (`marker: {x, y, r}`, fractions of the photo — fed into the prompt as "X% from the left / Y% from the top / spans W% of width") and as `markerImage`, an annotated copy of the product photo with a magenta ring drawn on it (rendered client-side by `makeMarkerImage`), sent as the THIRD reference image with the `MARKER_REFERENCE` clause. Both halves must be present or the marker is ignored.
- **Resilience**: `fetchWithRetry` retries only transient network codes and 429/502/503/504 (3 attempts, backoff). `generateShotSet` **never throws** — every failure is returned as a per-view result object so one flaky shot can't sink the batch. The frontend renders per-shot error cards.
- **Model constraint** (documented in-file): OpenAI image models reject any request carrying a reference image, and this app *always* sends the logo + product photo as references — so the `MODEL` must be a Gemini image model (currently `google/gemini-3.1-flash-image`).

## Conventions worth knowing

- **Mixed `.js` / `.tsx`.** App logic is JS (`page.js`, `route.js`, `ColorSimplifier.js`); only `layout.tsx` is TypeScript. `tsconfig` has `allowJs` + `strict`, and the `@/*` path alias maps to the project root.
- **i18n is a plain object, duplicated.** Each client component owns a `STRINGS = { en, zh }` dict and indexes it by a `lang` prop/state. When you add UI copy, add both languages. Language state lives in `page.js` and is passed down (e.g. to `ColorSimplifier`).
- **Images flow as base64 data URLs** end to end: the browser reads the upload with `FileReader.readAsDataURL`, the route returns `b64_json` strings, and the page renders them as `data:image/png;base64,...`. Native `<img>` is used intentionally (with `eslint-disable-next-line @next/next/no-img-element`) because sources are runtime data URLs, not static assets.
