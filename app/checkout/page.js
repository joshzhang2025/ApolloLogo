// app/checkout/page.js
// A minimal test checkout page at /checkout. Click "Pay" → POSTs to
// /api/checkout → redirects to Stripe's hosted payment page. Use Stripe test
// card 4242 4242 4242 4242, any future expiry, any CVC, any ZIP.
"use client";

import { useState } from "react";

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: "Apollo Studio Test Order",
          amount: 2500, // $25.00, in cents
          quantity: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout.");
      }
      // Hand off to Stripe's hosted page.
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-md rounded-2xl border border-black/10 dark:border-white/15 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Test checkout</h1>
        <p className="mt-2 text-sm opacity-70">
          A sandbox order to verify the Stripe flow end to end.
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-black/10 dark:border-white/15 pt-4">
          <span>Apollo Studio Test Order</span>
          <span className="font-medium">$25.00</span>
        </div>

        <button
          onClick={handlePay}
          disabled={loading}
          className="mt-6 w-full rounded-full bg-foreground text-background py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Pay $25.00"}
        </button>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <p className="mt-6 text-xs opacity-60">
          Test card: 4242 4242 4242 4242 · any future date · any CVC · any ZIP
        </p>
      </div>
    </main>
  );
}
