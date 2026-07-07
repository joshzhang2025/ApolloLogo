// app/SiteChrome.js
// Shared sticky header + footer used by every route, so the mockup studio
// (/) and the color simplifier (/simplify) look like one product even
// though they're now separate pages instead of anchored sections.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STRINGS = {
  en: {
    navHow: "How it works",
    navStudio: "Studio",
    navSimplify: "Simplify",
    navCta: "Open the studio",
    langButton: "中文",
    footerNote: "Demo build. All mockups are AI-generated previews, not production samples.",
  },
  zh: {
    navHow: "工作流程",
    navStudio: "工作台",
    navSimplify: "简化配色",
    navCta: "打开工作台",
    langButton: "English",
    footerNote: "演示版本。所有样机均为 AI 生成的预览图，并非实际生产样品。",
  },
};

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

export function SiteHeader({ lang, setLang }) {
  const t = STRINGS[lang];
  const pathname = usePathname();
  const onSimplify = pathname === "/simplify";
  const onStudio = pathname === "/studio";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/70 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <IconSparkles />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Apollo</span>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-400">
            Studio
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400 md:flex">
          <Link href="/#how" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
            {t.navHow}
          </Link>
          <Link
            href="/studio"
            className={`transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${
              onStudio ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""
            }`}
          >
            {t.navStudio}
          </Link>
          <Link
            href="/simplify"
            className={`transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${
              onSimplify ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""
            }`}
          >
            {t.navSimplify}
          </Link>
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
          <Link
            href="/studio"
            className="hidden rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:block"
          >
            {t.navCta}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ lang }) {
  const t = STRINGS[lang];
  return (
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
  );
}
