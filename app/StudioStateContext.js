// app/StudioStateContext.js
// Holds a mockup studio's "work in progress" — the uploaded logo & product
// photo, the current settings, the drawn placement circle, and the append-only
// list of generation batches. It lives here (mounted in the root layout) rather
// than inside the /studio page so that navigating away to /simplify or / and
// back does NOT wipe everything: the root layout persists across client-side
// navigation, so this provider never unmounts. (It does reset on a full page
// reload — that state is in memory, not storage, because the generated images
// are large base64 blobs that would blow past sessionStorage's quota.)
//
// There are TWO independent studios — the main Studio (/studio) and Apollo
// Studio (/apollo-studio) — each with its OWN separate copy of this state so
// uploads/settings/generations on one never leak into the other. The shared
// state logic lives in useStudioStateValue(); each provider calls it once, so
// each gets a fully independent instance.
"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

// The three shot types, in canonical order — the default is "generate all three".
const DEFAULT_VIEWS = ["product", "closeup", "model"];

// Build one independent studio's state (all the useState/useRef). Called once
// per provider instance, so the main Studio and Apollo Studio don't share it.
function useStudioStateValue() {
  // UI language — lives here (not per-page useState) so it survives navigating
  // between "/", "/studio", and "/simplify" instead of resetting to English.
  const [lang, setLang] = useState("en");
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [productImage, setProductImage] = useState(null);
  const [productImageName, setProductImageName] = useState("");
  // Apollo Studio only: which preset product is picked (its sku) and the chosen
  // preset garment color ({ name, nameZh, hex } or null = keep the product's
  // own color). The main Studio uploads its own product and ignores both.
  const [productSku, setProductSku] = useState(null);
  const [garmentColor, setGarmentColor] = useState(null);
  const [method, setMethod] = useState("embroidery"); // embroidery | screenprint
  const [views, setViews] = useState(DEFAULT_VIEWS); // which shots to generate
  const [placement, setPlacement] = useState("default"); // default | pocket | center
  const [size, setSize] = useState("medium"); // small | medium | large
  const [scene, setScene] = useState(false); // lifestyle background on model shots
  const [marker, setMarker] = useState(null); // drawn circle { x, y, r } or null
  // Every Generate run is appended here as its own immutable batch — nothing is
  // overwritten, so changing the images/settings and generating again keeps every
  // photo you've already made. Newest batch is first.
  const [batches, setBatches] = useState([]);
  // Apollo Studio order flow: the design the customer clicked "Order" on (seeds
  // the order page), and their in-memory cart of order lines. Both survive
  // cross-route navigation but reset on a full reload, like the rest of this state.
  const [orderDraft, setOrderDraft] = useState(null);
  const [cart, setCart] = useState([]);
  // Monotonic id for each generation batch. A ref in the provider (not the page)
  // so ids keep climbing across navigation instead of colliding after a remount.
  const batchSeq = useRef(0);

  return {
    lang, setLang,
    logo, setLogo,
    logoName, setLogoName,
    productImage, setProductImage,
    productImageName, setProductImageName,
    productSku, setProductSku,
    garmentColor, setGarmentColor,
    method, setMethod,
    views, setViews,
    placement, setPlacement,
    size, setSize,
    scene, setScene,
    marker, setMarker,
    batches, setBatches,
    orderDraft, setOrderDraft,
    cart, setCart,
    batchSeq,
  };
}

// ---- Main Studio (/studio) ----
const StudioStateContext = createContext(null);

export function StudioStateProvider({ children }) {
  const value = useStudioStateValue();
  return <StudioStateContext.Provider value={value}>{children}</StudioStateContext.Provider>;
}

export function useStudioState() {
  const ctx = useContext(StudioStateContext);
  if (!ctx) throw new Error("useStudioState must be used within StudioStateProvider");
  return ctx;
}

// ---- Apollo Studio (/apollo-studio) — a fully separate copy of the same state ----
const ApolloStudioStateContext = createContext(null);

export function ApolloStudioStateProvider({ children }) {
  const value = useStudioStateValue();
  return <ApolloStudioStateContext.Provider value={value}>{children}</ApolloStudioStateContext.Provider>;
}

export function useApolloStudioState() {
  const ctx = useContext(ApolloStudioStateContext);
  if (!ctx) throw new Error("useApolloStudioState must be used within ApolloStudioStateProvider");
  return ctx;
}
