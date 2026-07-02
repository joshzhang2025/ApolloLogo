// app/api/generate-mockups/route.js
// BACKEND — this runs on the server, never in the browser. Your API key stays here.

export const runtime = "nodejs";   // image gen can take >10s; needs Node runtime
export const maxDuration = 120;    // up to three images per product; allow more time (Vercel)

// NOTE: OpenAI's image models (gpt-5.4-image-2 etc.) reject ANY request that
// includes a reference image via their safety system — and this app always sends
// the logo as a reference — so they can't be used here. Gemini image models
// support the reference-logo flow. Confirmed working: gemini-3.1-flash-image.
const MODEL = "google/gemini-3.1-flash-image";

// 1K is sharp enough to zoom in and read stitch/print detail without the long
// gen times (and connection timeouts) that 2K caused. Bump back to "2K" if needed.
const RESOLUTION = "1K";
const OUTPUT_FORMAT = "png";

// Pin a portrait aspect ratio. Without this the model free-chooses per prompt —
// lifestyle/model prompts drift to wide landscape frames, which looks wrong for
// apparel and made shots inconsistent with each other. "3:4" (≈896×1200) is the
// standard vertical apparel crop and keeps every shot the same shape.
const ASPECT_RATIO = "3:4";

// Appended to EVERY prompt so the logo renders identically across all shots.
// This is the main lever for keeping logo colors consistent between images, and
// for stopping the model from "auto-completing" a recognizable brand mark with
// remembered taglines/slogans (e.g. adding "Think Different" to an Apple logo).
const LOGO_FIDELITY =
  " CRITICAL: Reproduce the provided logo EXACTLY as it appears in the reference image — " +
  "identical colors (same exact hues/hex values), shapes, proportions, line weights, and text. " +
  "Do NOT recolor, tint, restyle, crop, or add gradients/shadows/effects to the logo artwork itself. " +
  "Reproduce ONLY the artwork that is actually visible in the reference image. Do NOT add any text, " +
  "words, letters, taglines, slogans, company names, or extra symbols/graphics that are not already " +
  "present in the reference — if the reference has no text, the mockup must have no text. Even if you " +
  "recognize the logo as belonging to a real brand, never complete it from memory with a slogan, " +
  "wordmark, or additional marks. The decorated garment must show the reference artwork and nothing else. " +
  "The logo must look pixel-for-pixel the same across every mockup.";

// Deterministic seed per product so every shot of a product samples colors from
// the same starting point, improving cross-image consistency.
function seedFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 2147483647;
}

// ---------------------------------------------------------------------------
// COMPOSABLE PROMPT SYSTEM
// finalPrompt = SHOT_TYPE + GARMENT/PLACEMENT + METHOD + LIGHTING_BG + QUALITY
//               + NEGATIVES (folded into the prompt as an avoid-clause, since
//               Gemini image models have no separate negative_prompt channel)
// ---------------------------------------------------------------------------

// A. Shot-type blocks for the FLAT shots. The model shot is built separately
//    (see buildPrompt) because it reads best as one flowing lifestyle sentence.
//    - product: verifies placement, scale, garment color
//    - closeup: what embroidery jobs get approved/rejected on — stitch quality
const SHOT_TYPES = {
  product:
    "Professional e-commerce product photography, garment shown flat-lay or on an invisible " +
    "ghost mannequin, straight-on centered angle, entire product in frame, even soft studio " +
    "lighting, no harsh shadows, high resolution, sharp focus across the whole garment.",
  closeup:
    "Macro close-up product photography, tight crop centered on the decorated area only, " +
    "filling most of the frame, slightly angled raking light to reveal surface texture and " +
    "dimensionality, extremely sharp focus, visible fabric weave.",
};

// D. Method blocks — this is the part that fixes the "looks printed" problem.
const METHODS = {
  embroidery:
    "Rendered as genuine machine embroidery: raised satin-stitch and fill-stitch texture with " +
    "visible individual thread lines and directional sheen, slight natural fabric puckering " +
    "around the stitched area, thread colors matched to the nearest standard embroidery thread " +
    "palette rather than exact flat color, no smooth gradients — colors appear as distinct " +
    "stitched color blocks, fine text rendered bold and simplified enough to be legible at " +
    "embroidery scale, subtle dimensional thickness where stitching sits above the fabric surface.",
  // Caps — 3D puff on the main elements, flat satin detail around them.
  embroideryPuff:
    "Rendered as genuine machine embroidery: raised satin-stitch and fill-stitch texture with " +
    "visible individual thread lines and directional sheen, thread colors matched to the nearest " +
    "standard embroidery thread palette rather than exact flat color, no smooth gradients — " +
    "colors appear as distinct stitched color blocks, fine text rendered bold and simplified " +
    "enough to be legible at embroidery scale. The main lettering/logo elements are raised " +
    "significantly above the fabric on a foam base, giving a bold 3D puffed appearance with soft " +
    "rounded edges on the raised sections, flatter satin-stitch detail work surrounding the " +
    "puffed elements.",
  // Beanies — flat embroidery on stretch knit; avoid puff language, watch puckering.
  embroideryKnit:
    "Rendered as flat machine embroidery directly on ribbed knit fabric, stitching following the " +
    "knit's rib texture, moderate stitch density to avoid excessive fabric puckering or knit " +
    "distortion, thread colors matched to the nearest standard embroidery thread palette, clean " +
    "stitch edges despite the stretch-knit surface.",
  screenprint:
    "Rendered as screen-printed ink: flat, opaque ink layer sitting on top of the fabric surface, " +
    "sharp clean vector-like edges, slight visible ink texture on close inspection, no thread or " +
    "stitch texture of any kind, colors as flat distinct spot-color layers, ink slightly absorbed " +
    "into the fabric grain on light garments and sitting more visibly on top with an underbase " +
    "on dark garments.",
};

// Short one-line method note for the on-model shot. The full METHODS blocks above
// are macro/texture-focused and read wrong on a full-body lifestyle photo, so the
// model shot gets this lighter descriptor instead (matches the original wording).
const METHOD_SHORT = {
  embroidery: "Realistic raised satin-stitch embroidery with visible threads.",
  embroideryPuff: "Raised 3D puff embroidery with visible thread rows.",
  embroideryKnit: "Flat embroidery, thread texture visible against the knit.",
  screenprint: "Flat matte screen-printed ink finish.",
};

// E. Background/lighting + quality tags. LIGHTING_BG is skipped on model shots —
//    the model shot-type block carries its own backdrop/lighting wording (and the
//    scene toggle may replace it).
const LIGHTING_BG =
  "Clean neutral light grey studio background, soft diffused lighting, no distracting props.";
const QUALITY_TAGS =
  "Photorealistic, high detail, 4k, commercial product photography quality.";

// F. Negatives — sent on every shot regardless of method; critical for embroidery.
//    Gemini has no negative_prompt parameter, so these ride inside the prompt.
const NEGATIVE_BASE =
  "flat vector logo look, sticker-like drop shadow, floating or detached design, warped or " +
  "blurred text, incorrect garment color, extra logos or watermarks, distorted garment shape, " +
  "low resolution, cropped incorrectly";
const NEGATIVE_METHOD = {
  embroidery: ", glossy print sheen, smooth gradient fills, perfectly flat texture, printed-looking edges",
  screenprint: ", raised thread texture, stitching, puckered fabric",
};

// The logo must occupy the SAME fraction of the garment in every shot. A bare
// "small/large" is interpreted differently per image, so we anchor size to a
// concrete proportion of the garment and append this identical clause to all
// of a product's prompts.
const SIZE_WORDING = {
  small: "The logo is small, spanning about 15% of the garment's front width",
  medium: "The logo is medium, spanning about 30% of the garment's front width",
  large: "The logo is large, spanning about 55% of the garment's front width",
};
function sizeClause(size) {
  const spec = SIZE_WORDING[size] || SIZE_WORDING.medium;
  return ` ${spec}. Render the logo at this exact same scale relative to the garment in every shot.`;
}

// How each placement choice reads in the prompt. Anything unknown falls back to
// the product's natural `defaultPlacement`. Kept garment-neutral so "center" also
// reads sensibly on a cap front panel or beanie cuff, not just a shirt.
const PLACEMENT_WORDING = {
  pocket: "on the wearer's upper-left chest, in the classic left-chest / pocket logo position",
  center: "centered on the front of the garment",
};

// B/C. Garment + default-placement blocks per product, plus which shots to make.
// Embroidered products get THREE shots (product, closeup, model) — texture/thread
// quality is the whole approval question and the close-up is what customers
// approve or reject on. Screenprint gets TWO (product, model) — ink is flatter
// and more predictable, so a close-up earns less.
const PRESETS = {
  "shirt-embroidered": {
    label: "Shirt — Embroidered",
    defaultColor: "heather-gray",
    garment: "a {COLOR} cotton crewneck t-shirt",
    decor: "EMBROIDERED",
    defaultPlacement: "on the left chest, centered a couple of inches below the collar seam",
    method: "embroidery",
    negative: "embroidery",
    views: ["product", "closeup", "model"],
    scene: "a warm modern coffee-shop interior with plants, softly blurred behind the model",
  },
  "shirt-screenprint": {
    label: "Shirt — Screen Print",
    defaultColor: "black",
    garment: "a {COLOR} cotton crewneck t-shirt",
    decor: "SCREEN PRINTED",
    defaultPlacement: "centered on the chest",
    method: "screenprint",
    negative: "screenprint",
    views: ["product", "model"],
    scene: "a sunny city street with storefronts and warm daylight, softly blurred behind the model",
  },
  "hat-embroidered": {
    label: "Hat — Embroidered",
    defaultColor: "navy",
    garment: "a structured {COLOR} six-panel baseball cap with a curved brim",
    decor: "EMBROIDERED",
    defaultPlacement: "on the front center panel, gently curved to follow the panel's shape",
    method: "embroideryPuff",
    negative: "embroidery",
    views: ["product", "closeup", "model"],
    scene: "a sunlit park with green trees and bright natural daylight, softly blurred behind the model",
  },
  "beanie-embroidered": {
    label: "Beanie — Embroidered",
    defaultColor: "charcoal",
    garment: "a {COLOR} ribbed knit cuffed beanie",
    decor: "EMBROIDERED",
    defaultPlacement: "flat on the folded cuff, centered",
    method: "embroideryKnit",
    negative: "embroidery",
    views: ["product", "closeup", "model"],
    scene: "a crisp autumn street with warm golden light and soft bokeh, softly blurred behind the model",
  },
};

// Compose one shot's full prompt from the blocks above.
function buildPrompt(preset, view, { color, placement, size, sceneOn }) {
  // Garment + placement + size. "this logo" points the model at the reference image.
  const garment = preset.garment.replaceAll(
    "{COLOR}",
    (color && String(color).trim()) || preset.defaultColor
  );
  const placementText = (placement && PLACEMENT_WORDING[placement]) || preset.defaultPlacement;
  const sizeAdj = size === "small" ? "small " : size === "large" ? "large " : "";

  // Model shot — one flowing lifestyle sentence, like the original. It uses the
  // short method note (not the heavy macro block) and swaps in the lifestyle
  // scene only when the toggle is on; otherwise a plain, empty studio backdrop
  // (no environment) so "scene off" reads as a truly blank background.
  if (view === "model") {
    const background =
      sceneOn && preset.scene
        ? preset.scene
        : "a plain, empty seamless light-grey studio backdrop, completely blank with no scenery, " +
          "props, furniture, windows, or background objects of any kind";
    return (
      "Professional high-resolution lifestyle photo of a real human model wearing " +
      garment +
      `, this ${sizeAdj}logo ${preset.decor} ${placementText}. ` +
      METHOD_SHORT[preset.method] +
      ` Natural relaxed pose, flattering studio lighting, ${background}, shallow depth of field, ` +
      "photorealistic." +
      sizeClause(size)
    );
  }

  // Flat shots (product, closeup) — the detailed, texture-forward composable prompt.
  const subject = `The garment is ${garment} with this ${sizeAdj}logo ${preset.decor} ${placementText}.`;
  const negatives = ` Strictly avoid: ${NEGATIVE_BASE}${NEGATIVE_METHOD[preset.negative] || ""}.`;
  return (
    SHOT_TYPES[view] +
    " " + subject +
    sizeClause(size) +
    " " + METHODS[preset.method] +
    " " + LIGHTING_BG +
    " " + QUALITY_TAGS +
    negatives
  );
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
      aspect_ratio: ASPECT_RATIO,
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

    const { logo, product, products, color, scene, placement, size } = await req.json();
    if (!logo) return Response.json({ error: "No logo provided" }, { status: 400 });

    // Accept a single `product` (click-to-generate) or a `products` array; default to all.
    const requested = products?.length ? products : product ? [product] : Object.keys(PRESETS);
    const keys = requested.filter((k) => PRESETS[k]);
    if (!keys.length) return Response.json({ error: "No valid products selected" }, { status: 400 });

    // For each product, fire ALL of its shots in parallel. keysForTask mirrors
    // `tasks` so a rejected promise can still report which product/view it was.
    const tasks = [];
    const keysForTask = [];
    for (const k of keys) {
      const p = PRESETS[k];
      const seed = seedFor(k); // same seed for every shot of this product
      for (const view of p.views) {
        const prompt = buildPrompt(p, view, { color, placement, size, sceneOn: scene });
        tasks.push(generateOne(k, p.label, view, prompt, logo, seed));
        keysForTask.push({ productKey: k, label: p.label, view });
      }
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
