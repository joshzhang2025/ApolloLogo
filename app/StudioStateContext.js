// app/StudioStateContext.js
// Holds the mockup studio's "work in progress" — the uploaded logo & product
// photo, the current settings, the drawn placement circle, and the append-only
// list of generation batches. It lives here (mounted in the root layout) rather
// than inside the /studio page so that navigating away to /simplify or / and
// back does NOT wipe everything: the root layout persists across client-side
// navigation, so this provider never unmounts. (It does reset on a full page
// reload — that state is in memory, not storage, because the generated images
// are large base64 blobs that would blow past sessionStorage's quota.)
"use client";
import { createContext, useContext, useRef, useState } from "react";

// The three shot types, in canonical order — the default is "generate all three".
const DEFAULT_VIEWS = ["product", "closeup", "model"];

const StudioStateContext = createContext(null);

export function StudioStateProvider({ children }) {
  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [productImage, setProductImage] = useState(null);
  const [productImageName, setProductImageName] = useState("");
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
  // Monotonic id for each generation batch. A ref in the provider (not the page)
  // so ids keep climbing across navigation instead of colliding after a remount.
  const batchSeq = useRef(0);

  const value = {
    logo, setLogo,
    logoName, setLogoName,
    productImage, setProductImage,
    productImageName, setProductImageName,
    method, setMethod,
    views, setViews,
    placement, setPlacement,
    size, setSize,
    scene, setScene,
    marker, setMarker,
    batches, setBatches,
    batchSeq,
  };

  return <StudioStateContext.Provider value={value}>{children}</StudioStateContext.Provider>;
}

export function useStudioState() {
  const ctx = useContext(StudioStateContext);
  if (!ctx) throw new Error("useStudioState must be used within StudioStateProvider");
  return ctx;
}
