// app/studio/page.js
// FRONTEND — runs in the browser. It calls YOUR endpoint (/api/generate-mockups),
// never OpenRouter directly, so your API key is never exposed here.

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "../SiteChrome";

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

// UI copy for both languages. Switching `lang` re-renders everything.
const STRINGS = {
  en: {
    studioEyebrow: "The studio",
    studioTitle: "Create your mockups",
    studioSub: "Upload your logo and your product — get a consistent, client-ready shot set.",
    s1Title: "Upload your logo",
    s2Title: "Upload your product",
    s3Title: "Choose method & shots",
    s4Title: "Fine-tune the look",
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
  },
  zh: {
    studioEyebrow: "工作台",
    studioTitle: "生成您的样机",
    studioSub: "上传您的 Logo 和产品图 —— 获得一套风格统一、可直接交付的样机图。",
    s1Title: "上传 Logo",
    s2Title: "上传产品图",
    s3Title: "选择工艺与镜头",
    s4Title: "调整细节",
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
    dragRef.current = { mode: "draw", cx: p.x, cy: p.y };
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
      // radius in on-screen px, normalized to the photo's width
      const r = Math.hypot((p.x - d.cx) * p.w, (p.y - d.cy) * p.h) / p.w;
      setDraft({ x: d.cx, y: d.cy, r: Math.min(r, 0.5) });
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
      setDraft((dr) => {
        if (dr) onChange({ x: dr.x, y: dr.y, r: dr.r < 0.02 ? 0.1 : dr.r }); // click = standard spot
        return null;
      });
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
  const [lang, setLang] = useState("en");
  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [productImage, setProductImage] = useState(null);
  const [productImageName, setProductImageName] = useState("");
  const [method, setMethod] = useState("embroidery"); // embroidery | screenprint
  const [views, setViews] = useState(VIEWS.map((v) => v.key)); // which shots to generate
  const [placement, setPlacement] = useState("default"); // logo position: default | pocket | center
  const [size, setSize] = useState("medium"); // logo size: small | medium | large
  const [marker, setMarker] = useState(null); // user-drawn circle { x, y, r } on the product photo, or null
  const [markerModal, setMarkerModal] = useState(false); // circle-editor window open?
  const [scene, setScene] = useState(false); // on-model shots get a lifestyle background when true
  // Every Generate run is appended here as its own immutable batch — nothing is
  // overwritten, so changing the images/settings and generating again keeps every
  // photo you've already made. Newest batch is first.
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null); // { src, caption, filename } | null
  const [zoomed, setZoomed] = useState(false);
  const batchSeq = useRef(0); // monotonic id for each generation batch
  const resultsRef = useRef(null); // scrolled into view on mobile when generating
  const scrollRef = useRef(null); // lightbox scroll container
  const zoomImgRef = useRef(null); // enlarged image
  const clickFrac = useRef({ x: 0.5, y: 0.5 }); // where the user clicked (0..1)

  const t = STRINGS[lang];
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

  // Close the circle editor on Escape (closing keeps the circle — only Clear removes it).
  useEffect(() => {
    if (!markerModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMarkerModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [markerModal]);

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
        const markerImage = batch.settings.marker
          ? await makeMarkerImage(runProduct, batch.settings.marker)
          : null;
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
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        setBatches((bs) =>
          bs.map((b) => (b.id === id ? { ...b, results: data.results || [], pending: false } : b))
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
    runGeneration({
      logo,
      logoName,
      productImage,
      productImageName,
      settings: { method, views, placement, size, scene, marker },
    });

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

                {/* Step 2 — product photo upload */}
                <div className="mb-3 mt-7 flex items-center gap-2.5">
                  <StepBadge n={2} done={!!productImage} />
                  <h3 className="text-sm font-semibold">{t.s2Title}</h3>
                </div>
                <UploadZone
                  image={productImage}
                  name={productImageName}
                  hint={t.productUploadHint}
                  onFile={(f) => {
                    setMarker(null); // a circle drawn on the old photo is meaningless on a new one
                    readFile(f, setProductImage, setProductImageName);
                  }}
                  onClear={() => {
                    setMarker(null);
                    setProductImage(null);
                    setProductImageName("");
                  }}
                  t={t}
                />

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
                  disabled={!uploadsReady || !views.length || isBusy}
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
                                  {batch.settings.views.length}{" "}
                                  {batch.settings.views.length === 1 ? t.imageSingular : t.imagePlural}
                                </span>
                                {!batch.pending && (
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

                        {/* shots in this run */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {batch.pending
                            ? batch.settings.views.map((v) => (
                                <div
                                  key={`${batch.id}-skeleton-${v}`}
                                  className="skeleton-shimmer aspect-square rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60"
                                />
                              ))
                            : batch.results.map((r, idx) =>
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
                        </div>
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
