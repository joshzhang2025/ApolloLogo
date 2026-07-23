// app/studio/page.js
// FRONTEND — runs in the browser. It calls YOUR endpoint (/api/generate-mockups),
// never OpenRouter directly, so your API key is never exposed here.

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "../SiteChrome";
import { useRouter } from "next/navigation";
import { useApolloStudioState } from "../StudioStateContext";
import { extractPalette, sampleRegionColor, invertImageColors } from "../colorUtils";
import { PRODUCTS, GARMENT_COLORS, PRICE_TIERS, computePricing } from "./catalog";

// Decoration methods. The uploaded product photo defines the product itself;
// this picks how the logo is applied to it.
const METHODS = [
  { value: "embroidery", name: "Embroidered", nameZh: "刺绣", emoji: "🧵" },
  { value: "screenprint", name: "Screen Print", nameZh: "丝网印刷", emoji: "🖨️" },
];

// The three shot types the backend can produce. The user multi-selects which
// ones to generate — no need to always make all three.
const VIEWS = [
  { key: "product", name: "Product", nameZh: "产品", descEn: "Full flat shot of the decorated product", descZh: "装饰后产品的完整平铺图", emoji: "📦" },
  { key: "closeup", name: "Close-up", nameZh: "特写", descEn: "Macro detail of the stitching / print", descZh: "针脚 / 印刷的微距细节", emoji: "🔍" },
  { key: "model", name: "On Model", nameZh: "模特上身", descEn: "Worn or used by a real model", descZh: "真人模特穿着或使用", emoji: "🧍" },
];

// Where the logo sits on the product. "default" lets the model pick the natural
// spot for whatever product was uploaded (left chest on a shirt, front panel on
// a cap, ...); pocket/center are explicit overrides.
const PLACEMENTS = [
  { value: "default", name: "Default", nameZh: "默认" },
  { value: "pocket", name: "Pocket", nameZh: "口袋处" },
  { value: "center", name: "Center", nameZh: "居中" },
];

// Logo size. "medium" is the neutral default (sent as no size adjective).
const SIZES = [
  { value: "small", name: "Small", nameZh: "小" },
  { value: "medium", name: "Medium", nameZh: "中" },
  { value: "large", name: "Large", nameZh: "大" },
];

// Preset product catalog. Apollo Studio has NO product upload — the customer
// picks one of these ready-made blanks instead. Each `file` is served from
// /public/products; selecting one fetches it and turns it into a data URL so
// the rest of the pipeline (color sampling, marker, backend) is unchanged.
// Fetch a preset product image from /public and convert it to a base64 data URL,
// so a picked product behaves exactly like an uploaded one everywhere downstream
// (canvas color sampling, the marker overlay, and the backend's OpenRouter call
// which needs a data/https URL, not a bare app-relative path).
async function productImageToDataUrl(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error("Could not load product image");
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read product image"));
    reader.readAsDataURL(blob);
  });
}

// ---- Color-similarity pre-check ----
// The backend no longer auto-recolors a logo that would blend into the product
// (a black logo on a black hat now stays black). To avoid silently generating an
// invisible logo, we warn the user first when the logo color and the product
// color where it will sit are too close, and let them continue anyway.
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// WCAG relative luminance (sRGB → linear, standard luma weights).
function relLuminance([r, g, b]) {
  const lin = (c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [r, g, b].map(lin);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}
// WCAG contrast ratio, 1 (identical) to 21 (black vs white).
function contrastRatio(hexA, hexB) {
  const la = relLuminance(hexToRgb(hexA));
  const lb = relLuminance(hexToRgb(hexB));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// Below this ratio, a logo color and the product color read as "too similar"
// and the logo risks disappearing. Intentionally low so we only flag genuinely
// near-invisible pairings, not merely similar hues that would still read fine.
const COLOR_WARN_THRESHOLD = 2.0;

// UI copy for both languages. Switching `lang` re-renders everything.
const STRINGS = {
  en: {
    studioEyebrow: "The studio",
    studioTitle: "Create your mockups",
    studioSub: "Upload your logo and your product — get a consistent, client-ready shot set.",
    s1Title: "Upload your logo",
    s2Title: "Choose your product",
    s3Title: "Choose method & shots",
    s4Title: "Fine-tune the look",
    productPickHint: "Pick a blank product to decorate",
    colorLabel: "Product color",
    colorAsShown: "As shown",
    colorSelected: "Selected",
    errProductLoad: "Couldn't load that product. Please try another.",
    methodLabel: "Decoration method",
    shotsLabel: "Shots to generate",
    logoPlacement: "Logo placement",
    logoSize: "Logo size",
    markTitle: "Circle the logo spot",
    markOpen: "Draw circle",
    markEdit: "Edit circle",
    markDone: "Done",
    markHintDraw: "Drag on your photo to draw a circle where the logo should go — or click once for a standard-size spot.",
    markHintEdit: "Drag the circle to move it, drag the handle to resize it. Only the Clear button removes it.",
    markCardHint: "Optional — mark exactly where the logo goes, right on your photo.",
    markNeedsProduct: "Upload a product photo to draw on it",
    markClear: "Clear circle",
    markOverride: "Using your drawn circle instead",
    markChip: "Marked spot",
    sceneBackground: "Scene background",
    sceneHint: "On-model shots get a lifestyle setting behind the model",
    uploadFirst: "Upload both images first",
    uploadCta: "Click to upload or drag & drop",
    uploadHint: "PNG, JPG, or SVG — transparent background works best",
    productUploadHint: "A clear photo of the blank product — front view works best",
    replaceHint: "click or drop to replace",
    remove: "Remove",
    invertLogo: "Invert logo colors",
    invertHint: "Flip the logo to its opposite (black → white) so it stands out on a same-colored product.",
    inverting: "Inverting…",
    errInvert: "Couldn't invert the logo colors.",
    generating: "Generating…",
    generateWord: "Generate",
    imageSingular: "image",
    imagePlural: "images",
    download: "Download",
    zoomHint: "Click image to zoom · click outside or Esc to close",
    errNoLogo: "Upload a logo first.",
    errNoProduct: "Upload a product photo first.",
    errNoViews: "Select at least one shot.",
    errNotImage: "Please choose an image file.",
    shotFailed: "shot failed:",
    viewProduct: "Product",
    viewCloseup: "Close-up",
    viewModel: "On Model",
    logoTag: "Logo",
    productTag: "Product",
    generationsOne: "generation",
    generationsMany: "generations",
    clearAll: "Clear all",
    generationLabel: "Generation",
    sceneTag: "Scene",
    emptyTitle: "Your mockups will appear here",
    emptyBody:
      "Upload your logo and a photo of your product, pick which shots you want, then hit Generate. Every run is saved below — change the images or settings and generate again, and nothing you already made goes away.",
    regenerate: "Regenerate",
    pricingTitle: "Estimated pricing",
    pricingSub: "Indicative per-unit price for this exact design.",
    pricingQtyCol: "Qty",
    pricingUnitCol: "Price / unit",
    pricingEmb: "Embroidery",
    pricingPrint: "Screen print",
    pricingStitches: "stitches",
    pricingColorsOne: "ink color",
    pricingColorsMany: "ink colors",
    pricingSetup: "Set-up",
    pricingPerLocation: "per location",
    pricingPerScreen: "per screen",
    pricingWaived: "Set-up waived on orders of 144+ pieces.",
    pricingExtraStitch: "Includes up to 7,000 stitches; +$0.59/pc per 1,000 over.",
    pricingExtraColor: "One screen per ink color.",
    pricingDisclaimer: "Example pricing for demonstration only — not a real quote.",
    orderCta: "Order this design",
    colorWarnTitle: "Logo color is too close to the product color",
    colorWarnBody:
      "Your logo color is very similar to the product color where it will sit, so the logo may blend in and be hard to see. We recommend changing your logo or product color for better contrast. You can also continue anyway.",
    colorWarnLogo: "Logo color",
    colorWarnProduct: "Product color",
    colorWarnBack: "Go back",
    colorWarnContinue: "Continue anyway",
  },
  zh: {
    studioEyebrow: "工作台",
    studioTitle: "生成您的样机",
    studioSub: "上传您的 Logo 和产品图 —— 获得一套风格统一、可直接交付的样机图。",
    s1Title: "上传 Logo",
    s2Title: "选择产品",
    s3Title: "选择工艺与镜头",
    s4Title: "调整细节",
    productPickHint: "选择要装饰的空白产品",
    colorLabel: "产品颜色",
    colorAsShown: "原色",
    colorSelected: "已选",
    errProductLoad: "无法加载该产品，请换一个。",
    methodLabel: "装饰工艺",
    shotsLabel: "要生成的镜头",
    logoPlacement: "Logo 位置",
    logoSize: "Logo 大小",
    markTitle: "圈出 Logo 位置",
    markOpen: "画圈标记",
    markEdit: "编辑圆圈",
    markDone: "完成",
    markHintDraw: "在产品照片上拖动画圈，标记 Logo 的位置 —— 或单击一次放置标准大小的圆圈。",
    markHintEdit: "拖动圆圈可移动位置，拖动手柄可调整大小。只有“清除圆圈”按钮才会删除它。",
    markCardHint: "可选 —— 直接在照片上精确标记 Logo 的位置。",
    markNeedsProduct: "上传产品图后即可在照片上画圈",
    markClear: "清除圆圈",
    markOverride: "将使用您画的圆圈",
    markChip: "手绘标记",
    sceneBackground: "场景背景",
    sceneHint: "模特上身图会在模特身后加入生活场景",
    uploadFirst: "请先上传两张图片",
    uploadCta: "点击上传或拖放文件",
    uploadHint: "PNG、JPG 或 SVG —— 透明背景效果最佳",
    productUploadHint: "清晰的空白产品照片 —— 正面视角效果最佳",
    replaceHint: "点击或拖放以替换",
    remove: "移除",
    invertLogo: "反转 Logo 颜色",
    invertHint: "将 Logo 反转为相反颜色（黑 → 白），使其在同色产品上更醒目。",
    inverting: "反转中…",
    errInvert: "无法反转 Logo 颜色。",
    generating: "生成中…",
    generateWord: "生成",
    imageSingular: "张图片",
    imagePlural: "张图片",
    download: "下载",
    zoomHint: "点击图片放大 · 点击空白处或按 Esc 关闭",
    errNoLogo: "请先上传 Logo。",
    errNoProduct: "请先上传产品图。",
    errNoViews: "请至少选择一个镜头。",
    errNotImage: "请选择图片文件。",
    shotFailed: "图生成失败：",
    viewProduct: "产品",
    viewCloseup: "特写",
    viewModel: "模特上身",
    logoTag: "Logo",
    productTag: "产品",
    generationsOne: "次生成",
    generationsMany: "次生成",
    clearAll: "清除全部",
    generationLabel: "生成",
    sceneTag: "场景",
    emptyTitle: "样机将显示在这里",
    emptyBody: "上传 Logo 和产品照片，选择需要的镜头，然后点击生成。每次生成都会保存在下方 —— 更换图片或设置后再次生成,之前的成果都不会消失。",
    regenerate: "重新生成",
    pricingTitle: "预估价格",
    pricingSub: "该设计的每件参考单价。",
    pricingQtyCol: "数量",
    pricingUnitCol: "单价",
    pricingEmb: "刺绣",
    pricingPrint: "丝网印刷",
    pricingStitches: "针",
    pricingColorsOne: "个印色",
    pricingColorsMany: "个印色",
    pricingSetup: "制版费",
    pricingPerLocation: "每个位置",
    pricingPerScreen: "每个网版",
    pricingWaived: "订购 144 件及以上免收制版费。",
    pricingExtraStitch: "含 7,000 针以内；超出部分每千针每件 +$0.59。",
    pricingExtraColor: "每个印色一个网版。",
    pricingDisclaimer: "示例价格，仅供演示，非正式报价。",
    orderCta: "订购此设计",
    colorWarnTitle: "Logo 颜色与产品颜色过于接近",
    colorWarnBody:
      "您的 Logo 颜色与其所在位置的产品颜色非常相近，Logo 可能会融入背景、难以辨认。建议更换 Logo 或产品颜色以获得更好的对比度。您也可以选择仍然继续。",
    colorWarnLogo: "Logo 颜色",
    colorWarnProduct: "产品颜色",
    colorWarnBack: "返回",
    colorWarnContinue: "仍然继续",
  },
};

// "1 of 3 generated" progress text shown on a batch while shots stream in.
const progressLabel = (lang, done, total) =>
  lang === "zh" ? `已生成 ${done}/${total} 张` : `${done} of ${total} generated`;

// ---------- Small inline icons (stroke inherits currentColor) ----------
function IconUpload(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IconCheck(props) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconSpinner(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${props.className ?? "h-4 w-4"}`}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
function IconRefresh(props) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}
function IconDownload(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function IconExpand(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
// Half-filled circle — the standard "invert / contrast" glyph.
function IconInvert(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconSparkles(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </svg>
  );
}
function IconTag(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function IconCart(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

// First successfully-generated shot of a batch, as a data URL (used as the
// design's thumbnail on the order page), or null if none succeeded.
function firstOkImage(batch) {
  for (const r of batch.results) if (r.ok && r.images?.[0]) return `data:image/png;base64,${r.images[0]}`;
  return null;
}

// Snapshot of a batch's DESIGN for the order flow. Carries just what the order
// page + cart need — the settings that drive pricing, the logo palette (for
// screen-print color count), a preview image, and the design's default color.
function makeOrderDraft(batch) {
  return {
    batchId: batch.id,
    productSku: batch.settings.productSku,
    productName: batch.productImageName,
    method: batch.settings.method,
    settings: batch.settings,
    logoColors: batch.logoColors || null,
    garmentColor: batch.settings.garmentColor || null,
    preview: firstOkImage(batch),
  };
}

// Pricing panel shown under a finished batch's mockups — a quantity/price table
// plus the set-up and stitch/ink-color notes, all derived from the design via
// computePricing (so the same design always shows the same numbers). `onOrder`
// takes the customer to the order page seeded with this design.
function PricingPanel({ batch, t, lang, onOrder }) {
  const p = computePricing(batch);
  const isEmb = p.method === "embroidery";
  const num = (n) => n.toLocaleString(lang === "zh" ? "zh-CN" : "en-US");
  const methodChip = isEmb
    ? `${t.pricingEmb} · ~${num(p.stitches)} ${t.pricingStitches}`
    : `${t.pricingPrint} · ${p.colors} ${p.colors === 1 ? t.pricingColorsOne : t.pricingColorsMany}`;
  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <IconTag />
          </span>
          <div>
            <h4 className="text-sm font-semibold leading-tight">{t.pricingTitle}</h4>
            <p className="text-[11px] leading-tight text-zinc-400">{t.pricingSub}</p>
          </div>
        </div>
        <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {methodChip}
        </span>
      </div>

      {/* quantity → per-unit price table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="pb-1.5 pr-2 font-medium">{t.pricingQtyCol}</th>
              {p.tiers.map((ti) => (
                <th key={ti.qty} className="pb-1.5 pl-2 text-right font-medium">
                  {num(ti.qty)}
                  {ti.qty === PRICE_TIERS[PRICE_TIERS.length - 1] ? "+" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1.5 pr-2 font-medium text-zinc-500 dark:text-zinc-400">{t.pricingUnitCol}</td>
              {p.tiers.map((ti) => (
                <td key={ti.qty} className="py-1.5 pl-2 text-right font-semibold tabular-nums">
                  ${ti.unit.toFixed(2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* set-up + method notes */}
      <ul className="mt-3 space-y-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        <li>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">{t.pricingSetup}:</span>{" "}
          ${p.setupTotal.toFixed(2)}
          {isEmb ? ` ${t.pricingPerLocation}` : ""} — {t.pricingWaived}
        </li>
        <li>{isEmb ? t.pricingExtraStitch : t.pricingExtraColor}</li>
        <li className="text-zinc-400 dark:text-zinc-500">{t.pricingDisclaimer}</li>
      </ul>

      <button
        type="button"
        onClick={() => onOrder(batch)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.99]"
      >
        <IconCart />
        {t.orderCta}
      </button>
    </div>
  );
}

// Numbered step chip; turns into a green check once the step is satisfied.
function StepBadge({ n, done }) {
  return (
    <span
      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
        done
          ? "bg-emerald-500 text-white"
          : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      }`}
    >
      {done ? <IconCheck /> : n}
    </span>
  );
}

// Drag & drop / click upload zone, used for both the logo and the product photo.
// Owns its own drag-highlight state and hidden <input type="file">.
function UploadZone({ image, name, hint, onFile, onClear, t }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFile(e.dataTransfer.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
        dragging
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
          : "border-zinc-300 hover:border-indigo-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="hidden"
      />
      {image ? (
        <div className="flex w-full items-center gap-3 text-left">
          <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-[conic-gradient(at_50%_50%,#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] bg-[length:14px_14px] dark:border-zinc-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="upload preview" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{t.replaceHint}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (inputRef.current) inputRef.current.value = "";
              onClear();
            }}
            className="flex-none rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-red-300 hover:text-red-500 dark:border-zinc-700"
          >
            {t.remove}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 transition-transform group-hover:scale-105 dark:bg-indigo-950 dark:text-indigo-400">
            <IconUpload />
          </div>
          <p className="text-sm font-medium">{t.uploadCta}</p>
          <p className="text-xs text-zinc-400">{hint}</p>
        </div>
      )}
    </div>
  );
}

// Render the product photo with the user's placement circle drawn on it (bright
// magenta ring), returning a data URL. This annotated copy is sent to the backend
// as an extra reference image so the model can SEE where the logo goes, alongside
// the numeric coordinates. Downscaled so the extra reference stays lightweight.
function makeMarkerImage(productImage, marker) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1536;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      // x/y are fractions of width/height; r is a fraction of width (so the
      // circle stays round regardless of the photo's aspect ratio).
      const cx = marker.x * w;
      const cy = marker.y * h;
      const r = marker.r * w;
      // White halo behind the magenta ring so the marker reads on any photo.
      ctx.lineWidth = Math.max(8, w * 0.014);
      ctx.strokeStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(4, w * 0.008);
      ctx.strokeStyle = "#FF00FF";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => reject(new Error("Could not load product image"));
    img.src = productImage;
  });
}

// Non-interactive circle overlay, shared by the editor and the card preview.
// x/y are fractions of the photo's width/height; r is a fraction of its width,
// so pure-% positioning keeps the circle round at any rendered size.
function MarkerCircle({ circle, interactive }) {
  return (
    <span
      className={`absolute -translate-y-1/2 rounded-full border-2 border-fuchsia-500 bg-fuchsia-500/15 shadow-[0_0_0_2px_rgba(255,255,255,0.85)] ${
        interactive ? "cursor-grab" : "pointer-events-none"
      }`}
      style={{
        left: `${(circle.x - circle.r) * 100}%`,
        top: `${circle.y * 100}%`,
        width: `${circle.r * 2 * 100}%`,
        aspectRatio: "1",
      }}
    />
  );
}

// Interactive placement editor (lives in the modal): while no circle exists,
// drag on the photo to draw one (a plain click drops a standard-size circle).
// Once a circle exists it is persistent: dragging inside it MOVES it, dragging
// the edge handle RESIZES it, and dragging elsewhere does nothing — only the
// Clear button removes it. Emits { x, y, r } — x/y as fractions of the photo's
// width/height, r as a fraction of its width.
function MarkerEditor({ image, marker, onChange }) {
  const boxRef = useRef(null);
  const dragRef = useRef(null); // { mode: "draw"|"move"|"resize", ... } while interacting
  const [draft, setDraft] = useState(null); // in-progress circle while drawing

  const pointAt = (e) => {
    const rect = boxRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
      w: rect.width,
      h: rect.height,
    };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    // capture on the container so move/up keep firing outside its bounds
    boxRef.current.setPointerCapture(e.pointerId);
    const p = pointAt(e);
    if (marker) {
      // Inside the circle → start moving it (keeping the grab offset so the
      // circle doesn't jump-center under the pointer). Outside → ignore, so a
      // stray drag can never replace the circle you placed.
      const dist = Math.hypot((p.x - marker.x) * p.w, (p.y - marker.y) * p.h);
      if (dist <= marker.r * p.w) {
        dragRef.current = { mode: "move", grabDX: marker.x - p.x, grabDY: marker.y - p.y };
      }
      return;
    }
    dragRef.current = { mode: "draw", cx: p.x, cy: p.y, r: 0 };
    setDraft({ x: p.x, y: p.y, r: 0 });
  };

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation(); // don't let the container treat this as a move-start
    boxRef.current.setPointerCapture(e.pointerId);
    dragRef.current = { mode: "resize" };
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = pointAt(e);
    if (d.mode === "draw") {
      // radius in on-screen px, normalized to the photo's width. Kept on the
      // ref (not just state) so onPointerUp can read the final value synchronously.
      const r = Math.hypot((p.x - d.cx) * p.w, (p.y - d.cy) * p.h) / p.w;
      d.r = Math.min(r, 0.5);
      setDraft({ x: d.cx, y: d.cy, r: d.r });
    } else if (d.mode === "move") {
      onChange({
        ...marker,
        x: Math.min(1, Math.max(0, p.x + d.grabDX)),
        y: Math.min(1, Math.max(0, p.y + d.grabDY)),
      });
    } else if (d.mode === "resize") {
      const r = Math.hypot((p.x - marker.x) * p.w, (p.y - marker.y) * p.h) / p.w;
      onChange({ ...marker, r: Math.min(Math.max(r, 0.02), 0.5) });
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.mode === "draw") {
      // Read the final circle off the ref (always in sync) rather than reaching
      // into `draft` via a setDraft functional updater — calling onChange (the
      // parent's setMarker) from inside a setState updater runs it during this
      // component's render phase and trips React's cross-component setState check.
      onChange({ x: d.cx, y: d.cy, r: d.r < 0.02 ? 0.1 : d.r }); // click = standard spot
      setDraft(null);
    }
  };

  const circle = draft ?? marker;
  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative mx-auto w-fit touch-none select-none overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 ${
        marker ? "" : "cursor-crosshair"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="product" draggable={false} className="block max-h-[65vh] max-w-full" />
      {circle && circle.r > 0 && <MarkerCircle circle={circle} interactive={!!marker && !draft} />}
      {/* resize handle on the circle's right edge (only once the circle is placed) */}
      {marker && !draft && (
        <span
          onPointerDown={startResize}
          className="absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-fuchsia-500 bg-white shadow"
          style={{ left: `${(marker.x + marker.r) * 100}%`, top: `${marker.y * 100}%` }}
        />
      )}
    </div>
  );
}

export default function Studio() {
  // Work-in-progress state (uploaded images, settings, drawn circle, the
  // generation history, and the UI language) lives in a layout-level context
  // so it survives leaving and returning to /studio — see StudioStateContext.js.
  // Only ephemeral UI state (open modals, current error, lightbox) stays local
  // to this page.
  const {
    lang, setLang,
    logo, setLogo,
    logoName, setLogoName,
    productImage, setProductImage,
    productImageName, setProductImageName,
    productSku, setProductSku,
    garmentColor, setGarmentColor,
    method, setMethod,
    views, setViews,
    placement, setPlacement,
    size, setSize,
    scene, setScene,
    marker, setMarker,
    batches, setBatches,
    setOrderDraft,
    batchSeq,
  } = useApolloStudioState();
  const router = useRouter();
  const [markerModal, setMarkerModal] = useState(false); // circle-editor window open?
  const [error, setError] = useState("");
  const [checkingColors, setCheckingColors] = useState(false); // running the pre-generate color check
  const [inverting, setInverting] = useState(false); // flipping the logo's colors
  const [colorWarn, setColorWarn] = useState(null); // { run, logoHex, productHex, ratio } | null
  const [lightbox, setLightbox] = useState(null); // { src, caption, filename } | null
  const [zoomed, setZoomed] = useState(false);
  const resultsRef = useRef(null); // scrolled into view on mobile when generating
  const scrollRef = useRef(null); // lightbox scroll container
  const zoomImgRef = useRef(null); // enlarged image
  const clickFrac = useRef({ x: 0.5, y: 0.5 }); // where the user clicked (0..1)

  const t = STRINGS[lang];
  const viewLabel = (view) =>
    view === "model" ? t.viewModel : view === "closeup" ? t.viewCloseup : t.viewProduct;

  function openLightbox(src, caption, filename) {
    setZoomed(false);
    setLightbox({ src, caption, filename });
  }
  const closeLightbox = useCallback(() => setLightbox(null), []);

  // After zooming in, scroll so the clicked point is centered in view.
  useEffect(() => {
    if (!zoomed) return;
    const c = scrollRef.current;
    const img = zoomImgRef.current;
    if (!c || !img) return;
    const apply = () => {
      const left = clickFrac.current.x * img.offsetWidth - c.clientWidth / 2;
      const top = clickFrac.current.y * img.offsetHeight - c.clientHeight / 2;
      c.scrollLeft = Math.max(0, left);
      c.scrollTop = Math.max(0, top);
    };
    // run after layout settles
    apply();
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  }, [zoomed]);

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox]);

  // Close the circle editor on Escape (closing keeps the circle — only Clear removes it).
  useEffect(() => {
    if (!markerModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMarkerModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [markerModal]);

  // Close the color-similarity warning on Escape (same as "Go back").
  useEffect(() => {
    if (!colorWarn) return;
    const onKey = (e) => {
      if (e.key === "Escape") setColorWarn(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [colorWarn]);

  // Shared file reader for both upload zones.
  const readFile = useCallback(
    (file, setImage, setName) => {
      if (!file || !file.type.startsWith("image/")) {
        setError(t.errNotImage);
        return;
      }
      setError("");
      setName(file.name);
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result); // base64 data URL
      reader.readAsDataURL(file);
    },
    [t]
  );

  function toggleView(key) {
    setViews((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  // Pick one of the preset products. Loads its image into a data URL (so it flows
  // through the pipeline like an uploaded photo) and clears any circle drawn on a
  // previously selected product. The chosen garment color is kept — it applies to
  // whichever product is selected.
  const selectProduct = useCallback(
    async (p) => {
      setError("");
      setMarker(null); // a circle placed on a different product is meaningless here
      setProductSku(p.sku);
      setProductImageName(lang === "zh" ? p.nameZh : p.name);
      try {
        setProductImage(await productImageToDataUrl(p.file));
      } catch {
        setProductSku(null);
        setProductImage(null);
        setProductImageName("");
        setError(t.errProductLoad);
      }
    },
    [lang, t, setMarker, setProductSku, setProductImageName, setProductImage]
  );

  // Preset garment color. Clicking the active color again clears it (back to the
  // product's own color). There is intentionally no free color picker.
  const selectGarmentColor = (c) =>
    setGarmentColor((cur) => (cur?.id === c.id ? null : c));

  // Kick off one generation run. Each run captures the images + settings it used
  // and appends a new batch to the history; existing batches are never touched.
  // `regenerate` replays a past batch with its own captured images/settings.
  const runGeneration = useCallback(
    async ({ logo: runLogo, logoName: runLogoName, productImage: runProduct, productImageName: runProductName, settings }) => {
      if (!runLogo) return setError(t.errNoLogo);
      if (!runProduct) return setError(t.errNoProduct);
      if (!settings.views.length) return setError(t.errNoViews);
      setError("");
      const id = ++batchSeq.current;
      const batch = {
        id,
        logo: runLogo,
        logoName: runLogoName,
        productImage: runProduct,
        productImageName: runProductName,
        createdAt: Date.now(),
        settings: {
          ...settings,
          views: VIEWS.map((v) => v.key).filter((k) => settings.views.includes(k)), // stable order
        },
        pending: true,
        error: "",
        results: [],
      };
      setBatches((bs) => [batch, ...bs]);
      // On small screens the results live below the controls — bring them into view.
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
        requestAnimationFrame(() =>
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        );
      }
      try {
        // A drawn circle travels two ways: as numbers (for the prompt) and as an
        // annotated copy of the product photo (as a reference image), rendered
        // here from the batch's own captured photo + marker so Regenerate works.
        // logoColors/productColor give the backend an exact, deterministic color
        // palette instead of leaving color-matching to per-shot model judgment —
        // see colorSpecClause in route.js. Extraction failures fall back to null,
        // which makes the backend fall back to its old text-only color guidance.
        const [markerImage, logoColors, productColor] = await Promise.all([
          batch.settings.marker ? makeMarkerImage(runProduct, batch.settings.marker) : null,
          extractPalette(runLogo).catch(() => null),
          sampleRegionColor(runProduct, batch.settings.marker).catch(() => null),
        ]);
        // Stash the extracted palette on the batch so the pricing estimator can
        // count ink colors for screen-print jobs (embroidery ignores it).
        if (logoColors) setBatches((bs) => bs.map((b) => (b.id === id ? { ...b, logoColors } : b)));
        const res = await fetch("/api/generate-mockups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logo: runLogo,
            productImage: runProduct,
            method: batch.settings.method,
            views: batch.settings.views,
            placement: batch.settings.placement,
            size: batch.settings.size,
            scene: batch.settings.scene,
            marker: batch.settings.marker,
            markerImage,
            logoColors,
            productColor,
            garmentColor: batch.settings.garmentColor
              ? { name: batch.settings.garmentColor.name, hex: batch.settings.garmentColor.hex }
              : null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Request failed");
        }
        // The backend streams one JSON result per line as each shot finishes
        // (not all at once), so results appear — and the "N of M" count ticks
        // up — as soon as each shot is ready instead of only at the very end.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop(); // last (possibly incomplete) line stays buffered
          for (const line of lines) {
            if (!line.trim()) continue;
            const result = JSON.parse(line);
            setBatches((bs) =>
              bs.map((b) => (b.id === id ? { ...b, results: [...b.results, result] } : b))
            );
          }
        }
        setBatches((bs) => bs.map((b) => (b.id === id ? { ...b, pending: false } : b)));
      } catch (e) {
        setBatches((bs) =>
          bs.map((b) => (b.id === id ? { ...b, error: e.message, pending: false } : b))
        );
      }
    },
    [t, batchSeq, setBatches]
  );

  // Clicking Generate first runs a quick client-side color-similarity check: if
  // the logo color would sit almost invisibly on the product (the backend no
  // longer auto-recolors it), we surface a warning modal and let the user either
  // go back and adjust a color or continue anyway. The extraction here reuses the
  // same helpers the run itself uses, so it's fast and cache-warm.
  const startRun = (run) => {
    setColorWarn(null);
    runGeneration(run);
  };

  const generate = async () => {
    if (!uploadsReady || !views.length || isBusy || checkingColors) return;
    const run = {
      logo,
      logoName,
      productImage,
      productImageName,
      settings: { method, views, placement, size, scene, marker, garmentColor, productSku },
    };
    setError("");
    setCheckingColors(true);
    try {
      // When a preset garment color is chosen the product will be re-dyed to it,
      // so the contrast check compares the logo against THAT color, not the
      // (soon-to-be-replaced) color sampled from the original product photo.
      const [palette, productHex] = await Promise.all([
        extractPalette(logo).catch(() => null),
        garmentColor
          ? Promise.resolve(garmentColor.hex)
          : sampleRegionColor(productImage, marker).catch(() => null),
      ]);
      // Only warn if a MAJORITY of the logo (by area) is too close to the product
      // color — a small low-contrast accent shouldn't trigger it. Each palette
      // entry carries `share` (its fraction of the logo), so we sum the share of
      // the low-contrast colors and flag only when that total clears 50%.
      if (Array.isArray(palette) && palette.length && productHex) {
        const lowContrast = palette.filter((c) => contrastRatio(c.hex, productHex) < COLOR_WARN_THRESHOLD);
        const blendShare = lowContrast.reduce((sum, c) => sum + c.share, 0);
        if (blendShare > 0.5) {
          // Show the most dominant blending color as the representative swatch.
          const worst = lowContrast.reduce((a, b) => (b.share > a.share ? b : a));
          setColorWarn({ run, logoHex: worst.hex, productHex, blendShare });
          return; // wait for the user to choose (finally clears checkingColors)
        }
      }
    } catch {
      // A failed check shouldn't block generation — just skip the warning.
    } finally {
      setCheckingColors(false);
    }
    startRun(run);
  };

  const continueAnyway = () => {
    if (colorWarn?.run) startRun(colorWarn.run);
    else setColorWarn(null);
  };

  // Flip the logo to its opposite colors (black ↔ white, every hue → complement)
  // so a logo that blends into a same-colored product becomes visible. Replaces
  // the current logo in place; the previous logo is only restored by re-uploading.
  const invertLogo = useCallback(async () => {
    if (!logo || inverting) return;
    setInverting(true);
    setError("");
    try {
      setLogo(await invertImageColors(logo));
    } catch {
      setError(t.errInvert);
    } finally {
      setInverting(false);
    }
  }, [logo, inverting, setLogo, t]);

  // From the color-similarity warning: invert the logo used for that run, then
  // generate straight away with the fixed logo (the common black-on-black fix).
  const invertAndRun = async () => {
    if (!colorWarn?.run || inverting) return;
    setInverting(true);
    setError("");
    try {
      const inverted = await invertImageColors(colorWarn.run.logo);
      setLogo(inverted);
      const run = { ...colorWarn.run, logo: inverted };
      setColorWarn(null);
      startRun(run);
    } catch {
      setError(t.errInvert);
    } finally {
      setInverting(false);
    }
  };

  const regenerateBatch = (b) =>
    runGeneration({
      logo: b.logo,
      logoName: b.logoName,
      productImage: b.productImage,
      productImageName: b.productImageName,
      settings: b.settings,
    });

  const removeBatch = (id) => setBatches((bs) => bs.filter((b) => b.id !== id));
  const clearAll = () => setBatches([]);

  // "Order this design" → snapshot the batch's design into the shared order draft
  // and go to the order page, where the customer picks color(s), sizes, and qty.
  const startOrder = (batch) => {
    setOrderDraft(makeOrderDraft(batch));
    router.push("/apollo-studio/order");
  };

  const isBusy = batches.some((b) => b.pending);
  const hasAnyResults = batches.length > 0;
  const uploadsReady = !!logo && !!productImage;

  // Total images the Generate button will produce, e.g. "Generate 2 images".
  const totalImages = views.length;
  const generateLabel =
    totalImages > 0
      ? lang === "zh"
        ? `${t.generateWord} ${totalImages} ${t.imagePlural}`
        : `${t.generateWord} ${totalImages} ${totalImages === 1 ? t.imageSingular : t.imagePlural}`
      : t.generateWord;

  // Compact human-readable summary of the settings a batch was generated with,
  // shown as chips in the batch header.
  const summarizeSettings = (s) => {
    const m = METHODS.find((x) => x.value === s.method);
    const pl = PLACEMENTS.find((x) => x.value === s.placement);
    const sz = SIZES.find((x) => x.value === s.size);
    const nm = (o) => (o ? (lang === "zh" ? o.nameZh : o.name) : "");
    const chips = [{ label: nm(m), accent: true }];
    // A drawn circle replaced placement + size for this run.
    if (s.marker) chips.push({ label: t.markChip, accent: true });
    else chips.push({ label: nm(sz) }, { label: nm(pl) });
    if (s.scene) chips.push({ label: t.sceneTag, accent: true });
    // Preset garment color the product was re-dyed to (Apollo Studio).
    if (s.garmentColor)
      chips.push({
        label: lang === "zh" ? s.garmentColor.nameZh : s.garmentColor.name,
        swatch: s.garmentColor.hex,
      });
    return chips;
  };
  const fmtTime = (ts) =>
    new Date(ts).toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <SiteHeader lang={lang} setLang={setLang} />

      <main id="top">
        {/* ---------- Studio ---------- */}
        <section id="studio" className="scroll-mt-20 py-14 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 sm:mb-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
                {t.studioEyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t.studioTitle}</h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">{t.studioSub}</p>
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[420px_1fr]">
              {/* ----- Controls panel ----- */}
              <aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                {/* Step 1 — logo upload */}
                <div className="mb-3 flex items-center gap-2.5">
                  <StepBadge n={1} done={!!logo} />
                  <h3 className="text-sm font-semibold">{t.s1Title}</h3>
                </div>
                <UploadZone
                  image={logo}
                  name={logoName}
                  hint={t.uploadHint}
                  onFile={(f) => readFile(f, setLogo, setLogoName)}
                  onClear={() => {
                    setLogo(null);
                    setLogoName("");
                  }}
                  t={t}
                />
                {/* invert logo colors — flips black↔white so a logo blends less
                    into a same-colored product (black logo on a black hat → white) */}
                {logo && (
                  <button
                    type="button"
                    onClick={invertLogo}
                    disabled={inverting}
                    title={t.invertHint}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  >
                    {inverting ? <IconSpinner className="h-3.5 w-3.5" /> : <IconInvert />}
                    {inverting ? t.inverting : t.invertLogo}
                  </button>
                )}

                {/* Step 2 — pick a preset product (no upload) + choose its color */}
                <div className="mb-3 mt-7 flex items-center gap-2.5">
                  <StepBadge n={2} done={!!productImage} />
                  <h3 className="text-sm font-semibold">{t.s2Title}</h3>
                </div>

                {/* preset product grid */}
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="text-[11px] leading-snug text-zinc-400">{t.productPickHint}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PRODUCTS.map((p) => {
                      const on = productSku === p.sku;
                      const name = lang === "zh" ? p.nameZh : p.name;
                      return (
                        <button
                          key={p.sku}
                          type="button"
                          onClick={() => selectProduct(p)}
                          aria-pressed={on}
                          title={name}
                          className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all active:scale-[0.98] ${
                            on
                              ? "border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500 dark:bg-indigo-950/40"
                              : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/40"
                          }`}
                        >
                          <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-zinc-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.file}
                              alt={name}
                              loading="lazy"
                              className="h-full w-full object-contain p-1"
                            />
                          </span>
                          <span className="line-clamp-2 text-[10px] font-medium leading-tight text-zinc-600 dark:text-zinc-300">
                            {name}
                          </span>
                          {on && (
                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm">
                              <IconCheck />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* preset color swatches — no free color picker, only these */}
                <div className="mt-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.colorLabel}</h4>
                    <span className="text-[10px] font-medium text-zinc-400">
                      {garmentColor ? (lang === "zh" ? garmentColor.nameZh : garmentColor.name) : t.colorAsShown}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* "As shown" clears the selection → keep the product's own color */}
                    <button
                      type="button"
                      onClick={() => setGarmentColor(null)}
                      aria-pressed={!garmentColor}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                        !garmentColor
                          ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400"
                          : "border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {t.colorAsShown}
                    </button>
                    {GARMENT_COLORS.map((c) => {
                      const on = garmentColor?.id === c.id;
                      const name = lang === "zh" ? c.nameZh : c.name;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectGarmentColor(c)}
                          aria-pressed={on}
                          aria-label={name}
                          title={name}
                          className={`relative flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-110 ${
                            on
                              ? "border-transparent ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
                              : "border-black/15 dark:border-white/20"
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {on && (
                            <span
                              className="drop-shadow"
                              style={{ color: relLuminance(hexToRgb(c.hex)) > 0.5 ? "#111" : "#fff" }}
                            >
                              <IconCheck />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3 — decoration method + which shots */}
                <div className="mb-3 mt-7 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <StepBadge n={3} done={views.length > 0} />
                    <h3 className="text-sm font-semibold">{t.s3Title}</h3>
                  </div>
                  {!uploadsReady && <span className="text-[11px] text-zinc-400">{t.uploadFirst}</span>}
                </div>

                {/* method — embroidered or screen print */}
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.methodLabel}</h4>
                  <div className="mt-3 flex gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
                    {METHODS.map((m) => {
                      const on = method === m.value;
                      const name = lang === "zh" ? m.nameZh : m.name;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMethod(m.value)}
                          aria-pressed={on}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition-all ${
                            on
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span>{m.emoji}</span>
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* shots — multi-select which images to generate */}
                <div className="mt-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.shotsLabel}</h4>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {VIEWS.map((v) => {
                      const on = views.includes(v.key);
                      return (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => toggleView(v.key)}
                          aria-pressed={on}
                          className={`relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                            on
                              ? "border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500 dark:bg-indigo-950/40"
                              : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/40"
                          }`}
                        >
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-zinc-100 text-lg dark:bg-zinc-800">
                            {v.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold leading-tight">
                              {lang === "zh" ? v.nameZh : v.name}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-tight text-zinc-400">
                              {lang === "zh" ? v.descZh : v.descEn}
                            </span>
                          </span>
                          {on && (
                            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm">
                              <IconCheck />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 4 — customize */}
                <div className="mb-3 mt-7 flex items-center gap-2.5">
                  <StepBadge n={4} done={false} />
                  <h3 className="text-sm font-semibold">{t.s4Title}</h3>
                </div>

                {/* circle-the-spot — opens a larger editor window over the product
                    photo. A drawn circle overrides the placement AND size controls
                    below, and only its Clear button removes it. */}
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.markTitle}</h4>
                    {marker && (
                      <button
                        type="button"
                        onClick={() => setMarker(null)}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:border-red-300 hover:text-red-500 dark:border-zinc-700"
                      >
                        {t.markClear}
                      </button>
                    )}
                  </div>
                  {productImage ? (
                    <>
                      <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">{t.markCardHint}</p>
                      <div className="mt-3 flex items-center gap-3">
                        {/* static preview of the photo with the placed circle; click to edit */}
                        <button
                          type="button"
                          onClick={() => setMarkerModal(true)}
                          aria-label={marker ? t.markEdit : t.markOpen}
                          className="relative w-20 flex-none overflow-hidden rounded-xl border border-zinc-200 transition-colors hover:border-fuchsia-400 dark:border-zinc-700"
                        >
                          {/* the un-cropped photo, so the % -positioned circle lands true */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={productImage} alt="" className="block w-full" />
                          {marker && <MarkerCircle circle={marker} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarkerModal(true)}
                          className={`rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-colors ${
                            marker
                              ? "border border-fuchsia-300 bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-400"
                              : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                          }`}
                        >
                          {marker ? t.markEdit : t.markOpen}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">{t.markNeedsProduct}</p>
                  )}
                </div>

                {/* placement — default (natural spot), pocket, or center.
                    Disabled while a drawn circle is active (the circle wins). */}
                <div className={`mt-3 rounded-2xl border border-zinc-200 p-4 transition-opacity dark:border-zinc-800 ${marker ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.logoPlacement}</h4>
                    {marker && <span className="text-[10px] font-medium text-fuchsia-500">{t.markOverride}</span>}
                  </div>
                  <div className="mt-3 flex gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
                    {PLACEMENTS.map((pl) => {
                      const on = placement === pl.value;
                      const name = lang === "zh" ? pl.nameZh : pl.name;
                      return (
                        <button
                          key={pl.value}
                          type="button"
                          onClick={() => setPlacement(pl.value)}
                          disabled={!!marker}
                          aria-pressed={on}
                          className={`flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition-all disabled:cursor-not-allowed ${
                            on
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* size — also disabled while a drawn circle is active */}
                <div className={`mt-3 rounded-2xl border border-zinc-200 p-4 transition-opacity dark:border-zinc-800 ${marker ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.logoSize}</h4>
                    {marker && <span className="text-[10px] font-medium text-fuchsia-500">{t.markOverride}</span>}
                  </div>
                  <div className="mt-3 flex gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
                    {SIZES.map((s) => {
                      const on = size === s.value;
                      const name = lang === "zh" ? s.nameZh : s.name;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setSize(s.value)}
                          disabled={!!marker}
                          aria-pressed={on}
                          className={`flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition-all disabled:cursor-not-allowed ${
                            on
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* scene background toggle */}
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.sceneBackground}</h4>
                    <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">{t.sceneHint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={scene}
                    aria-label={t.sceneBackground}
                    onClick={() => setScene((s) => !s)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      scene ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        scene ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Generate */}
                <button
                  onClick={generate}
                  disabled={!uploadsReady || !views.length || isBusy || checkingColors}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {isBusy || checkingColors ? (
                    <>
                      <IconSpinner />
                      {t.generating}
                    </>
                  ) : (
                    <>
                      <IconSparkles />
                      {generateLabel}
                    </>
                  )}
                </button>

                {error && (
                  <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                    {error}
                  </p>
                )}
              </aside>

              {/* ----- Results panel — accumulating generation history ----- */}
              <div ref={resultsRef} className="scroll-mt-20 lg:min-h-[560px]">
                {!hasAnyResults ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-800 lg:min-h-[560px]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800/80 dark:text-zinc-500">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="M21 15l-4.35-4.35a1.5 1.5 0 0 0-2.12 0L5 20" />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-base font-semibold">{t.emptyTitle}</h3>
                    <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {t.emptyBody}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-zinc-400">
                      {[t.viewProduct, t.viewCloseup, t.viewModel].map((v) => (
                        <span key={v} className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-zinc-800">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* history header — count + clear all */}
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                        {batches.length}{" "}
                        {batches.length === 1 ? t.generationsOne : t.generationsMany}
                      </h3>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 shadow-sm transition-colors hover:border-red-300 hover:text-red-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        {t.clearAll}
                      </button>
                    </div>

                    {/* each generation run is its own immutable card */}
                    {batches.map((batch) => (
                      <section
                        key={batch.id}
                        className="animate-fade-up rounded-3xl border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-5"
                      >
                        {/* batch header — the logo + product + settings this run used */}
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <div
                                title={`${t.logoTag}: ${batch.logoName}`}
                                className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-[conic-gradient(at_50%_50%,#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] bg-[length:12px_12px] dark:border-zinc-700"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={batch.logo} alt={t.logoTag} className="max-h-full max-w-full object-contain" />
                              </div>
                              <div
                                title={`${t.productTag}: ${batch.productImageName}`}
                                className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={batch.productImage} alt={t.productTag} className="h-full w-full object-cover" />
                              </div>
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">
                                  {t.generationLabel} #{batch.id}
                                </span>
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  {batch.pending
                                    ? `${batch.results.length} / ${batch.settings.views.length}`
                                    : `${batch.settings.views.length} ${
                                        batch.settings.views.length === 1 ? t.imageSingular : t.imagePlural
                                      }`}
                                </span>
                                {batch.pending ? (
                                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-500">
                                    <IconSpinner className="h-3 w-3" />
                                    {progressLabel(lang, batch.results.length, batch.settings.views.length)}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-zinc-400">{fmtTime(batch.createdAt)}</span>
                                )}
                              </div>
                              {/* settings chips */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {summarizeSettings(batch.settings).map((chip, ci) => (
                                  <span
                                    key={ci}
                                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                      chip.accent
                                        ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-400"
                                        : "border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                                    }`}
                                  >
                                    {chip.swatch && (
                                      <span
                                        className="h-2.5 w-2.5 flex-none rounded-full border border-black/15 dark:border-white/25"
                                        style={{ backgroundColor: chip.swatch }}
                                      />
                                    )}
                                    {chip.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => regenerateBatch(batch)}
                              disabled={batch.pending}
                              className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500"
                            >
                              {batch.pending ? <IconSpinner className="h-3.5 w-3.5" /> : <IconRefresh />}
                              {t.regenerate}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBatch(batch.id)}
                              aria-label={t.remove}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:border-red-300 hover:text-red-500 dark:border-zinc-700"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {batch.error && (
                          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            {batch.error}
                          </p>
                        )}

                        {/* shots in this run — results render as soon as each one
                            streams in; any view not yet arrived stays a skeleton. */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {batch.results.map((r, idx) =>
                            r.ok ? (
                              r.images.map((b64, i) => {
                                const src = `data:image/png;base64,${b64}`;
                                const viewName = viewLabel(r.view);
                                const filename = `Apollo Mockup - ${viewName}.png`;
                                return (
                                  <figure
                                    key={`${batch.id}-${idx}-${i}`}
                                    className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => openLightbox(src, viewName, filename)}
                                      className="relative block aspect-square w-full cursor-zoom-in overflow-hidden"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={src}
                                        alt={viewName}
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                                      />
                                      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                                        {viewName}
                                      </span>
                                      <span className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                      <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-zinc-700 opacity-0 shadow transition-opacity duration-200 group-hover:opacity-100">
                                        <IconExpand />
                                      </span>
                                    </button>
                                    <figcaption className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                                      <span className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                        {viewName}
                                      </span>
                                      <a
                                        href={src}
                                        download={filename}
                                        className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                      >
                                        <IconDownload />
                                        {t.download}
                                      </a>
                                    </figcaption>
                                  </figure>
                                );
                              })
                            ) : (
                              <div
                                key={`${batch.id}-${idx}-err`}
                                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-center dark:border-amber-900/60 dark:bg-amber-950/30"
                              >
                                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                  {viewLabel(r.view)} {t.shotFailed}
                                </span>
                                <span className="line-clamp-4 text-xs text-amber-600/90 dark:text-amber-500/90">
                                  {typeof r.error === "string" ? r.error : JSON.stringify(r.error)}
                                </span>
                              </div>
                            )
                          )}
                          {batch.pending &&
                            batch.settings.views
                              .filter((v) => !batch.results.some((r) => r.view === v))
                              .map((v) => (
                                <div
                                  key={`${batch.id}-skeleton-${v}`}
                                  className="skeleton-shimmer aspect-square rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60"
                                />
                              ))}
                        </div>

                        {/* Pricing appears once the mockups are done — a per-unit
                            estimate for this exact design, independent of how many
                            shots were rendered. */}
                        {!batch.pending && batch.results.some((r) => r.ok) && (
                          <PricingPanel batch={batch} t={t} lang={lang} onOrder={startOrder} />
                        )}
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} />

      {/* ---------- Color-similarity warning — shown when the logo color would sit
           almost invisibly on the product. "Continue anyway" runs the generation
           as-is; "Go back" closes so the user can change a color first. ---------- */}
      {colorWarn && (
        <div
          onClick={() => setColorWarn(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{t.colorWarnTitle}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {t.colorWarnBody}
                </p>
              </div>
            </div>

            {/* swatches: the offending logo color vs the sampled product color */}
            <div className="mt-4 flex items-center gap-3">
              {[
                { label: t.colorWarnLogo, hex: colorWarn.logoHex },
                { label: t.colorWarnProduct, hex: colorWarn.productHex },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-1 items-center gap-2.5 rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-800"
                >
                  <span
                    className="h-9 w-9 flex-none rounded-lg border border-black/10 dark:border-white/15"
                    style={{ backgroundColor: s.hex }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{s.label}</p>
                    <p className="font-mono text-xs font-semibold">{s.hex}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setColorWarn(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {t.colorWarnBack}
              </button>
              {/* one-click fix for the black-on-black case: flip the logo colors
                  and generate with the now-visible logo */}
              <button
                type="button"
                onClick={invertAndRun}
                disabled={inverting}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
              >
                {inverting ? <IconSpinner className="h-3.5 w-3.5" /> : <IconInvert />}
                {inverting ? t.inverting : t.invertLogo}
              </button>
              <button
                type="button"
                onClick={continueAnyway}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
              >
                {t.colorWarnContinue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Circle editor window — draw / move / resize the placement circle.
           Closing (Done, backdrop, Esc) keeps the circle; only Clear removes it. ---------- */}
      {markerModal && productImage && (
        <div
          onClick={() => setMarkerModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t.markTitle}</h3>
              <button
                type="button"
                onClick={() => setMarkerModal(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-600 dark:border-zinc-700 dark:hover:text-zinc-200"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="mb-3 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
              {marker ? t.markHintEdit : t.markHintDraw}
            </p>
            <div className="min-h-0 overflow-auto">
              <MarkerEditor image={productImage} marker={marker} onChange={setMarker} />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMarker(null)}
                disabled={!marker}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
              >
                {t.markClear}
              </button>
              <button
                type="button"
                onClick={() => setMarkerModal(false)}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
              >
                {t.markDone}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Lightbox — click image to toggle zoom; backdrop/Esc to close ---------- */}
      {lightbox && (
        <div
          ref={scrollRef}
          onClick={closeLightbox}
          className={`fixed inset-0 z-50 overflow-auto bg-black/85 p-4 backdrop-blur-sm ${
            zoomed ? "" : "flex items-center justify-center"
          }`}
        >
          {/* Top-right actions */}
          <div className="fixed right-4 top-4 z-10 flex items-center gap-2">
            <a
              href={lightbox.src}
              download={lightbox.filename}
              onClick={(e) => e.stopPropagation()}
              aria-label={t.download}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <IconDownload width="17" height="17" />
            </a>
            <button
              type="button"
              onClick={closeLightbox}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={zoomImgRef}
            src={lightbox.src}
            alt={lightbox.caption}
            onClick={(e) => {
              e.stopPropagation();
              // Record where on the image the user clicked (as a fraction),
              // so we can zoom toward that exact point instead of the center.
              const rect = e.currentTarget.getBoundingClientRect();
              clickFrac.current = {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height,
              };
              setZoomed((z) => !z);
            }}
            className={
              zoomed
                ? "max-w-none cursor-zoom-out"
                : "max-h-[88vh] max-w-[92vw] cursor-zoom-in rounded-lg object-contain shadow-2xl"
            }
            style={zoomed ? { width: "min(200vw, 2400px)" } : undefined}
          />

          {/* Caption + hint */}
          <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 text-center">
            <p className="text-sm font-medium text-white">{lightbox.caption}</p>
            <p className="mt-1 text-xs text-white/60">{t.zoomHint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
