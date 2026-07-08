// app/simplify/page.js
// The color simplifier as its own route, separate from the mockup studio at
// "/" — clicking "Simplify" in the nav is a real navigation, not a scroll.
"use client";
import ColorSimplifier from "../ColorSimplifier";
import { SiteHeader, SiteFooter } from "../SiteChrome";
import { useStudioState } from "../StudioStateContext";

export default function SimplifyPage() {
  const { lang, setLang } = useStudioState();

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
