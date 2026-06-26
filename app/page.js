// app/page.js
// FRONTEND — runs in the browser. It calls YOUR endpoint (/api/generate-mockups),
// never OpenRouter directly, so your API key is never exposed here.

"use client";
import { useCallback, useRef, useState } from "react";

const PRODUCTS = [
  { key: "shirt-embroidered", label: "Shirt — Embroidered", emoji: "👕" },
  { key: "shirt-screenprint", label: "Shirt — Screen Print", emoji: "🖨️" },
  { key: "hat-embroidered", label: "Hat — Embroidered", emoji: "🧢" },
  { key: "beanie-embroidered", label: "Beanie — Embroidered", emoji: "🧶" },
];

export default function Home() {
  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [selected, setSelected] = useState(PRODUCTS.map((p) => p.key));
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const readFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError("");
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result); // base64 data URL
    reader.readAsDataURL(file);
  }, []);

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

  const allSelected = selected.length === PRODUCTS.length;
  function toggleAll() {
    setSelected(allSelected ? [] : PRODUCTS.map((p) => p.key));
  }

  async function generate() {
    if (!logo) return setError("Upload a logo first.");
    if (!selected.length) return setError("Pick at least one product.");
    setError("");
    setResults([]);
    setLoading(true);
    try {
      const res = await fetch("/api/generate-mockups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo, products: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResults(data.results || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const flatImages = results.flatMap((r) =>
    r.ok ? r.images.map((b64, i) => ({ label: r.label, src: `data:image/png;base64,${b64}`, key: `${r.label}-${i}` })) : []
  );
  const failures = results.filter((r) => !r.ok);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-100">
      <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
        {/* Header */}
        <header className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-500 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            Apollo · AI Merch Mockups
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Logo&nbsp;→&nbsp;Embroidered Mockups
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-zinc-500 dark:text-zinc-400">
            Drop in a logo and instantly preview it embroidered and printed on real merch.
          </p>
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
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">{logoName}</span> — click or drop to replace
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
                <p className="text-sm font-medium">Click to upload or drag &amp; drop your logo</p>
                <p className="text-xs text-zinc-400">PNG, JPG, or SVG — transparent background works best</p>
              </div>
            )}
          </div>

          {/* Product picker */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Products</h2>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRODUCTS.map((p) => {
                const on = selected.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggle(p.key)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                      on
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="text-xs font-medium leading-tight">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={generate}
            disabled={loading || !logo}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                Generating mockups…
              </>
            ) : (
              "Generate Mockups"
            )}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}
        </section>

        {/* Loading skeletons */}
        {loading && (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {selected.map((k) => (
              <div key={k} className="aspect-square animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && flatImages.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">Your mockups</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {flatImages.map((img) => (
                <figure
                  key={img.key}
                  className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="relative aspect-square overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={img.label} className="h-full w-full object-cover" />
                  </div>
                  <figcaption className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="text-sm font-medium">{img.label}</span>
                    <a
                      href={img.src}
                      download={`${img.label}.png`}
                      className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      Download
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* Failures */}
        {!loading && failures.length > 0 && (
          <div className="mt-6 space-y-2">
            {failures.map((r) => (
              <p
                key={r.label}
                className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              >
                <span className="font-medium">{r.label}</span> failed:{" "}
                {typeof r.error === "string" ? r.error : JSON.stringify(r.error)}
              </p>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
