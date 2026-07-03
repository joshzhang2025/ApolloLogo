// app/page.js
// FRONTEND — runs in the browser. It calls YOUR endpoint (/api/generate-mockups),
// never OpenRouter directly, so your API key is never exposed here.

"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// `shots` mirrors the backend's views per product: embroidered items get a third
// close-up shot (stitch detail is what gets approved on); screenprint gets two.
// `placeable` marks products where the Pocket/Center placement choice applies —
// only shirts. Hats (front panel) and beanies (cuff) have a fixed natural spot.
const PRODUCTS = [
  { key: "shirt-embroidered", label: "Shirt — Embroidered", labelZh: "T恤 · 刺绣", emoji: "👕", shots: 3, placeable: true },
  { key: "shirt-screenprint", label: "Shirt — Screen Print", labelZh: "T恤 · 丝网印刷", emoji: "🖨️", shots: 2, placeable: true },
  { key: "hat-embroidered", label: "Hat — Embroidered", labelZh: "帽子 · 刺绣", emoji: "🧢", shots: 3 },
  { key: "beanie-embroidered", label: "Beanie — Embroidered", labelZh: "毛线帽 · 刺绣", emoji: "🧶", shots: 3 },
];

// Garment colors. `value` is the wording sent to the model; `hex` is just the
// swatch shown in the UI. `null` value = each product's natural default color.
const COLORS = [
  { value: null, name: "Default", nameZh: "默认", hex: null },
  { value: "white", name: "White", nameZh: "白色", hex: "#ffffff" },
  { value: "black", name: "Black", nameZh: "黑色", hex: "#18181b" },
  { value: "heather-gray", name: "Gray", nameZh: "灰色", hex: "#9ca3af" },
  { value: "navy", name: "Navy", nameZh: "藏青", hex: "#1e293b" },
  { value: "royal blue", name: "Royal Blue", nameZh: "宝蓝", hex: "#1d4ed8" },
  { value: "forest green", name: "Green", nameZh: "墨绿", hex: "#15803d" },
  { value: "red", name: "Red", nameZh: "红色", hex: "#dc2626" },
  { value: "maroon", name: "Maroon", nameZh: "酒红", hex: "#7f1d1d" },
  { value: "sand tan", name: "Sand", nameZh: "沙色", hex: "#d6c9a8" },
];

// Where the logo sits on the garment. Kept to the two placements that actually
// matter for merch: a large centered print, or a small chest-pocket / left-chest logo.
const PLACEMENTS = [
  { value: "pocket", name: "Pocket", nameZh: "口袋处" },
  { value: "center", name: "Center", nameZh: "居中" },
];

// Logo size. "medium" is the neutral default (sent as no size adjective).
const SIZES = [
  { value: "small", name: "Small", nameZh: "小" },
  { value: "medium", name: "Medium", nameZh: "中" },
  { value: "large", name: "Large", nameZh: "大" },
];

// UI copy for both languages. Switching `lang` re-renders everything.
const STRINGS = {
  en: {
    navHow: "How it works",
    navStudio: "Studio",
    navCta: "Open the studio",
    heroBadge: "Apollo · AI Merch Mockups",
    heroTitle1: "Your logo on real merch,",
    heroTitle2: "rendered in seconds.",
    heroSub:
      "Upload a single logo file and Apollo returns production-grade mockups — a clean product shot, a stitch-level close-up, and an on-model photo for every embroidered piece.",
    heroCtaPrimary: "Try the studio",
    heroCtaSecondary: "See how it works",
    heroStat1: "4 products",
    heroStat2: "Up to 3 shots each",
    heroStat3: "Embroidery & screen print",
    studioEyebrow: "The studio",
    studioTitle: "Create your mockups",
    studioSub: "Upload once — every product gets a consistent, client-ready shot set.",
    s1Title: "Upload your logo",
    s2Title: "Choose products",
    s3Title: "Fine-tune the look",
    selectProducts: "Select products",
    garmentColor: "Garment color",
    logoPlacement: "Logo placement",
    placementDefault: "Default",
    logoSize: "Logo size",
    sceneBackground: "Scene background",
    sceneHint: "On-model shots get a lifestyle setting behind the model",
    uploadFirst: "Upload a logo first",
    uploadCta: "Click to upload or drag & drop",
    uploadHint: "PNG, JPG, or SVG — transparent background works best",
    replaceHint: "click or drop to replace",
    remove: "Remove",
    generating: "Generating…",
    generateWord: "Generate",
    imageSingular: "image",
    imagePlural: "images",
    download: "Download",
    zoomHint: "Click image to zoom · click outside or Esc to close",
    langButton: "中文",
    errNoLogo: "Upload a logo first.",
    errNoSelection: "Select at least one product.",
    errNotImage: "Please choose an image file.",
    shotFailed: "shot failed:",
    viewProduct: "Product",
    viewCloseup: "Close-up",
    viewModel: "On Model",
    shotList3: "Product · Close-up · On model",
    shotList2: "Product · On model",
    shotsWord3: "3 shots",
    shotsWord2: "2 shots",
    resultsTitle: "Your mockups",
    generationsOne: "generation",
    generationsMany: "generations",
    clearAll: "Clear all",
    generationLabel: "Generation",
    sceneTag: "Scene",
    emptyTitle: "Your mockups will appear here",
    emptyBody:
      "Upload a logo, pick at least one product, then hit Generate. Every run is saved below — change the logo or products and generate again, and nothing you already made goes away.",
    regenerate: "Regenerate",
    howEyebrow: "Workflow",
    howTitle: "From file to approval in three steps",
    howSteps: [
      {
        t: "Upload your logo",
        d: "PNG, JPG or SVG — transparent backgrounds work best. Colors are kept pixel-faithful across every shot.",
      },
      {
        t: "Pick products & style",
        d: "Choose garments, colors, placement and size. Toggle a lifestyle scene behind the model shots.",
      },
      {
        t: "Generate & approve",
        d: "Every embroidered piece gets a product shot, a stitch-level close-up, and an on-model photo — ready to send.",
      },
    ],
    footerNote: "Demo build. All mockups are AI-generated previews, not production samples.",
  },
  zh: {
    navHow: "工作流程",
    navStudio: "工作台",
    navCta: "打开工作台",
    heroBadge: "Apollo · AI 服装样机",
    heroTitle1: "您的 Logo 穿上真实商品，",
    heroTitle2: "几秒内完成渲染。",
    heroSub:
      "只需上传一个 Logo 文件，Apollo 即可生成专业级样机 —— 每件刺绣产品都包含产品图、针脚级细节特写和模特上身图。",
    heroCtaPrimary: "试用工作台",
    heroCtaSecondary: "了解工作流程",
    heroStat1: "4 种产品",
    heroStat2: "每款最多 3 张图",
    heroStat3: "刺绣与丝网印刷",
    studioEyebrow: "工作台",
    studioTitle: "生成您的样机",
    studioSub: "只需上传一次 —— 每个产品都会获得一套风格统一、可直接交付的样机图。",
    s1Title: "上传 Logo",
    s2Title: "选择产品",
    s3Title: "调整细节",
    selectProducts: "选择产品",
    garmentColor: "服装颜色",
    logoPlacement: "Logo 位置",
    placementDefault: "默认",
    logoSize: "Logo 大小",
    sceneBackground: "场景背景",
    sceneHint: "模特上身图会在模特身后加入生活场景",
    uploadFirst: "请先上传 Logo",
    uploadCta: "点击上传或拖放文件",
    uploadHint: "PNG、JPG 或 SVG —— 透明背景效果最佳",
    replaceHint: "点击或拖放以替换",
    remove: "移除",
    generating: "生成中…",
    generateWord: "生成",
    imageSingular: "张图片",
    imagePlural: "张图片",
    download: "下载",
    zoomHint: "点击图片放大 · 点击空白处或按 Esc 关闭",
    langButton: "English",
    errNoLogo: "请先上传 Logo。",
    errNoSelection: "请至少选择一个产品。",
    errNotImage: "请选择图片文件。",
    shotFailed: "图生成失败：",
    viewProduct: "产品",
    viewCloseup: "特写",
    viewModel: "模特上身",
    shotList3: "产品 · 特写 · 模特上身",
    shotList2: "产品 · 模特上身",
    shotsWord3: "3 张图",
    shotsWord2: "2 张图",
    resultsTitle: "您的样机",
    generationsOne: "次生成",
    generationsMany: "次生成",
    clearAll: "清除全部",
    generationLabel: "生成",
    sceneTag: "场景",
    emptyTitle: "样机将显示在这里",
    emptyBody: "上传 Logo，至少选择一个产品，然后点击生成。每次生成都会保存在下方 —— 更换 Logo 或产品后再次生成,之前的成果都不会消失。",
    regenerate: "重新生成",
    howEyebrow: "工作流程",
    howTitle: "从文件到定稿,只需三步",
    howSteps: [
      {
        t: "上传 Logo",
        d: "PNG、JPG 或 SVG —— 透明背景效果最佳。所有样机中的 Logo 颜色保持像素级一致。",
      },
      {
        t: "选择产品与风格",
        d: "选择服装、颜色、Logo 位置和大小，还可为模特上身图开启生活场景背景。",
      },
      {
        t: "生成并定稿",
        d: "每件刺绣产品都包含产品图、针脚级细节特写和模特上身图 —— 可直接发给客户。",
      },
    ],
    footerNote: "演示版本。所有样机均为 AI 生成的预览图，并非实际生产样品。",
  },
};

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
function IconGlobe(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
export default function Home() {
  const [lang, setLang] = useState("en");
  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [selected, setSelected] = useState([]); // product keys chosen for the next generation
  const [color, setColor] = useState(null); // garment color value, or null for each product's default
  const [placement, setPlacement] = useState("pocket"); // logo position: pocket | center
  const [size, setSize] = useState("medium"); // logo size: small | medium | large
  const [scene, setScene] = useState(false); // on-model shots get a lifestyle background when true
  // Every Generate run is appended here as its own immutable batch — nothing is
  // overwritten, so changing the logo/products and generating again keeps every
  // photo you've already made. Newest batch is first.
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { src, caption, filename } | null
  const [zoomed, setZoomed] = useState(false);
  const inputRef = useRef(null);
  const batchSeq = useRef(0); // monotonic id for each generation batch
  const resultsRef = useRef(null); // scrolled into view on mobile when generating
  const scrollRef = useRef(null); // lightbox scroll container
  const zoomImgRef = useRef(null); // enlarged image
  const clickFrac = useRef({ x: 0.5, y: 0.5 }); // where the user clicked (0..1)

  const t = STRINGS[lang];
  const productLabel = (p) => (lang === "zh" ? p.labelZh : p.label);
  const viewLabel = (view) =>
    view === "model" ? t.viewModel : view === "closeup" ? t.viewCloseup : t.viewProduct;

  // Keep the document language in sync with the UI language.
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

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

  const readFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith("image/")) {
        setError(t.errNotImage);
        return;
      }
      setError("");
      setLogoName(file.name);
      const reader = new FileReader();
      reader.onload = () => setLogo(reader.result); // base64 data URL
      reader.readAsDataURL(file);
    },
    [t]
  );

  function onFile(e) {
    readFile(e.target.files?.[0]);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    readFile(e.dataTransfer.files?.[0]);
  }

  function toggle(key) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  // Kick off one generation run. Each run captures the logo + settings it used
  // and appends a new batch to the history; existing batches are never touched.
  // `regenerate` replays a past batch with its own captured logo/settings.
  const runGeneration = useCallback(
    async ({ keys, logo: runLogo, logoName: runLogoName, settings }) => {
      if (!runLogo) return setError(t.errNoLogo);
      if (!keys.length) return setError(t.errNoSelection);
      setError("");
      const id = ++batchSeq.current;
      const batch = {
        id,
        logo: runLogo,
        logoName: runLogoName,
        createdAt: Date.now(),
        keys: PRODUCTS.map((p) => p.key).filter((k) => keys.includes(k)), // stable order
        settings,
        pending: true,
        error: "",
        resultsByKey: {},
      };
      setBatches((bs) => [batch, ...bs]);
      // On small screens the results live below the controls — bring them into view.
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
        requestAnimationFrame(() =>
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        );
      }
      try {
        const res = await fetch("/api/generate-mockups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logo: runLogo,
            products: batch.keys,
            color: settings.color,
            placement: settings.placement,
            size: settings.size,
            scene: settings.scene,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        const grouped = {};
        for (const r of data.results || []) {
          (grouped[r.productKey] ||= []).push(r);
        }
        setBatches((bs) =>
          bs.map((b) => (b.id === id ? { ...b, resultsByKey: grouped, pending: false } : b))
        );
      } catch (e) {
        setBatches((bs) =>
          bs.map((b) => (b.id === id ? { ...b, error: e.message, pending: false } : b))
        );
      }
    },
    [t]
  );

  const generate = () =>
    runGeneration({ keys: selected, logo, logoName, settings: { color, placement, size, scene } });

  const regenerateBatch = (b) =>
    runGeneration({ keys: b.keys, logo: b.logo, logoName: b.logoName, settings: b.settings });

  const removeBatch = (id) => setBatches((bs) => bs.filter((b) => b.id !== id));
  const clearAll = () => setBatches([]);

  const isBusy = batches.some((b) => b.pending);
  const pendingKeySet = new Set(batches.flatMap((b) => (b.pending ? b.keys : [])));
  const hasAnyResults = batches.length > 0;

  // Placement only applies to shirts. Show the control unless the current
  // selection is exclusively hats/beanies (where it's meaningless).
  const keysHavePlaceable = (keys) =>
    keys.some((k) => PRODUCTS.find((p) => p.key === k)?.placeable);
  const showPlacement = selected.length === 0 || keysHavePlaceable(selected);

  // Total images the Generate button will produce, e.g. "Generate 8 images".
  const totalImages = selected.reduce(
    (n, k) => n + (PRODUCTS.find((p) => p.key === k)?.shots ?? 2),
    0
  );
  const generateLabel =
    totalImages > 0
      ? lang === "zh"
        ? `${t.generateWord} ${totalImages} ${t.imagePlural}`
        : `${t.generateWord} ${totalImages} ${totalImages === 1 ? t.imageSingular : t.imagePlural}`
      : t.generateWord;

  const activeColor = COLORS.find((c) => c.value === color);

  // Compact human-readable summary of the settings a batch was generated with,
  // shown as chips in the batch header. `keys` lets us drop the placement chip for
  // hat/beanie-only runs, where placement wasn't applied.
  const summarizeSettings = (s, keys) => {
    const c = COLORS.find((x) => x.value === s.color);
    const pl = PLACEMENTS.find((x) => x.value === s.placement);
    const sz = SIZES.find((x) => x.value === s.size);
    const nm = (o) => (o ? (lang === "zh" ? o.nameZh : o.name) : t.placementDefault);
    const chips = [
      { swatch: c?.hex ?? null, label: nm(c) },
      { label: nm(sz) },
    ];
    if (keysHavePlaceable(keys)) chips.push({ label: nm(pl) });
    if (s.scene) chips.push({ label: t.sceneTag, accent: true });
    return chips;
  };
  const batchImageCount = (b) =>
    b.keys.reduce((n, k) => n + (PRODUCTS.find((p) => p.key === k)?.shots ?? 2), 0);
  const fmtTime = (ts) =>
    new Date(ts).toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* ---------- Sticky nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/70 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <IconSparkles />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Apollo</span>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-400">
              Studio
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400 md:flex">
            <a href="#how" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
              {t.navHow}
            </a>
            <a href="#studio" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
              {t.navStudio}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang((l) => (l === "en" ? "zh" : "en"))}
              className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-500"
              aria-label="Toggle language"
            >
              <IconGlobe />
              {t.langButton}
            </button>
            <a
              href="#studio"
              className="hidden rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:block"
            >
              {t.navCta}
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          {/* decorative glow + dot grid */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15" />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
                backgroundSize: "26px 26px",
                color: "rgba(120,120,135,0.16)",
                maskImage: "linear-gradient(to bottom, black 20%, transparent 85%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 20%, transparent 85%)",
              }}
            />
          </div>

          <div className="relative mx-auto w-full max-w-4xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-20 sm:pt-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
              </span>
              {t.heroBadge}
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              {t.heroTitle1}
              <br />
              <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                {t.heroTitle2}
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg">
              {t.heroSub}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#studio"
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110 active:scale-[0.98] sm:w-auto"
              >
                <IconSparkles />
                {t.heroCtaPrimary}
              </a>
              <a
                href="#how"
                className="flex w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 sm:w-auto"
              >
                {t.heroCtaSecondary}
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {[t.heroStat1, t.heroStat2, t.heroStat3].map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

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
                {/* Step 1 — upload */}
                <div className="mb-3 flex items-center gap-2.5">
                  <StepBadge n={1} done={!!logo} />
                  <h3 className="text-sm font-semibold">{t.s1Title}</h3>
                </div>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
                    dragging
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                      : "border-zinc-300 hover:border-indigo-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                  {logo ? (
                    <div className="flex w-full items-center gap-3 text-left">
                      <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-[conic-gradient(at_50%_50%,#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] bg-[length:14px_14px] dark:border-zinc-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logo} alt="logo preview" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{logoName}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">{t.replaceHint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLogo(null);
                          setLogoName("");
                          if (inputRef.current) inputRef.current.value = "";
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
                      <p className="text-xs text-zinc-400">{t.uploadHint}</p>
                    </div>
                  )}
                </div>

                {/* Step 2 — products */}
                <div className="mb-3 mt-7 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <StepBadge n={2} done={selected.length > 0} />
                    <h3 className="text-sm font-semibold">{t.s2Title}</h3>
                  </div>
                  {!logo && <span className="text-[11px] text-zinc-400">{t.uploadFirst}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {PRODUCTS.map((p) => {
                    const on = selected.includes(p.key);
                    const loading = pendingKeySet.has(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => toggle(p.key)}
                        aria-pressed={on}
                        className={`relative flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                          on
                            ? "border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500 dark:bg-indigo-950/40"
                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/40"
                        }`}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-lg dark:bg-zinc-800">
                          {p.emoji}
                        </span>
                        <span className="text-xs font-semibold leading-tight">{productLabel(p)}</span>
                        <span className="text-[10px] leading-tight text-zinc-400">
                          {p.shots === 3 ? t.shotList3 : t.shotList2}
                        </span>
                        {on && !loading && (
                          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm">
                            <IconCheck />
                          </span>
                        )}
                        {loading && (
                          <span className="absolute right-2 top-2 text-indigo-500">
                            <IconSpinner />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Step 3 — customize */}
                <div className="mb-3 mt-7 flex items-center gap-2.5">
                  <StepBadge n={3} done={false} />
                  <h3 className="text-sm font-semibold">{t.s3Title}</h3>
                </div>

                {/* color */}
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.garmentColor}</h4>
                    <span className="text-[11px] text-zinc-400">
                      {activeColor ? (lang === "zh" ? activeColor.nameZh : activeColor.name) : t.placementDefault}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {COLORS.map((c) => {
                      const on = color === c.value;
                      const name = lang === "zh" ? c.nameZh : c.name;
                      return (
                        <button
                          key={c.value ?? "default"}
                          type="button"
                          onClick={() => setColor(c.value)}
                          title={name}
                          aria-label={name}
                          aria-pressed={on}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                            on
                              ? "border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
                              : "border-zinc-200 hover:scale-110 dark:border-zinc-700"
                          }`}
                        >
                          {c.hex ? (
                            <span
                              className="h-6 w-6 rounded-full border border-black/10 dark:border-white/20"
                              style={{ backgroundColor: c.hex }}
                            />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-zinc-400 text-zinc-400">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <line x1="5" y1="19" x2="19" y2="5" />
                              </svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* placement — center or chest-pocket, as a segmented control.
                    Hidden when only hats/beanies are selected (placement is a shirt thing). */}
                {showPlacement && (
                  <div className="mt-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.logoPlacement}</h4>
                    <div className="mt-3 flex gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
                      {PLACEMENTS.map((pl) => {
                        const on = placement === pl.value;
                        const name = lang === "zh" ? pl.nameZh : pl.name;
                        return (
                          <button
                            key={pl.value}
                            type="button"
                            onClick={() => setPlacement(pl.value)}
                            aria-pressed={on}
                            className={`flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition-all ${
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
                )}

                {/* size */}
                <div className="mt-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.logoSize}</h4>
                  <div className="mt-3 flex gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
                    {SIZES.map((s) => {
                      const on = size === s.value;
                      const name = lang === "zh" ? s.nameZh : s.name;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setSize(s.value)}
                          aria-pressed={on}
                          className={`flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition-all ${
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
                  disabled={!logo || !selected.length || isBusy}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {isBusy ? (
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
                        {/* batch header — the logo + settings this run used */}
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-[conic-gradient(at_50%_50%,#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] bg-[length:12px_12px] dark:border-zinc-700">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={batch.logo} alt="" className="max-h-full max-w-full object-contain" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">
                                  {t.generationLabel} #{batch.id}
                                </span>
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  {batchImageCount(batch)}{" "}
                                  {batchImageCount(batch) === 1 ? t.imageSingular : t.imagePlural}
                                </span>
                                {!batch.pending && (
                                  <span className="text-[11px] text-zinc-400">{fmtTime(batch.createdAt)}</span>
                                )}
                              </div>
                              {/* settings chips */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {summarizeSettings(batch.settings, batch.keys).map((chip, ci) => (
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
                                        className="h-2.5 w-2.5 rounded-full border border-black/10 dark:border-white/20"
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

                        {/* products in this run */}
                        <div className="space-y-5">
                          {batch.keys.map((key) => {
                            const product = PRODUCTS.find((p) => p.key === key);
                            const results = batch.resultsByKey[key];
                            return (
                              <div key={key}>
                                <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-sm dark:bg-zinc-800">
                                    {product?.emoji}
                                  </span>
                                  {product ? productLabel(product) : key}
                                </h4>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                  {batch.pending
                                    ? Array.from({ length: product?.shots ?? 2 }, (_, n) => (
                                        <div
                                          key={`${batch.id}-${key}-skeleton-${n}`}
                                          className="skeleton-shimmer aspect-square rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60"
                                        />
                                      ))
                                    : (results || []).map((r, idx) =>
                                        r.ok ? (
                                          r.images.map((b64, i) => {
                                            const src = `data:image/png;base64,${b64}`;
                                            const viewName = viewLabel(r.view);
                                            const displayLabel = product ? productLabel(product) : r.label;
                                            const filename = `${r.label} - ${viewName}.png`;
                                            return (
                                              <figure
                                                key={`${batch.id}-${key}-${idx}-${i}`}
                                                className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() => openLightbox(src, `${displayLabel} — ${viewName}`, filename)}
                                                  className="relative block aspect-square w-full cursor-zoom-in overflow-hidden"
                                                >
                                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                                  <img
                                                    src={src}
                                                    alt={`${displayLabel} ${viewName}`}
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
                                            key={`${batch.id}-${key}-${idx}-err`}
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="scroll-mt-20 border-t border-zinc-200/70 py-14 dark:border-zinc-800/70 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">{t.howEyebrow}</p>
            <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">{t.howTitle}</h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-3">
              {t.howSteps.map((step, i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <span className="font-mono text-xs font-semibold text-indigo-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-base font-semibold">{step.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-zinc-200/70 py-8 dark:border-zinc-800/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <IconSparkles width="11" height="11" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Apollo Studio</span>
          </div>
          <p className="text-xs text-zinc-400">{t.footerNote}</p>
        </div>
      </footer>

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
