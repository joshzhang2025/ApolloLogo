// app/page.js
// Landing page — hero + how-it-works. The interactive mockup studio itself
// lives at /studio; this page just introduces the product and links there.

"use client";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "./SiteChrome";

// UI copy for both languages. Switching `lang` re-renders everything.
const STRINGS = {
  en: {
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
  },
  zh: {
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
  },
};

function IconSparkles(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </svg>
  );
}

export default function Home() {
  const [lang, setLang] = useState("en");
  const t = STRINGS[lang];

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <SiteHeader lang={lang} setLang={setLang} />

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
                href="/studio"
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

          {/* ---------- Product demo — framed loop, fully visible ---------- */}
          <div className="relative mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6 sm:pb-28">
            {/* brand glow behind the frame */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-8 bottom-8 rounded-[2rem] bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20 blur-3xl"
            />
            <figure className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-indigo-950/10 dark:border-zinc-800 dark:bg-zinc-900">
              {/* window chrome bar */}
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                <span className="ml-3 rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-400 dark:bg-zinc-800">
                  apollo.studio
                </span>
              </div>
              {/* the loop */}
              <video
                className="block aspect-video w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                aria-label="Apollo turning a logo into apparel mockups"
              >
                <source src="/hero-loop.mp4" type="video/mp4" />
              </video>
            </figure>
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

      <SiteFooter lang={lang} />
    </div>
  );
}
