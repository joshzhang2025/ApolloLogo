// app/api/generate-mockups/route.js
// BACKEND — this runs on the server, never in the browser. Your API key stays here.

export const runtime = "nodejs";   // image gen can take >10s; needs Node runtime
export const maxDuration = 120;    // two images per product; allow more time (Vercel)

// NOTE: OpenAI's image models (gpt-5.4-image-2 etc.) reject ANY request that
// includes a reference image via their safety system — and this app always sends
// the logo as a reference — so they can't be used here. Gemini image models
// support the reference-logo flow. Confirmed working: gemini-3.1-flash-image.
const MODEL = "google/gemini-3.1-flash-image";

// 1K is sharp enough to zoom in and read stitch/print detail without the long
// gen times (and connection timeouts) that 2K caused. Bump back to "2K" if needed.
const RESOLUTION = "1K";
const OUTPUT_FORMAT = "png";

// Appended to EVERY prompt so the logo renders identically across both shots.
// This is the main lever for keeping logo colors consistent between images.
const LOGO_FIDELITY =
  " CRITICAL: Reproduce the provided logo EXACTLY as it appears in the reference image — " +
  "identical colors (same exact hues/hex values), shapes, proportions, line weights, and text. " +
  "Do NOT recolor, tint, restyle, crop, or add gradients/shadows/effects to the logo artwork itself. " +
  "The logo must look pixel-for-pixel the same across every mockup.";

// Deterministic seed per product so the product shot and the on-model shot
// sample colors from the same starting point, improving cross-image consistency.
function seedFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 2147483647;
}

// Each product produces TWO shots: a clean product-only photo, and an on-model photo.
// Material realism is all in the wording.
// `{COLOR}` is replaced at request time with the garment color the user picked
// (or `defaultColor` when they leave it on "Default").
const PRESETS = {
  "shirt-embroidered": {
    label: "Shirt — Embroidered",
    defaultColor: "heather-gray",
    product:
      "Professional high-resolution e-commerce product photo of a {COLOR} cotton t-shirt laid flat, " +
      "this logo EMBROIDERED on the left chest. Realistic raised satin-stitch embroidery with visible " +
      "individual threads, slight sheen, stitch direction following the logo shapes. Soft studio lighting, " +
      "clean light-gray background, subtle shadow, sharp focus.",
    model:
      "Professional high-resolution lifestyle photo of a real human model wearing a {COLOR} cotton " +
      "t-shirt, this logo EMBROIDERED on the left chest. Realistic raised satin-stitch embroidery with " +
      "visible threads. Natural pose, flattering studio lighting, clean neutral background, shallow depth " +
      "of field, photorealistic.",
  },
  "shirt-screenprint": {
    label: "Shirt — Screen Print",
    defaultColor: "black",
    product:
      "Professional high-resolution e-commerce product photo of a {COLOR} cotton t-shirt laid flat, this logo " +
      "SCREEN PRINTED centered on the chest. Flat matte ink finish on the fabric surface, weave faintly " +
      "visible through the print, no sheen. Soft studio lighting, clean background, sharp focus.",
    model:
      "Professional high-resolution lifestyle photo of a real human model wearing a {COLOR} cotton t-shirt, " +
      "this logo SCREEN PRINTED centered on the chest. Flat matte ink finish. Natural pose, flattering " +
      "studio lighting, clean neutral background, shallow depth of field, photorealistic.",
  },
  "hat-embroidered": {
    label: "Hat — Embroidered",
    defaultColor: "navy",
    product:
      "Professional high-resolution e-commerce product photo, front view of a structured {COLOR} baseball cap, " +
      "this logo EMBROIDERED on the front panel. 3D puff embroidery with visible thread rows and raised " +
      "texture. Studio lighting, clean neutral background, sharp focus.",
    model:
      "Professional high-resolution lifestyle photo of a real human model wearing a structured {COLOR} baseball " +
      "cap, this logo EMBROIDERED on the front panel with raised 3D puff embroidery. Natural pose, flattering " +
      "studio lighting, clean neutral background, shallow depth of field, photorealistic.",
  },
  "beanie-embroidered": {
    label: "Beanie — Embroidered",
    defaultColor: "charcoal",
    product:
      "Professional high-resolution product photo of a folded {COLOR} knit beanie, this logo EMBROIDERED on " +
      "the cuff. Flat embroidery on ribbed knit fabric, thread texture visible against the wool. Studio " +
      "lighting, clean background, sharp focus.",
    model:
      "Professional high-resolution lifestyle photo of a real human model wearing a {COLOR} knit beanie, " +
      "this logo EMBROIDERED on the cuff. Thread texture visible against the wool. Natural pose, flattering " +
      "studio lighting, clean neutral background, shallow depth of field, photorealistic.",
  },
};

// Replace the {COLOR} token; fall back to the product's natural default color.
function withColor(template, color, defaultColor) {
  const c = (color && String(color).trim()) || defaultColor;
  return template.replaceAll("{COLOR}", c);
}

async function generateOne(productKey, label, view, prompt, reference, seed) {
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt + LOGO_FIDELITY,
      seed,
      resolution: RESOLUTION,
      output_format: OUTPUT_FORMAT,
      // OpenRouter expects reference images as ContentPartImage objects,
      // not bare strings. `reference` is a data URL or https URL of the logo.
      input_references: [
        { type: "image_url", image_url: { url: reference } },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) return { productKey, label, view, ok: false, error: data.error ?? data };
  // return base64 strings; the page turns them into <img> data URLs
  return { productKey, label, view, ok: true, images: (data.data ?? []).map((d) => d.b64_json) };
}

export async function POST(req) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json({ error: "Server is missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const { logo, product, products, color } = await req.json();
    if (!logo) return Response.json({ error: "No logo provided" }, { status: 400 });

    // Accept a single `product` (click-to-generate) or a `products` array; default to all.
    const requested = products?.length ? products : product ? [product] : Object.keys(PRESETS);
    const keys = requested.filter((k) => PRESETS[k]);
    if (!keys.length) return Response.json({ error: "No valid products selected" }, { status: 400 });

    // For each product, fire BOTH the product shot and the on-model shot in parallel.
    // keysForTask mirrors `tasks` so a rejected promise can still report which
    // product/view it belonged to.
    const tasks = [];
    const keysForTask = [];
    for (const k of keys) {
      const p = PRESETS[k];
      const seed = seedFor(k); // same seed for both shots of this product
      const productPrompt = withColor(p.product, color, p.defaultColor);
      const modelPrompt = withColor(p.model, color, p.defaultColor);
      tasks.push(generateOne(k, p.label, "product", productPrompt, logo, seed));
      keysForTask.push({ productKey: k, label: p.label, view: "product" });
      tasks.push(generateOne(k, p.label, "model", modelPrompt, logo, seed));
      keysForTask.push({ productKey: k, label: p.label, view: "model" });
    }

    // allSettled so one flaky/slow image call can't sink the whole batch —
    // the images that DID succeed still come back and render.
    const settled = await Promise.allSettled(tasks);
    const results = settled.map((s, i) => {
      if (s.status === "fulfilled") return s.value;
      const e = s.reason;
      const detail = e?.cause?.code ? `${e.message} (${e.cause.code})` : String(e?.message ?? e);
      return { ...keysForTask[i], ok: false, error: detail };
    });
    return Response.json({ results });
  } catch (e) {
    const detail = e?.cause?.code ? `${e.message} (${e.cause.code})` : String(e?.message ?? e);
    return Response.json({ error: detail }, { status: 500 });
  }
}
