// app/page.js
// FRONTEND — runs in the browser. It calls YOUR endpoint (/api/generate-mockups),
// never OpenRouter directly, so your API key is never exposed here.

"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const PRODUCTS = [
  { key: "shirt-embroidered", label: "Shirt — Embroidered", labelZh: "T恤 · 刺绣", emoji: "👕" },
  { key: "shirt-screenprint", label: "Shirt — Screen Print", labelZh: "T恤 · 丝网印刷", emoji: "🖨️" },
  { key: "hat-embroidered", label: "Hat — Embroidered", labelZh: "帽子 · 刺绣", emoji: "🧢" },
  { key: "beanie-embroidered", label: "Beanie — Embroidered", labelZh: "毛线帽 · 刺绣", emoji: "🧶" },
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

// UI copy for both languages. Switching `lang` re-renders everything.
const STRINGS = {
  en: {
    badge: "Apollo · AI Merch Mockups",
    title: "Logo → Embroidered Mockups",
    subtitle:
      "Drop in a logo, select products, then confirm to generate a clean product shot and an on-model shot for each.",
    selectProducts: "Select products",
    garmentColor: "Garment color",
    uploadFirst: "Upload a logo first",
    uploadCta: "Click to upload or drag & drop your logo",
    uploadHint: "PNG, JPG, or SVG — transparent background works best",
    replaceHint: "click or drop to replace",
    confirm: "Confirm",
    generating: "Generating…",
    download: "Download",
    zoomHint: "Click image to zoom · click outside or Esc to close",
    langButton: "中文",
    errNoLogo: "Upload a logo first.",
    errNoSelection: "Select at least one product.",
    errNotImage: "Please choose an image file.",
    shotFailed: "shot failed:",
    viewProduct: "Product",
    viewModel: "On Model",
  },
  zh: {
    badge: "Apollo · AI 服装样机",
    title: "Logo → 刺绣样机",
    subtitle: "上传 Logo，选择产品，然后点击确认，为每个产品生成一张产品图和一张模特上身图。",
    selectProducts: "选择产品",
    garmentColor: "服装颜色",
    uploadFirst: "请先上传 Logo",
    uploadCta: "点击上传或拖放您的 Logo",
    uploadHint: "PNG、JPG 或 SVG —— 透明背景效果最佳",
    replaceHint: "点击或拖放以替换",
    confirm: "确认",
    generating: "生成中…",
    download: "下载",
    zoomHint: "点击图片放大 · 点击空白处或按 Esc 关闭",
    langButton: "English",
    errNoLogo: "请先上传 Logo。",
    errNoSelection: "请至少选择一个产品。",
    errNotImage: "请选择图片文件。",
    shotFailed: "图生成失败：",
    viewProduct: "产品",
    viewModel: "模特上身",
  },
};

export default function Home() {
  const [lang, setLang] = useState("en");
  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [selected, setSelected] = useState([]); // product keys chosen for the next generation
  const [color, setColor] = useState(null); // garment color value, or null for each product's default
  const [loadingKeys, setLoadingKeys] = useState([]); // product keys currently generating
  const [resultsByKey, setResultsByKey] = useState({}); // key -> [result, result] (accumulates)
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { src, caption } | null
  const [zoomed, setZoomed] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null); // lightbox scroll container
  const zoomImgRef = useRef(null); // enlarged image
  const clickFrac = useRef({ x: 0.5, y: 0.5 }); // where the user clicked (0..1)

  function openLightbox(src, caption) {
    setZoomed(false);
    setLightbox({ src, caption });
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

  const t = STRINGS[lang];
  const productLabel = (p) => (lang === "zh" ? p.labelZh : p.label);
  const viewLabel = (view) => (view === "model" ? t.viewModel : t.viewProduct);

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

  async function generate() {
    if (!logo) return setError(t.errNoLogo);
    if (!selected.length) return setError(t.errNoSelection);
    setError("");
    const keys = selected;
    setLoadingKeys((s) => Array.from(new Set([...s, ...keys])));
    try {
      const res = await fetch("/api/generate-mockups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo, products: keys, color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      // Group new results by product key and MERGE — previously generated
      // products are preserved; only the regenerated keys are replaced.
      const grouped = {};
      for (const r of data.results || []) {
        (grouped[r.productKey] ||= []).push(r);
      }
      setResultsByKey((m) => ({ ...m, ...grouped }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingKeys((s) => s.filter((k) => !keys.includes(k)));
    }
  }

  const orderedResultKeys = PRODUCTS.map((p) => p.key).filter((k) => resultsByKey[k]);
  const pendingNewKeys = loadingKeys.filter((k) => !resultsByKey[k]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        {/* Top bar with language toggle (top right) */}
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setLang((l) => (l === "en" ? "zh" : "en"))}
            className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-500"
            aria-label="Toggle language"
          >
            {t.langButton}
          </button>
        </div>

        {/* Header */}
        <header className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-500 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            {t.badge}
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
        </header>

        {/* Controls card */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-8">
          {/* Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                : "border-zinc-300 hover:border-indigo-400 dark:border-zinc-700"
            }`}
          >
            <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            {logo ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-[conic-gradient(at_50%_50%,#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] bg-[length:16px_16px] dark:border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt="logo preview" className="max-h-full max-w-full object-contain" />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">{logoName}</span> — {t.replaceHint}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-sm font-medium">{t.uploadCta}</p>
                <p className="text-xs text-zinc-400">{t.uploadHint}</p>
              </div>
            )}
          </div>

          {/* Product picker — click to select, then Confirm to generate */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t.selectProducts}</h2>
              {!logo && <span className="text-xs text-zinc-400">{t.uploadFirst}</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRODUCTS.map((p) => {
                const on = selected.includes(p.key);
                const loading = loadingKeys.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggle(p.key)}
                    className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                      on
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="text-xs font-medium leading-tight">{productLabel(p)}</span>
                    {on && !loading && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                    {loading && (
                      <span className="absolute right-2 top-2">
                        <svg className="h-4 w-4 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Garment color picker — applies to every selected product */}
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t.garmentColor}</h2>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => {
                const on = color === c.value;
                const name = lang === "zh" ? c.nameZh : c.name;
                return (
                  <button
                    key={c.value ?? "default"}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={name}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      on
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }`}
                  >
                    {c.hex ? (
                      <span
                        className="h-4 w-4 rounded-full border border-black/10 dark:border-white/20"
                        style={{ backgroundColor: c.hex }}
                      />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-zinc-400 text-zinc-400">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <line x1="5" y1="19" x2="19" y2="5" />
                        </svg>
                      </span>
                    )}
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirm button */}
          <button
            onClick={generate}
            disabled={!logo || !selected.length || loadingKeys.length > 0}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingKeys.length > 0 ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                {t.generating}
              </>
            ) : (
              t.confirm
            )}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}
        </section>

        {/* Results — grouped per product, two large shots side by side. Accumulates. */}
        <div className="mt-10 space-y-10">
          {orderedResultKeys.map((key) => {
            const product = PRODUCTS.find((p) => p.key === key);
            const results = resultsByKey[key];
            return (
              <section key={key}>
                <h2 className="mb-4 text-lg font-semibold">
                  {product?.emoji} {product ? productLabel(product) : key}
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {results.map((r, idx) =>
                    r.ok ? (
                      r.images.map((b64, i) => {
                        const src = `data:image/png;base64,${b64}`;
                        const viewName = viewLabel(r.view);
                        const displayLabel = product ? productLabel(product) : r.label;
                        return (
                          <figure
                            key={`${key}-${idx}-${i}`}
                            className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <button
                              type="button"
                              onClick={() => openLightbox(src, `${displayLabel} — ${viewName}`)}
                              className="relative block aspect-square w-full cursor-zoom-in overflow-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt={`${displayLabel} ${viewName}`}
                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                                {viewName}
                              </span>
                            </button>
                            <figcaption className="flex items-center justify-between gap-2 px-4 py-3">
                              <span className="text-sm font-medium">
                                {displayLabel} — {viewName}
                              </span>
                              <a
                                href={src}
                                download={`${r.label} - ${viewLabel(r.view)}.png`}
                                className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                              >
                                {t.download}
                              </a>
                            </figcaption>
                          </figure>
                        );
                      })
                    ) : (
                      <p
                        key={`${key}-${idx}-err`}
                        className="flex items-center rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      >
                        <span className="font-medium">
                          {viewLabel(r.view)} {t.shotFailed}
                        </span>
                        &nbsp;
                        {typeof r.error === "string" ? r.error : JSON.stringify(r.error)}
                      </p>
                    )
                  )}
                  {/* skeletons if this already-generated product is being regenerated */}
                  {loadingKeys.includes(key) &&
                    [0, 1].map((n) => (
                      <div key={`${key}-skeleton-${n}`} className="aspect-square animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                    ))}
                </div>
              </section>
            );
          })}

          {/* skeletons for products being generated for the first time */}
          {pendingNewKeys.map((key) => {
            const product = PRODUCTS.find((p) => p.key === key);
            return (
              <section key={`pending-${key}`}>
                <h2 className="mb-4 text-lg font-semibold">
                  {product?.emoji} {product ? productLabel(product) : key}
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {[0, 1].map((n) => (
                    <div key={n} className="aspect-square animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* Lightbox — click an image to open; click image to toggle zoom; backdrop/Esc to close */}
      {lightbox && (
        <div
          ref={scrollRef}
          onClick={closeLightbox}
          className={`fixed inset-0 z-50 overflow-auto bg-black/85 p-4 backdrop-blur-sm ${
            zoomed ? "" : "flex items-center justify-center"
          }`}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close"
            className="fixed right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

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
