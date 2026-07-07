// app/simplify/page.js
// The color simplifier as its own route, separate from the mockup studio at
// "/" — clicking "Simplify" in the nav is a real navigation, not a scroll.
"use client";
import { useEffect, useState } from "react";
import ColorSimplifier from "../ColorSimplifier";
import { SiteHeader, SiteFooter } from "../SiteChrome";

export default function SimplifyPage() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <SiteHeader lang={lang} setLang={setLang} />
      <main>
        <ColorSimplifier lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
