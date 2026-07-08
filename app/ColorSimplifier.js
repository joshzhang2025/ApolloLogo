// app/ColorSimplifier.js
// Screen-print prep tool. Runs entirely in the browser (canvas + k-means color
// quantization) — no server, no API cost. Takes a PNG/JPG logo, merges similar
// colors down to N solid spot colors, and hands back a downloadable PNG.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { svgTargetDims, quantizeImage } from "./colorUtils";

const COLOR_CHOICES = [2, 3, 4, 5, 6];

const STRINGS = {
  en: {
    eyebrow: "Screen-print prep",
    title: "Simplify logo colors",
    sub: "Screen printing charges per ink color. Drop in a logo and reduce it to a few solid spot colors — similar shades get merged automatically — then download the print-ready PNG.",
    uploadCta: "Click to upload or drag & drop",
    uploadHint: "PNG, JPG, or SVG — transparent background works best",
    replaceHint: "click or drop to replace",
    remove: "Remove",
    inkColors: "Ink colors",
    original: "Original",
    simplified: "Simplified",
    colorsWord: "colors",
    inksWord: "inks",
    palette: "Print palette",
    download: "Download PNG",
    processing: "Simplifying…",
    costNote: "Fewer ink colors = lower screen-print cost.",
    emptyTitle: "Your simplified logo appears here",
    emptyBody: "Upload a logo and pick how many ink colors you want.",
    errNotImage: "Please choose an image file.",
    errLoad: "Could not read that image.",
    reducedFrom: "Reduced from",
  },
  zh: {
    eyebrow: "丝印预处理",
    title: "简化 Logo 配色",
    sub: "丝网印刷按油墨颜色数量收费。上传 Logo,将其精简为几种纯色(相近颜色会自动合并),然后下载可用于印刷的 PNG。",
    uploadCta: "点击上传或拖放文件",
    uploadHint: "PNG、JPG 或 SVG —— 透明背景效果最佳",
    replaceHint: "点击或拖放以替换",
    remove: "移除",
    inkColors: "油墨颜色数",
    original: "原图",
    simplified: "简化后",
    colorsWord: "种颜色",
    inksWord: "种油墨",
    palette: "印刷色板",
    download: "下载 PNG",
    processing: "处理中…",
    costNote: "油墨颜色越少,丝印成本越低。",
    emptyTitle: "简化后的 Logo 会显示在这里",
    emptyBody: "上传 Logo 并选择需要的油墨颜色数量。",
    errNotImage: "请选择图片文件。",
    errLoad: "无法读取该图片。",
    reducedFrom: "从",
  },
};

export default function ColorSimplifier({ lang = "en" }) {
  const t = STRINGS[lang] || STRINGS.en;
  const [srcUrl, setSrcUrl] = useState("/test-logo.png");
  const [srcName, setSrcName] = useState("test-logo.png");
  const [numColors, setNumColors] = useState(4);
  const [result, setResult] = useState(null); // { dataUrl, palette, originalColors }
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const readFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith("image/")) {
        setError(t.errNotImage);
        return;
      }
      setError("");
      setSrcName(file.name);
      const reader = new FileReader();
      reader.onload = () => setSrcUrl(reader.result);
      reader.readAsDataURL(file);
    },
    [t]
  );

  // Re-run whenever the image or the target color count changes. All setState
  // happens inside the image-load callback (never synchronously in the effect
  // body); result is cleared by clearAll(), so !srcUrl just no-ops here. The
  // heavy quantize is deferred via setTimeout so the spinner paints first — and
  // setTimeout fires reliably even when the tab isn't the active/visible frame.
  useEffect(() => {
    if (!srcUrl) return;
    let cancelled = false;
    let timer;
    const img = new Image();
    // Run the heavy quantize (deferred so the spinner paints first). `dims` is the
    // resolved source size, or null to use the image's own intrinsic dimensions.
    const runQuantize = (dims) => {
      timer = setTimeout(() => {
        if (cancelled) return;
        try {
          const out = quantizeImage(img, numColors, dims);
          if (!cancelled) { setResult(out); setError(""); }
        } catch {
          if (!cancelled) setError(t.errLoad);
        } finally {
          if (!cancelled) setProcessing(false);
        }
      }, 30);
    };
    img.onload = () => {
      if (cancelled) return;
      setProcessing(true);
      // Raster images carry a real intrinsic size. SVGs often report 0×0, which
      // would rasterize to 1×1 — resolve a target size from the SVG markup first.
      if (img.naturalWidth && img.naturalHeight) {
        runQuantize(null);
      } else {
        fetch(srcUrl)
          .then((r) => r.text())
          .then((svgText) => { if (!cancelled) runQuantize(svgTargetDims(svgText)); })
          .catch(() => { if (!cancelled) runQuantize({ w: SVG_BASE, h: SVG_BASE }); });
      }
    };
    img.onerror = () => {
      if (!cancelled) { setError(t.errLoad); setProcessing(false); }
    };
    img.src = srcUrl;
    return () => { cancelled = true; clearTimeout(timer); };
  }, [srcUrl, numColors, t]);

  const downloadName = useMemo(() => {
    const base = (srcName || "logo").replace(/\.[^.]+$/, "");
    return `${base}-${numColors}color.png`;
  }, [srcName, numColors]);

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    readFile(e.dataTransfer.files?.[0]);
  }
  function clearAll() {
    setSrcUrl(null);
    setSrcName("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const chkbg =
    "bg-[conic-gradient(at_50%_50%,#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] bg-[length:20px_20px]";

  return (
    <section className="py-14 pt-10 sm:py-20 sm:pt-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 sm:mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">{t.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{t.sub}</p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[380px_1fr]">
          {/* ---- Controls ---- */}
          <aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
                dragging
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                  : "border-zinc-300 hover:border-indigo-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40"
              }`}
            >
              <input ref={inputRef} type="file" accept="image/*" onChange={(e) => readFile(e.target.files?.[0])} className="hidden" />
              {srcUrl ? (
                <div className="flex w-full items-center gap-3 text-left">
                  <div className={`flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 ${chkbg}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={srcUrl} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{srcName}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{t.replaceHint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearAll(); }}
                    className="flex-none rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-red-300 hover:text-red-500 dark:border-zinc-700"
                  >
                    {t.remove}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 transition-transform group-hover:scale-105 dark:bg-indigo-950 dark:text-indigo-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

            {/* ink color count */}
            <div className="mt-5 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.inkColors}</h3>
                <span className="text-[11px] text-zinc-400">
                  {numColors} {t.inksWord}
                </span>
              </div>
              <div className="mt-3 flex gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
                {COLOR_CHOICES.map((n) => {
                  const on = numColors === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNumColors(n)}
                      aria-pressed={on}
                      className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-all ${
                        on ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-zinc-400">{t.costNote}</p>
            </div>

            {/* print palette */}
            {result && result.palette.length > 0 && (
              <div className="mt-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.palette}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.palette.map((p) => (
                    <span key={p.hex} className="flex items-center gap-1.5 rounded-full border border-zinc-200 py-1 pl-1 pr-2.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                      <span className="h-4 w-4 rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: p.hex }} />
                      {p.hex}
                    </span>
                  ))}
                </div>
                {result.originalColors > 0 && (
                  <p className="mt-3 text-[11px] text-zinc-400">
                    {t.reducedFrom} {result.originalColors.toLocaleString()} {t.colorsWord} → {result.palette.length} {t.inksWord}
                  </p>
                )}
              </div>
            )}

            {/* download */}
            <a
              href={result?.dataUrl || undefined}
              download={downloadName}
              aria-disabled={!result || processing}
              onClick={(e) => { if (!result || processing) e.preventDefault(); }}
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition-all ${
                result && !processing
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-600/25 hover:brightness-110 active:scale-[0.99]"
                  : "cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
              }`}
            >
              {processing ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  {t.processing}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {t.download}
                </>
              )}
            </a>
            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>
            )}
          </aside>

          {/* ---- Before / after preview ---- */}
          <div className="lg:min-h-[420px]">
            {!srcUrl ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-800 lg:min-h-[420px]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800/80 dark:text-zinc-500">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r="2.5" />
                    <circle cx="17.5" cy="10.5" r="2.5" />
                    <circle cx="8.5" cy="7.5" r="2.5" />
                    <circle cx="6.5" cy="12.5" r="2.5" />
                    <path d="M12 22a10 10 0 1 1 0-20 8 8 0 0 0 0 16h1.5a2.5 2.5 0 0 1 0 5H12z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold">{t.emptyTitle}</h3>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t.emptyBody}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <figure className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className={`flex aspect-square w-full items-center justify-center overflow-hidden p-4 ${chkbg}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={srcUrl} alt={t.original} className="max-h-full max-w-full object-contain" />
                  </div>
                  <figcaption className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">{t.original}</span>
                    {result?.originalColors > 0 && (
                      <span className="text-zinc-400">{result.originalColors.toLocaleString()} {t.colorsWord}</span>
                    )}
                  </figcaption>
                </figure>

                <figure className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className={`relative flex aspect-square w-full items-center justify-center overflow-hidden p-4 ${chkbg}`}>
                    {result && !processing ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={result.dataUrl} alt={t.simplified} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="skeleton-shimmer absolute inset-0" />
                    )}
                  </div>
                  <figcaption className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">{t.simplified}</span>
                    {result && !processing && (
                      <span className="text-indigo-500">{result.palette.length} {t.inksWord}</span>
                    )}
                  </figcaption>
                </figure>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
