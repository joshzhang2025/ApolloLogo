// app/api/generate-mockups/route.js
// BACKEND — this runs on the server, never in the browser. Your API key stays here.

export const runtime = "nodejs";   // image gen can take >10s; needs Node runtime
export const maxDuration = 120;    // up to three shots per request; allow more time (Vercel)

// NOTE: OpenAI's image models (gpt-5.4-image-2 etc.) reject ANY request that
// includes a reference image via their safety system — and this app always sends
// the logo AND the product photo as references — so they can't be used here.
// Gemini image models support the reference-image flow. Confirmed working:
// gemini-3.1-flash-image.
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

// Appended to EVERY prompt so the logo renders consistently across all shots.
// This is the main lever for keeping the logo faithful between images, and for
// stopping the model from "auto-completing" a recognizable brand mark with
// remembered taglines/slogans (e.g. adding "Think Different" to an Apple logo).
// The ONE allowed change to logo colors is the contrast rule — normally the
// per-request colorSpecClause (exact hexes, computed below), falling back to
// the text-only CONTRAST_ADAPTATION when the client couldn't extract a palette.
const LOGO_FIDELITY =
  " CRITICAL: Reproduce the provided logo EXACTLY as it appears in the logo reference image — " +
  "same shapes, proportions, line weights, and text, and the same colors as the reference (except " +
  "where the contrast rule below requires a color change so the logo stays visible). " +
  "Do NOT restyle, crop, distort, or add gradients/shadows/effects to the logo artwork itself. " +
  "Reproduce ONLY the artwork that is actually visible in the logo reference. Do NOT add any text, " +
  "words, letters, taglines, slogans, company names, or extra symbols/graphics that are not already " +
  "present in the reference — if the reference has no text, the mockup must have no text. Even if you " +
  "recognize the logo as belonging to a real brand, never complete it from memory with a slogan, " +
  "wordmark, or additional marks. The decorated product must show the reference artwork and nothing else. " +
  "COLOR CONSISTENCY (very important): render the logo in its exact reference colors, and render those " +
  "colors IDENTICALLY in every shot — the logo must be the same color in the product, close-up, and " +
  "on-model images, with no hue shift, tint, brightness change, thread-palette substitution, or " +
  "reinterpretation from one shot to the next. Keep the logo's shapes, layout, proportions, AND colors " +
  "identical across every mockup.";

// Appended to EVERY prompt, right after LOGO_FIDELITY. The customer uploads a
// photo of THEIR actual product, and the whole point is that the mockup shows
// that exact item — not a generic stand-in the model invents.
const PRODUCT_REFERENCE =
  " PRODUCT REFERENCE: The FIRST reference image is the logo artwork. The SECOND reference image is a " +
  "photo of the customer's ACTUAL product. The mockup must show THIS exact product — identical product " +
  "type, shape, silhouette, color, material, texture, construction details, seams, hardware, and trims. " +
  "Do NOT substitute a different or generic product, and do NOT change the product's color, fabric, or " +
  "design in any way — the ONLY change from the product reference is the added logo decoration described " +
  "here. Ignore the product reference photo's background, framing, camera angle, and lighting; reproduce " +
  "only the product itself.";

// FALLBACK ONLY — used when the client couldn't extract a logo palette (e.g.
// canvas read failure). Real embroidery/screen-print shops recolor any part of
// a design that matches the product (and would vanish into it) to a contrasting
// thread/ink — e.g. black outlines become white on a black shirt. This tells the
// model to do the same, for ANY product color. The problem this exists to solve
// — that recolor/no-recolor is a judgment call the model can make differently
// per shot — is exactly what colorSpecClause below fixes by computing the
// substitution once, in code, and handing the model a closed hex-to-hex table.
const CONTRAST_ADAPTATION =
  " CONTRAST FOR VISIBILITY: The finished logo must stay clearly visible against the product's color " +
  "as shown in the product reference photo. If any part of the logo is close in color to the product — " +
  "so it would blend in and be hard to see (for example black lines/outlines on a black or navy product, " +
  "or a white fill on a white or cream product) — recolor ONLY those low-contrast parts, and recolor " +
  "them to a SINGLE FIXED contrasting color: pure white (#FFFFFF) on dark or medium-dark products, or " +
  "solid black (#000000) on white or light products (on a true mid-tone product, use whichever of pure " +
  "white or solid black contrasts more). Use that exact same contrast color in EVERY shot so all images " +
  "match. Leave every logo part that already contrasts well with the product in its original reference " +
  "color, and change nothing about the logo's shapes, proportions, layout, or text — adjust only the " +
  "specific colors that would otherwise disappear. The whole logo must read crisply and identically " +
  "across all shots.";

// ---------------------------------------------------------------------------
// DETERMINISTIC COLOR SPEC — the actual fix for cross-shot color drift.
// The client (studio/page.js, via colorUtils.js) extracts the logo's exact hex
// palette and samples the product's color where the logo will sit, and sends
// both here. Instead of asking the model to judge "is this low-contrast?" and
// "what should I substitute?" separately for every shot — a judgment call that
// can land differently each time — we compute the substitution ONCE in code
// (WCAG-style contrast ratio) and hand every shot the identical closed hex-to-
// hex table. There is nothing left for the model to decide.
// ---------------------------------------------------------------------------

// Below this contrast ratio a logo color is treated as "would blend into the
// product" and gets substituted. 1.8 is intentionally low (WCAG AA text uses
// 4.5) — this only catches genuinely near-invisible pairings (e.g. near-black
// on black), not merely similar hues that would still read fine.
const CONTRAST_THRESHOLD = 1.8;

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
}

// WCAG relative luminance (sRGB → linear, then the standard luma weights).
function relativeLuminance([r, g, b]) {
  const toLinear = (c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [r, g, b].map(toLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

// WCAG contrast ratio, 1 (identical) to 21 (black vs white).
function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// Build the closed color-spec clause from the client-extracted logo palette and
// sampled product color. Returns null when either input is missing/invalid, so
// the caller can fall back to CONTRAST_ADAPTATION.
function colorSpecClause(logoColors, productColor) {
  if (!Array.isArray(logoColors) || !logoColors.length || !productColor) return null;

  // Single fixed contrast color for the whole logo (matches the old policy):
  // white on a dark product, black on a light one.
  const contrastTarget = relativeLuminance(hexToRgb(productColor)) > 0.5 ? "#000000" : "#FFFFFF";

  const mappings = logoColors.map(({ hex }) => {
    const adapted = contrastRatio(hex, productColor) < CONTRAST_THRESHOLD;
    return { from: hex, to: adapted ? contrastTarget : hex, adapted };
  });

  const lines = mappings
    .map((m) =>
      m.adapted
        ? `${m.from} → render as ${m.to} (pre-computed so it stays visible on this product)`
        : `${m.from} (unchanged — already contrasts well against this product)`
    )
    .join("; ");

  return (
    " EXACT LOGO COLORS (final — do not recompute): The logo consists of exactly these colors, already " +
    `checked against the product's actual color for visibility: ${lines}. Render each color EXACTLY as ` +
    "specified above, in EVERY shot, with zero variation between shots — the same hex value must appear " +
    "in the product, close-up, and on-model images alike. Never substitute, tint, lighten, darken, blend, " +
    "add a gradient to, or otherwise reinterpret any of these colors, and never make a different contrast " +
    "decision in one shot than in another — this palette was already computed correctly and is final; do " +
    "not re-derive or re-judge it from the logo reference image."
  );
}

// Appended to EVERY prompt. Every shot must show the SAME physical item —
// one product, decorated once, photographed from different distances.
const PLACEMENT_LOCK =
  " PLACEMENT LOCK: Treat this as one single physical product that has already been decorated and is " +
  "being photographed multiple times. The logo's position on the product, its alignment, and its size " +
  "relative to the product are FIXED and must be reproduced exactly as specified — never re-interpret, " +
  "nudge, re-center, or resize the logo between shots.";

// Appended to prompts when the user drew a placement circle on their product
// photo. That annotated copy of the photo (product + bright magenta circle)
// rides along as the THIRD reference image; this clause explains what it means
// and forbids the circle itself from appearing in the output.
const MARKER_REFERENCE =
  " PLACEMENT MARKER: The THIRD reference image is the same product photo with a bright magenta " +
  "circle drawn on it. That circle marks EXACTLY where the customer wants the logo: place the logo " +
  "centered inside the circled area, sized to fit within the circle. The magenta circle is an " +
  "annotation only — it must NOT appear anywhere in the mockup. The finished product has no circle, " +
  "ring, outline, or marking of any kind; only the logo decoration itself.";

// Appended to every non-anchor shot when the anchor shot (the first requested
// view, see generateShotSet) succeeded. That rendered shot rides along as the
// LAST reference image, and this clause tells the model to copy the decorated
// product from it exactly — the strongest available lock for identical
// placement/size/color, and (with the addition below) color specifically.
const DECORATED_MATCH =
  " DECORATED MATCH: The LAST reference image provided is a photo of this exact product already " +
  "decorated with the logo. Reproduce the decorated product from that last reference EXACTLY: " +
  "identical logo placement on the product, identical logo size relative to the product, identical " +
  "logo colors, identical product color and style. The logo colors shown in that last reference are " +
  "AUTHORITATIVE — match them pixel-for-pixel rather than re-deriving colors from the original logo " +
  "artwork or making a fresh contrast judgment. Do NOT copy that reference's camera angle, " +
  "framing, crop, lighting, or background — only the product itself and its decoration must match it " +
  "perfectly, as if the very same item were photographed again.";

// Deterministic seed per product photo so every shot of a request samples colors
// from the same starting point, improving cross-image consistency.
function seedFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 2147483647;
}

// ---------------------------------------------------------------------------
// COMPOSABLE PROMPT SYSTEM
// finalPrompt = SHOT_TYPE + PRODUCT/PLACEMENT + METHOD + LIGHTING_BG + QUALITY
//               + NEGATIVES (folded into the prompt as an avoid-clause, since
//               Gemini image models have no separate negative_prompt channel)
// ---------------------------------------------------------------------------

// A. Shot-type blocks for the FLAT shots. The model shot is built separately
//    (see buildPrompt) because it reads best as one flowing lifestyle sentence.
//    - product: verifies placement, scale, and that the item matches the upload
//    - closeup: what embroidery jobs get approved/rejected on — stitch quality
const SHOT_TYPES = {
  product:
    "Professional e-commerce product photography, the product shown flat-lay or on an invisible " +
    "ghost mannequin (or neatly arranged if it is not a wearable), straight-on centered angle, " +
    "entire product in frame, even soft studio lighting, no harsh shadows, high resolution, " +
    "sharp focus across the whole product.",
  closeup:
    "Macro close-up product photography, tight crop centered on the decorated area only, " +
    "filling most of the frame, slightly angled raking light to reveal surface texture and " +
    "dimensionality, extremely sharp focus, visible material texture.",
};

// D. Method blocks — this is the part that fixes the "looks printed" problem.
const METHODS = {
  embroidery:
    "Rendered as genuine machine embroidery: raised satin-stitch and fill-stitch texture with " +
    "visible individual thread lines and directional sheen, slight natural fabric puckering " +
    "around the stitched area, thread colors kept faithful to the logo's exact reference " +
    "colors, no smooth gradients — the colors appear as solid stitched color blocks, fine text " +
    "rendered bold and simplified enough to be legible at embroidery scale, subtle dimensional " +
    "thickness where stitching sits above the fabric surface. If the product is a structured cap, " +
    "the main elements may be raised 3D puff embroidery; if it is a stretch knit, use flat " +
    "embroidery following the knit texture with moderate stitch density.",
  screenprint:
    "Rendered as screen-printed ink: flat, opaque ink layer sitting on top of the fabric surface, " +
    "sharp clean vector-like edges, slight visible ink texture on close inspection, no thread or " +
    "stitch texture of any kind, colors as flat distinct spot-color layers, ink slightly absorbed " +
    "into the fabric grain on light products and sitting more visibly on top with an underbase " +
    "on dark products.",
};

// Short one-line method note for the on-model shot. The full METHODS blocks above
// are macro/texture-focused and read wrong on a full-body lifestyle photo, so the
// model shot gets this lighter descriptor instead.
const METHOD_SHORT = {
  embroidery: "Realistic raised satin-stitch embroidery with visible threads.",
  screenprint: "Flat matte screen-printed ink finish.",
};

// What the decoration is called inside the prompt sentences.
const METHOD_DECOR = {
  embroidery: "EMBROIDERED",
  screenprint: "SCREEN PRINTED",
};

// E. Background/lighting + quality tags. LIGHTING_BG is skipped on model shots —
//    the model shot carries its own backdrop/lighting wording (and the scene
//    toggle may replace it).
const LIGHTING_BG =
  "Clean neutral light grey studio background, soft diffused lighting, no distracting props.";
const QUALITY_TAGS =
  "Photorealistic, high detail, 4k, commercial product photography quality.";

// F. Negatives — sent on every shot regardless of method; critical for embroidery.
//    Gemini has no negative_prompt parameter, so these ride inside the prompt.
const NEGATIVE_BASE =
  "flat vector logo look, sticker-like drop shadow, floating or detached design, warped or " +
  "blurred text, wrong product or product color, extra logos or watermarks, distorted product " +
  "shape, low resolution, cropped incorrectly";
const NEGATIVE_METHOD = {
  embroidery: ", glossy print sheen, smooth gradient fills, perfectly flat texture, printed-looking edges",
  screenprint: ", raised thread texture, stitching, puckered fabric",
};

// The logo must occupy the SAME fraction of the product in every shot. A bare
// "small/large" is interpreted differently per image, so we anchor size to a
// concrete proportion of the product and append this identical clause to all
// of a request's prompts. This wording is for centered / natural placements.
const SIZE_WORDING = {
  small: "The logo is small, spanning about 15% of the product's front width",
  medium: "The logo is medium, spanning about 30% of the product's front width",
  large: "The logo is large, spanning about 55% of the product's front width",
};
function sizeClause(size) {
  const spec = SIZE_WORDING[size] || SIZE_WORDING.medium;
  return ` ${spec}. Render the logo at this exact same scale relative to the product in every shot.`;
}

// A left-chest / pocket logo is ALWAYS small and sized to fit that little panel,
// so it is sized in absolute inches (by the logo's WIDTH) rather than as a % of
// the whole product. This is what fixes wide/horizontal logos (e.g. a wordmark
// with a long tagline): "30% of the front width" made them too wide for the
// left-chest zone, so the model centered them. Sizing by a small fixed width and
// telling it to scale wide logos DOWN keeps them on the chest where they belong.
const POCKET_SIZE_WORDING = { small: "about 2.5 inches", medium: "about 3.5 inches", large: "about 4.5 inches" };
function pocketSizeClause(size) {
  const spec = POCKET_SIZE_WORDING[size] || POCKET_SIZE_WORDING.medium;
  return (
    ` The logo is a small left-chest logo, ${spec} wide at its widest point, scaled while preserving its ` +
    `exact original aspect ratio. A wide or horizontal logo must be scaled DOWN so its full width still ` +
    `fits within the small left-chest area — it must not be enlarged, stretched, cropped, or moved toward ` +
    `the center of the product to make room. Keep the logo at this exact same small scale and left-chest ` +
    `position in every shot.`
  );
}

// How each placement choice reads in the prompt. Since the product is whatever
// the customer uploaded, "default" lets the model pick the product's natural
// decoration spot; pocket/center are explicit overrides. Geometry is spelled out
// precisely (including the wearer-left = viewer-right disambiguation) so every
// independently generated shot lands the logo in the exact same spot.
const PLACEMENT_WORDING = {
  default:
    "in the most natural, conventional decoration spot for this type of product (for example: the " +
    "left chest of a shirt, the front center panel of a cap, the folded cuff of a beanie, or near a " +
    "corner of a blanket) — pick that single natural spot and keep it identical in every shot",
  pocket:
    "as a small left-chest logo positioned on the WEARER'S upper-left chest — which appears on the RIGHT " +
    "half of the image when the product faces the camera — vertically about 2–3 inches below the collar " +
    "seam, sitting entirely on that left-chest panel between the vertical center placket and the sleeve " +
    "seam. It must NOT be centered on the product, must NOT span across the chest, and must NOT cross the " +
    "vertical center line, regardless of the logo's shape. A wide or horizontal logo stays in this same " +
    "left-chest spot, just scaled down to fit. If the product has no chest (e.g. a hat or bag), use the " +
    "equivalent small off-center front spot instead",
  center:
    "perfectly centered horizontally on the front of the product, at mid-height of the front decoration " +
    "area, the logo's center sitting on the product's vertical midline",
};

// The three shot types a request can ask for, in the order they render.
// "product" is the anchor (generated first, feeds the others as a reference).
const VIEW_ORDER = ["product", "closeup", "model"];

// Compose one shot's full prompt from the blocks above.
function buildPrompt(view, { method, placement, size, sceneOn, marker }) {
  const decor = METHOD_DECOR[method];

  // A drawn marker overrides both placement and size: the circle's center is
  // the logo's position and its diameter is the logo's width. Position is also
  // spelled out numerically (% from left/top of the product photo's frame) so
  // the text and the annotated marker reference reinforce each other.
  let placementText, sizing, sizeAdj;
  if (marker) {
    const px = Math.round(marker.x * 100);
    const py = Math.round(marker.y * 100);
    const pw = Math.max(1, Math.round(marker.r * 2 * 100));
    placementText =
      "at the exact spot the customer circled on their product photo: centered at the point " +
      `approximately ${px}% from the left edge and ${py}% from the top of the product photo's frame, ` +
      "exactly where the bright magenta circle is drawn in the placement-marker reference image";
    sizing =
      ` The logo's width spans about ${pw}% of the product photo's width — sized to fit inside the ` +
      "drawn marker circle while preserving the logo's exact original aspect ratio. Render the logo " +
      "at this exact same position and scale in every shot.";
    sizeAdj = "";
  } else {
    placementText = PLACEMENT_WORDING[placement] || PLACEMENT_WORDING.default;
    // Pocket placement is always a small left-chest logo sized in inches (so wide
    // logos scale down to fit instead of drifting to center). Everything else scales
    // by % of the product's front width. `sizing` is identical across a request's
    // shots so scale/position stay locked between them.
    const isPocket = placement === "pocket";
    sizing = isPocket ? pocketSizeClause(size) : sizeClause(size);
    // No size adjective for pocket ("small large logo" would contradict) — the
    // pocket sizing clause fully describes it.
    sizeAdj = isPocket ? "" : size === "small" ? "small " : size === "large" ? "large " : "";
  }
  const markerClause = marker ? MARKER_REFERENCE : "";

  // Model shot — one flowing lifestyle sentence. It uses the short method note
  // (not the heavy macro block) and swaps in a lifestyle scene only when the
  // toggle is on; otherwise a plain, empty studio backdrop (no environment) so
  // "scene off" reads as a truly blank background.
  if (view === "model") {
    const background = sceneOn
      ? "a fitting real-world lifestyle setting that suits this type of product, softly blurred " +
        "behind the model"
      : "a plain, empty seamless light-grey studio backdrop, completely blank with no scenery, " +
        "props, furniture, windows, or background objects of any kind";
    return (
      "Professional high-resolution lifestyle photo of a real human model wearing or naturally using " +
      "the exact product from the product reference photo" +
      `, this ${sizeAdj}logo ${decor} ${placementText}. ` +
      METHOD_SHORT[method] +
      ` Natural relaxed pose, flattering studio lighting, ${background}, shallow depth of field, ` +
      "photorealistic." +
      sizing +
      markerClause
    );
  }

  // Flat shots (product, closeup) — the detailed, texture-forward composable prompt.
  const subject =
    `The product is the exact item shown in the product reference photo, with this ` +
    `${sizeAdj}logo ${decor} ${placementText}.`;
  const negatives = ` Strictly avoid: ${NEGATIVE_BASE}${NEGATIVE_METHOD[method] || ""}.`;
  return (
    SHOT_TYPES[view] +
    " " + subject +
    sizing +
    " " + METHODS[method] +
    " " + LIGHTING_BG +
    " " + QUALITY_TAGS +
    negatives +
    markerClause
  );
}

// Retry transient failures only. `fetch` throws a TypeError with `cause.code`
// for low-level network faults (e.g. UND_ERR_CONNECT_TIMEOUT when the TCP/TLS
// handshake to OpenRouter never completes in time — a network blip, not a bug
// in the request). Those, plus 429/502/503/504 responses, are worth a retry;
// everything else (400 bad request, 401 bad key, content policy, ...) fails
// immediately since retrying wouldn't change the outcome.
const RETRYABLE_NETWORK_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 3; // 1 initial try + 2 retries
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, init) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_ATTEMPTS;
    try {
      const res = await fetch(url, init);
      if (res.ok || isLastAttempt || !RETRYABLE_STATUS.has(res.status)) return res;
    } catch (e) {
      if (isLastAttempt || !RETRYABLE_NETWORK_CODES.has(e?.cause?.code)) throw e;
    }
    await sleep(600 * attempt); // 600ms, then 1200ms
  }
}

async function generateOne(view, prompt, references, seed, colorClause) {
  const res = await fetchWithRetry("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt + PLACEMENT_LOCK + LOGO_FIDELITY + PRODUCT_REFERENCE + colorClause,
      seed,
      resolution: RESOLUTION,
      aspect_ratio: ASPECT_RATIO,
      output_format: OUTPUT_FORMAT,
      // OpenRouter expects reference images as ContentPartImage objects, not bare
      // strings. `references` is [logoUrl, productUrl] or [logoUrl, productUrl,
      // anchorShotUrl] — each a data URL or https URL.
      input_references: references.map((url) => ({ type: "image_url", image_url: { url } })),
    }),
  });

  const data = await res.json();
  if (!res.ok) return { view, ok: false, error: data.error ?? data };
  // return base64 strings; the page turns them into <img> data URLs
  return { view, ok: true, images: (data.data ?? []).map((d) => d.b64_json) };
}

// Generate every requested shot, chained for consistency: the FIRST requested
// view (in canonical VIEW_ORDER — `views` is already filtered/sorted into that
// order by the caller) is generated as the anchor, and its rendered result is
// then passed as the LAST reference image to every other requested shot (with
// DECORATED_MATCH), so all shots show the identical item — same logo placement,
// size, and colors. This works no matter which views were requested: a
// closeup+model run anchors on the close-up; a model-only run has no "rest" to
// chain. If the anchor shot fails, the remaining shots fall back to their base
// references only. Never throws; every failure is reported as a per-view result.
async function generateShotSet(views, opts) {
  const seed = seedFor(opts.productImage.slice(-256)); // same seed for every shot
  // Reference order matters — the prompt clauses name them positionally:
  // 1: logo, 2: product photo, 3 (optional): marker-annotated photo,
  // last (optional): the rendered anchor shot (DECORATED_MATCH).
  const baseRefs = opts.markerImage
    ? [opts.logo, opts.productImage, opts.markerImage]
    : [opts.logo, opts.productImage];
  // Computed ONCE per request (not per shot) — every shot gets the identical
  // color instruction, which is the whole point: no shot-to-shot judgment drift.
  const colorClause = colorSpecClause(opts.logoColors, opts.productColor) || CONTRAST_ADAPTATION;
  const safe = (view, prompt, references) =>
    generateOne(view, prompt, references, seed, colorClause).catch((e) => {
      const detail = e?.cause?.code ? `${e.message} (${e.cause.code})` : String(e?.message ?? e);
      return { view, ok: false, error: detail };
    });

  const [anchorView, ...restViews] = views;
  const anchor = await safe(anchorView, buildPrompt(anchorView, opts), baseRefs);
  const anchorUrl = anchor.ok && anchor.images?.[0] ? `data:image/png;base64,${anchor.images[0]}` : null;

  const rest = await Promise.all(
    restViews.map((view) =>
      safe(
        view,
        buildPrompt(view, opts) + (anchorUrl ? DECORATED_MATCH : ""),
        anchorUrl ? [...baseRefs, anchorUrl] : baseRefs
      )
    )
  );
  return [anchor, ...rest];
}

export async function POST(req) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json({ error: "Server is missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const {
      logo, productImage, method, views, placement, size, scene, marker, markerImage,
      logoColors, productColor,
    } = await req.json();
    if (!logo) return Response.json({ error: "No logo provided" }, { status: 400 });
    if (!productImage) return Response.json({ error: "No product photo provided" }, { status: 400 });
    if (!METHODS[method]) return Response.json({ error: "Invalid decoration method" }, { status: 400 });

    // A drawn placement circle needs both halves to be usable: the numeric
    // geometry (for the prompt) and the annotated photo (as a reference image).
    const hasMarker =
      marker &&
      typeof markerImage === "string" &&
      [marker.x, marker.y, marker.r].every((n) => typeof n === "number" && isFinite(n));

    // Client-extracted color inputs (see colorUtils.js) — loosely validated and
    // silently dropped if malformed, so a bad payload just falls back to
    // CONTRAST_ADAPTATION rather than erroring the whole request.
    const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
    const cleanLogoColors = Array.isArray(logoColors)
      ? logoColors.filter((c) => c && typeof c.hex === "string" && HEX_RE.test(c.hex))
      : [];
    const cleanProductColor = typeof productColor === "string" && HEX_RE.test(productColor) ? productColor : null;

    // Requested shots, in canonical order; default to all three.
    const requested = Array.isArray(views) && views.length ? views : VIEW_ORDER;
    const shotViews = VIEW_ORDER.filter((v) => requested.includes(v));
    if (!shotViews.length) {
      return Response.json({ error: "Select at least one shot type" }, { status: 400 });
    }

    const opts = {
      logo,
      productImage,
      method,
      placement,
      size,
      sceneOn: scene,
      marker: hasMarker ? marker : null,
      markerImage: hasMarker ? markerImage : null,
      logoColors: cleanLogoColors.length ? cleanLogoColors : null,
      productColor: cleanProductColor,
    };
    const results = await generateShotSet(shotViews, opts);
    return Response.json({ results });
  } catch (e) {
    const detail = e?.cause?.code ? `${e.message} (${e.cause.code})` : String(e?.message ?? e);
    return Response.json({ error: detail }, { status: 500 });
  }
}
