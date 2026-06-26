// app/api/generate-mockups/route.js
// BACKEND — this runs on the server, never in the browser. Your API key stays here.

export const runtime = "nodejs";   // image gen can take >10s; needs Node runtime
export const maxDuration = 60;     // allow up to 60s (Vercel)

const MODEL = "openai/gpt-image-2"; // swap to a Gemini image model if logo fidelity is poor

// Merch prompts live server-side. Material realism is all in the wording.
const PRESETS = {
  "shirt-embroidered":
    "Professional e-commerce product photo of a folded heather-gray cotton t-shirt, " +
    "this logo EMBROIDERED on the left chest. Realistic raised satin-stitch embroidery with " +
    "visible individual threads, slight sheen, stitch direction following the logo shapes. " +
    "Soft studio lighting, clean light-gray background, subtle shadow.",
  "shirt-screenprint":
    "Professional e-commerce product photo of a flat-laid black cotton t-shirt, this logo " +
    "SCREEN PRINTED centered on the chest. Flat matte ink finish on the fabric surface, weave " +
    "faintly visible through the print, no sheen. Soft studio lighting, clean background.",
  "hat-embroidered":
    "Professional e-commerce product photo, front view of a structured navy baseball cap, this " +
    "logo EMBROIDERED on the front panel. 3D puff embroidery with visible thread rows and raised " +
    "texture. Studio lighting, clean neutral background.",
  "beanie-embroidered":
    "Professional product photo of a folded charcoal knit beanie, this logo EMBROIDERED on the " +
    "cuff. Flat embroidery on ribbed knit fabric, thread texture visible against the wool. " +
    "Studio lighting, clean background.",
};

async function generateOne(label, prompt, reference) {
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      input_references: [reference], // the uploaded logo (data URL or https URL)
    }),
  });

  const data = await res.json();
  if (!res.ok) return { label, ok: false, error: data.error ?? data };
  // return base64 strings; the page turns them into <img> data URLs
  return { label, ok: true, images: (data.data ?? []).map((d) => d.b64_json) };
}

export async function POST(req) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json({ error: "Server is missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const { logo, products } = await req.json();
    if (!logo) return Response.json({ error: "No logo provided" }, { status: 400 });

    // which presets to run (default: all)
    const keys = (products?.length ? products : Object.keys(PRESETS)).filter((k) => PRESETS[k]);
    if (!keys.length) return Response.json({ error: "No valid products selected" }, { status: 400 });

    // fire them all in parallel
    const results = await Promise.all(keys.map((k) => generateOne(k, PRESETS[k], logo)));
    return Response.json({ results });
  } catch (e) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
