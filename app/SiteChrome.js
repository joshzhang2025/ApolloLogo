// app/SiteChrome.js
// Shared sticky header + footer used by every route, so the mockup studio
// (/) and the color simplifier (/simplify) look like one product even
// though they're now separate pages instead of anchored sections.
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloStudioState } from "./StudioStateContext";
import { productBySku, computePricing, lineTotal } from "./apollo-studio/catalog";

const STRINGS = {
  en: {
    navHow: "How it works",
    navStudio: "Studio",
    navApollo: "Apollo Studio",
    navSimplify: "Simplify",
    navCta: "Open the studio",
    langButton: "中文",
    footerNote: "Demo build. All mockups are AI-generated previews, not production samples.",
    cartAria: "Cart",
    cartTitle: "Cart",
    cartEmpty: "Your cart is empty",
    cartUnits: "units",
    cartSubtotal: "Subtotal",
    cartRemove: "Remove",
    orderNow: "Order now",
  },
  zh: {
    navHow: "工作流程",
    navStudio: "工作台",
    navApollo: "Apollo 工作台",
    navSimplify: "简化配色",
    navCta: "打开工作台",
    langButton: "English",
    footerNote: "演示版本。所有样机均为 AI 生成的预览图，并非实际生产样品。",
    cartAria: "购物车",
    cartTitle: "购物车",
    cartEmpty: "购物车是空的",
    cartUnits: "件",
    cartSubtotal: "小计",
    cartRemove: "移除",
    orderNow: "立即下单",
  },
};

const money = (n) => `$${n.toFixed(2)}`;

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

function IconCart(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

// Cart button + dropdown for the Apollo Studio order flow. Reads the shared
// Apollo cart, so it reflects whatever the customer added on any Apollo page.
// Only renders on /apollo-studio routes (the other pages have no cart concept).
function CartMenu({ lang }) {
  const t = STRINGS[lang];
  const pathname = usePathname();
  const router = useRouter();
  const { cart, setCart } = useApolloStudioState();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!pathname.startsWith("/apollo-studio")) return null;

  const count = cart.length;
  const subtotal = cart.reduce((sum, l) => sum + lineTotal(computePricing(l.draft), l.qty), 0);
  const colorLabel = (c) => (lang === "zh" ? c.nameZh : c.name);
  const goOrder = () => {
    setOpen(false);
    router.push("/apollo-studio/order");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.cartAria}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow-sm transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-500"
      >
        <IconCart />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold leading-none text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-1 pb-2">
            <h3 className="text-sm font-semibold">{t.cartTitle}</h3>
            <span className="text-[11px] text-zinc-400">{count}</span>
          </div>

          {count === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-zinc-400">{t.cartEmpty}</p>
          ) : (
            <>
              <ul className="max-h-72 space-y-2 overflow-auto">
                {cart.map((l) => {
                  const p = productBySku(l.draft.productSku);
                  const total = lineTotal(computePricing(l.draft), l.qty);
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-2.5 rounded-xl border border-zinc-100 p-2 dark:border-zinc-800"
                    >
                      <div className="h-11 w-11 flex-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                        {l.draft.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.draft.preview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p?.file} alt="" className="h-full w-full object-contain p-0.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{lang === "zh" ? p?.nameZh : p?.name}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 flex-none rounded-full border border-black/15 dark:border-white/25"
                            style={{ backgroundColor: l.color.hex }}
                          />
                          <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                            {colorLabel(l.color)} · {l.qty} {t.cartUnits}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-semibold tabular-nums">{money(total)}</span>
                        <button
                          type="button"
                          onClick={() => setCart((c) => c.filter((x) => x.id !== l.id))}
                          aria-label={t.cartRemove}
                          className="text-zinc-300 transition-colors hover:text-red-500"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-2 flex items-center justify-between border-t border-zinc-200 px-1 pt-2 dark:border-zinc-800">
                <span className="text-xs font-semibold">{t.cartSubtotal}</span>
                <span className="text-sm font-bold tabular-nums">{money(subtotal)}</span>
              </div>
              <button
                type="button"
                onClick={goOrder}
                className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                {t.orderNow}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ lang, setLang }) {
  const t = STRINGS[lang];
  const pathname = usePathname();
  const onSimplify = pathname === "/simplify";
  const onStudio = pathname === "/studio";
  const onApolloStudio = pathname === "/apollo-studio";

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
            href="/apollo-studio"
            className={`transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${
              onApolloStudio ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""
            }`}
          >
            {t.navApollo}
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
          <CartMenu lang={lang} />
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
