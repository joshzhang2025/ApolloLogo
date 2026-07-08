// app/colorUtils.js
// Shared browser-side color utilities: the k-means quantizer that powers
// ColorSimplifier.js, plus two logo/product color-extraction helpers used by
// the studio to give the backend an exact, deterministic color palette instead
// of leaving color decisions to per-shot model judgment (see route.js).
// Everything here runs in the browser (canvas) — no server, no API cost.

const MAX_DIM = 2000; // cap the working canvas so huge uploads stay snappy
const SVG_BASE = 1024; // raster size (longest side) for SVGs with no intrinsic pixel size
// A pixel is either printed (full ink) or not (transparent) — no partial coverage.
// Used both when sampling for the palette and when writing the final image, so the
// exported PNG has hard-edged, truly solid spot-color separations.
const ALPHA_CUTOFF = 128;

// Small deterministic PRNG so the same image + color count always yields the same
// palette (k-means++ seeding is otherwise random and would jitter between runs).
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toHex = (n) => n.toString(16).padStart(2, "0");
export const rgbToHex = ([r, g, b]) => `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();

// k-means++ seeding over the sampled pixels.
export function seedCentroids(samples, k, rng) {
  const centroids = [samples[Math.floor(rng() * samples.length)].slice()];
  const d2 = new Array(samples.length).fill(Infinity);
  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const dr = s[0] - last[0], dg = s[1] - last[1], db = s[2] - last[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < d2[i]) d2[i] = d;
      sum += d2[i];
    }
    let t = rng() * sum, chosen = 0;
    for (let i = 0; i < samples.length; i++) {
      t -= d2[i];
      if (t <= 0) { chosen = i; break; }
    }
    centroids.push(samples[chosen].slice());
  }
  return centroids;
}

// SVGs frequently load into an <img> with no intrinsic pixel size
// (naturalWidth/Height === 0) — drawing that as-is rasterizes to a 1×1 canvas.
// Derive a real raster size from the SVG's viewBox (preferred) or width/height
// attributes, keeping aspect ratio and scaling the longest side to SVG_BASE.
// Falls back to a square when the markup carries no usable size.
export function svgTargetDims(svgText) {
  let ratio = 1; // width / height
  const vb = svgText.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
  if (vb) {
    const w = parseFloat(vb[1]), h = parseFloat(vb[2]);
    if (w > 0 && h > 0) ratio = w / h;
  } else {
    const wm = svgText.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i);
    const hm = svgText.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i);
    const w = wm ? parseFloat(wm[1]) : 0, h = hm ? parseFloat(hm[1]) : 0;
    if (w > 0 && h > 0) ratio = w / h;
  }
  return ratio >= 1
    ? { w: SVG_BASE, h: Math.max(1, Math.round(SVG_BASE / ratio)) }
    : { w: Math.max(1, Math.round(SVG_BASE * ratio)), h: SVG_BASE };
}

// Reduce an image to `k` colors via k-means. `srcDims` overrides the source pixel
// dimensions for images with no intrinsic size (SVGs). Returns { dataUrl, palette,
// originalColors }.
export function quantizeImage(img, k, srcDims) {
  const iw = srcDims?.w || img.naturalWidth;
  const ih = srcDims?.h || img.naturalHeight;
  const scale = Math.min(1, MAX_DIM / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;

  // Collect opaque pixels: a subsample for the clustering, plus a count of the
  // distinct original colors (to show how much was merged).
  const distinct = new Set();
  const samples = [];
  const stride = Math.max(1, Math.floor(total / 20000));
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (data[i + 3] < ALPHA_CUTOFF) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    distinct.add((r << 16) | (g << 8) | b);
    if (p % stride === 0) samples.push([r, g, b]);
  }
  if (samples.length === 0) {
    return { dataUrl: canvas.toDataURL("image/png"), palette: [], originalColors: 0 };
  }

  const kk = Math.min(k, samples.length);
  const rng = mulberry32(0x9e3779b9);
  const centroids = seedCentroids(samples, kk, rng);

  for (let iter = 0; iter < 14; iter++) {
    const sums = Array.from({ length: kk }, () => [0, 0, 0, 0]);
    for (const s of samples) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < kk; c++) {
        const dr = s[0] - centroids[c][0], dg = s[1] - centroids[c][1], db = s[2] - centroids[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = c; }
      }
      const acc = sums[best];
      acc[0] += s[0]; acc[1] += s[1]; acc[2] += s[2]; acc[3]++;
    }
    for (let c = 0; c < kk; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }
  const finalC = centroids.map((c) => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);

  // Snap every kept pixel to its nearest ink. Alpha is forced binary (fully
  // transparent below the cutoff, fully opaque otherwise) so anti-aliased edges
  // don't survive as semi-transparent fringe — the export is clean solid spots.
  const counts = new Array(kk).fill(0);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (data[i + 3] < ALPHA_CUTOFF) { data[i + 3] = 0; continue; }
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let best = 0, bd = Infinity;
    for (let c = 0; c < kk; c++) {
      const dr = r - finalC[c][0], dg = g - finalC[c][1], db = b - finalC[c][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = c; }
    }
    data[i] = finalC[best][0];
    data[i + 1] = finalC[best][1];
    data[i + 2] = finalC[best][2];
    data[i + 3] = 255;
    counts[best]++;
  }
  ctx.putImageData(imgData, 0, 0);

  const palette = finalC
    .map((c, ci) => ({ hex: rgbToHex(c), count: counts[ci] }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  return { dataUrl: canvas.toDataURL("image/png"), palette, originalColors: distinct.size };
}

// Load a data URL into an <img>, resolving a usable pixel size even for
// size-less SVGs (mirrors the loader in ColorSimplifier's effect).
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      if (img.naturalWidth && img.naturalHeight) {
        resolve({ img, dims: null });
        return;
      }
      try {
        const svgText = await fetch(dataUrl).then((r) => r.text());
        resolve({ img, dims: svgTargetDims(svgText) });
      } catch {
        resolve({ img, dims: { w: SVG_BASE, h: SVG_BASE } });
      }
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = dataUrl;
  });
}

// Extract the logo's dominant colors as an ordered, deduplicated hex palette.
// This is what lets the backend hand the image model an EXACT, closed set of
// colors instead of "reproduce the reference colors" (which drifts per shot).
// Drops slivers under ~3% coverage (anti-aliasing noise) and merges near-
// duplicate centroids that k-means sometimes splits from one visual color.
export async function extractPalette(logoDataUrl, k = 6) {
  const { img, dims } = await loadImage(logoDataUrl);
  const { palette } = quantizeImage(img, k, dims);
  const total = palette.reduce((n, p) => n + p.count, 0);
  if (total === 0) return [];

  const withShare = palette.map((p) => ({ hex: p.hex, share: p.count / total }));

  // Merge centroids that are visually the same color (k-means can split one
  // color into two adjacent clusters), keeping the higher-share entry.
  const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const merged = [];
  for (const c of withShare.sort((a, b) => b.share - a.share)) {
    const [r, g, b] = hexToRgb(c.hex);
    const dup = merged.find((m) => {
      const [mr, mg, mb] = hexToRgb(m.hex);
      return Math.hypot(r - mr, g - mg, b - mb) < 24; // close in RGB space
    });
    if (dup) dup.share += c.share;
    else merged.push({ ...c });
  }

  return merged.filter((c) => c.share >= 0.03).sort((a, b) => b.share - a.share);
}

// Average color of a region of the product photo — where the logo will
// actually sit — used as the "what am I printing/stitching onto" reference
// for computing contrast substitutions server-side. `region` is the drawn
// marker circle { x, y, r } (fractions of the photo) when one exists; falls
// back to the photo's central ~50% crop, which is where placement defaults
// (pocket/center/natural-spot) put the logo in practice.
export async function sampleRegionColor(productDataUrl, region) {
  const { img, dims } = await loadImage(productDataUrl);
  const iw = dims?.w || img.naturalWidth;
  const ih = dims?.h || img.naturalHeight;
  const scale = Math.min(1, MAX_DIM / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  let cx, cy, r;
  if (region) {
    cx = region.x * w;
    cy = region.y * h;
    r = region.r * w;
  } else {
    cx = w / 2;
    cy = h / 2;
    r = Math.min(w, h) * 0.25; // central ~50%-diameter crop
  }
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(w, Math.ceil(cx + r));
  const y1 = Math.min(h, Math.ceil(cy + r));
  const rw = Math.max(1, x1 - x0);
  const rh = Math.max(1, y1 - y0);
  const { data } = ctx.getImageData(x0, y0, rw, rh);

  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let p = 0; p < rw * rh; p++) {
    const i = p * 4;
    if (data[i + 3] < ALPHA_CUTOFF) continue;
    sr += data[i]; sg += data[i + 1]; sb += data[i + 2];
    n++;
  }
  if (n === 0) return "#FFFFFF"; // fully transparent region — neutral fallback
  return rgbToHex([Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)]);
}
