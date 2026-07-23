// app/apollo-studio/catalog.js
// Shared, framework-free catalog + pricing for Apollo Studio. Imported by both
// the studio page (/apollo-studio) and the order page (/apollo-studio/order) so
// product data, the preset color palette, and the price estimator live in ONE
// place. No React here — just data and pure functions.

// Preset product catalog. `blank` is the fake per-unit cost of the undecorated
// product; `stitchScale` scales the estimated embroidery stitch count for that
// product (a logo goes on small on a glove/cap, large on a blanket/tee). Shirts
// carry a `sizes` list — those products are ordered by size breakdown.
export const PRODUCTS = [
  { sku: "tshirt",         file: "/products/tshirt.jpg",         name: "Cotton T-Shirt",     nameZh: "纯棉 T 恤",   blank: 3.5,  stitchScale: 1.0, sizes: ["S", "M", "L", "XL", "2XL"] },
  { sku: "work-shirt",     file: "/products/work-shirt.webp",    name: "Work Shirt",         nameZh: "工装衬衫",     blank: 12.0, stitchScale: 1.0, sizes: ["S", "M", "L", "XL", "2XL"] },
  { sku: "cap-trucker",    file: "/products/cap-trucker.png",    name: "Trucker Cap",        nameZh: "网眼卡车帽",   blank: 5.5,  stitchScale: 0.8 },
  { sku: "cap-dad",        file: "/products/cap-dad.jpg",        name: "Dad Cap",            nameZh: "弯檐棒球帽",   blank: 6.5,  stitchScale: 0.8 },
  { sku: "beanie-cuffed",  file: "/products/beanie-cuffed.png",  name: "Cuffed Beanie",      nameZh: "翻边毛线帽",   blank: 5.0,  stitchScale: 0.7 },
  { sku: "fedora-tweed",   file: "/products/fedora-tweed.png",   name: "Tweed Fedora",       nameZh: "花呢礼帽",     blank: 5.25, stitchScale: 0.7 },
  { sku: "gloves-touch",   file: "/products/gloves-touch.jpg",   name: "Touchscreen Gloves", nameZh: "触屏手套",     blank: 4.0,  stitchScale: 0.5 },
  { sku: "scarf-fringe",   file: "/products/scarf-fringe.jpg",   name: "Fringed Scarf",      nameZh: "流苏围巾",     blank: 8.0,  stitchScale: 0.9 },
  { sku: "blanket-plush",  file: "/products/blanket-plush.jpg",  name: "Plush Blanket",      nameZh: "珊瑚绒毯",     blank: 14.0, stitchScale: 1.2 },
  { sku: "drawstring-bag", file: "/products/drawstring-bag.jpg", name: "Drawstring Bag",     nameZh: "束口背包",     blank: 3.25, stitchScale: 1.0 },
];

export const productBySku = (sku) => PRODUCTS.find((p) => p.sku === sku) || null;
export const isApparel = (product) => Array.isArray(product?.sizes) && product.sizes.length > 0;

// Preset garment colors — the customer chooses the product color from THIS fixed
// palette (no free/custom color picker). Each entry travels to the backend as
// { name, hex } and, on the order page, becomes a cart line's color.
export const GARMENT_COLORS = [
  { id: "black",  name: "Black",        nameZh: "黑色",   hex: "#1A1A1A" },
  { id: "white",  name: "White",        nameZh: "白色",   hex: "#F5F5F5" },
  { id: "grey",   name: "Heather Grey", nameZh: "麻灰色", hex: "#9AA0A6" },
  { id: "navy",   name: "Navy",         nameZh: "藏青色", hex: "#1F2A44" },
  { id: "royal",  name: "Royal Blue",   nameZh: "宝蓝色", hex: "#2447B8" },
  { id: "red",    name: "Red",          nameZh: "红色",   hex: "#B21D1D" },
  { id: "maroon", name: "Maroon",       nameZh: "酒红色", hex: "#6A1B2A" },
  { id: "forest", name: "Forest Green", nameZh: "森林绿", hex: "#1E4D2B" },
  { id: "orange", name: "Orange",       nameZh: "橙色",   hex: "#C2571A" },
  { id: "gold",   name: "Gold",         nameZh: "金黄色", hex: "#C79A2E" },
  { id: "purple", name: "Purple",       nameZh: "紫色",   hex: "#5B2A86" },
  { id: "sand",   name: "Sand",         nameZh: "沙色",   hex: "#C2B280" },
];

// ---------------------------------------------------------------------------
// PRICING ESTIMATOR (fake but internally consistent).
// A design's per-unit price is a pure function of product + method + logo
// size/placement (embroidery stitch estimate) or ink-color count (screen
// print) — so the SAME design always prices the same. Modeled on the reference
// embroidery sheet: base covers up to 7,000 stitches; extra stitches billed per
// 1,000 per piece; a flat set-up charge per location/screen that is waived at
// 144+ pieces; and a gentle per-unit volume discount across quantity breaks.
// ---------------------------------------------------------------------------
export const PRICE_TIERS = [24, 72, 144, 288, 576]; // quantity breaks shown
export const SETUP_WAIVE_QTY = 144;                  // set-up waived at/above this
// Per-unit volume discount applied to (blank + decoration) at each tier — small,
// like the reference ($11.98 → $11.82 → $11.65); the big saving is the set-up waiver.
const VOLUME_FACTOR = { 24: 1.0, 72: 0.99, 144: 0.978, 288: 0.968, 576: 0.958 };

// Embroidery
const EMB_BASE = 6.5;          // decoration labor covering up to the included stitches
const EMB_INCLUDED_STITCHES = 7000;
const EMB_EXTRA_PER_1K = 0.59; // per piece, per 1,000 stitches over the included count
const EMB_SETUP = 83.4;        // per location (front)
const EMB_EXTRA_SETUP_PER_1K = 16.7; // added set-up per additional 1,000 stitches
const SIZE_STITCHES = { small: 5000, medium: 8500, large: 14000 };

// Screen print
const PRINT_BASE = 3.5;             // 1-color decoration base
const PRINT_PER_EXTRA_COLOR = 0.45; // per piece, per ink color beyond the first
const PRINT_SETUP_PER_SCREEN = 22;  // one screen per ink color
const PRINT_MAX_COLORS = 6;

const round2 = (n) => Math.round(n * 100) / 100;
const roundStitches = (n) => Math.max(1500, Math.round(n / 250) * 250);

// Estimate embroidery stitches for a design from its size/placement/marker and
// the product's stitchScale. A drawn marker sizes off its radius; pocket/left-
// chest placement is always a small logo.
export function estimateStitches(settings, product) {
  const scale = product?.stitchScale ?? 1;
  let base;
  if (settings.marker) {
    // marker.r is a fraction of the product width; a medium logo ≈ 0.30 wide.
    const ratio = (settings.marker.r * 2) / 0.3;
    base = SIZE_STITCHES.medium * ratio * ratio; // area scales with width²
  } else {
    base = SIZE_STITCHES[settings.size] || SIZE_STITCHES.medium;
    if (settings.placement === "pocket") base *= 0.6; // small left-chest logo
  }
  return roundStitches(Math.min(base * scale, 32000));
}

// Number of ink colors for screen print, from the logo's extracted palette
// (falls back to 3 when the palette wasn't captured). Capped at PRINT_MAX_COLORS.
export function estimateColors(logoColors) {
  const n = Array.isArray(logoColors) && logoColors.length ? logoColors.length : 3;
  return Math.max(1, Math.min(PRINT_MAX_COLORS, n));
}

// Full price breakdown for one design. `design` needs `.settings`
// (method/size/placement/marker/productSku) and optionally `.logoColors`. Pure —
// never depends on how many mockup shots were rendered.
export function computePricing(design) {
  const s = design.settings;
  const product = productBySku(s.productSku);
  const blank = product?.blank ?? 5;

  if (s.method === "screenprint") {
    const colors = estimateColors(design.logoColors);
    const deco = PRINT_BASE + (colors - 1) * PRINT_PER_EXTRA_COLOR;
    const subtotal = blank + deco;
    const setupTotal = colors * PRINT_SETUP_PER_SCREEN;
    return {
      method: "screenprint",
      colors,
      blank,
      setupTotal,
      tiers: PRICE_TIERS.map((qty) => ({ qty, unit: round2(subtotal * VOLUME_FACTOR[qty]) })),
    };
  }

  // embroidery (default)
  const stitches = estimateStitches(s, product);
  const extraK = Math.max(0, Math.ceil((stitches - EMB_INCLUDED_STITCHES) / 1000));
  const deco = EMB_BASE + extraK * EMB_EXTRA_PER_1K;
  const subtotal = blank + deco;
  const setupTotal = EMB_SETUP + extraK * EMB_EXTRA_SETUP_PER_1K;
  return {
    method: "embroidery",
    stitches,
    extraK,
    blank,
    setupTotal,
    tiers: PRICE_TIERS.map((qty) => ({ qty, unit: round2(subtotal * VOLUME_FACTOR[qty]) })),
  };
}

// Per-unit price for an arbitrary quantity: use the highest quantity break that
// the order meets (below the smallest break, the smallest break's price applies).
export function unitPriceForQty(pricing, qty) {
  let unit = pricing.tiers[0].unit;
  for (const t of pricing.tiers) if (qty >= t.qty) unit = t.unit;
  return unit;
}

// Set-up charge that still applies at a given quantity (waived at 144+).
export function setupForQty(pricing, qty) {
  return qty >= SETUP_WAIVE_QTY ? 0 : pricing.setupTotal;
}

// Full money total for one order line at a given quantity.
export function lineTotal(pricing, qty) {
  return round2(unitPriceForQty(pricing, qty) * qty + setupForQty(pricing, qty));
}
