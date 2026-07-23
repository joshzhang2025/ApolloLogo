// app/lib/stripe.js
// SERVER-ONLY Stripe client factory. Never import this into a "use client"
// component — it reads STRIPE_SECRET_KEY, which must stay off the browser
// (same rule as OPENROUTER_API_KEY in the generate-mockups route).
import Stripe from "stripe";

// Instantiate lazily so a missing key returns null (handled by the route as a
// clean 500) instead of throwing at module-load time and crashing the build.
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // No apiVersion pin — the installed SDK's default is used, which is what you
  // want for a fresh test integration. Pin it later if you need reproducibility.
  return new Stripe(key);
}
