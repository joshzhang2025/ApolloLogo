// app/api/checkout/route.js
// BACKEND — creates a Stripe Checkout Session and returns its hosted URL.
// The browser POSTs the cart/order here, gets back { url }, and redirects to
// Stripe's hosted payment page. The secret key never leaves the server.

import { getStripe } from "@/app/lib/stripe";

export const runtime = "nodejs"; // Stripe SDK uses Node crypto

// Prices are defined inline via `price_data` so you don't have to pre-create
// Products/Prices in the Stripe dashboard — ideal for testing. Amounts are in
// the currency's smallest unit (cents for USD): 2500 = $25.00.
const CURRENCY = "usd";

export async function POST(req) {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local." },
      { status: 500 }
    );
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // empty/invalid body — fall through to the demo default below
  }

  // Accept either a full { items: [{ name, amount, quantity }] } cart, or a
  // single { productName, amount, quantity } for the simplest test call.
  let items = Array.isArray(body.items) ? body.items : null;
  if (!items) {
    items = [
      {
        name: body.productName || "Apollo Studio Test Order",
        amount: Number.isFinite(body.amount) ? body.amount : 2500,
        quantity: Number.isFinite(body.quantity) ? body.quantity : 1,
      },
    ];
  }

  const line_items = items.map((it) => ({
    price_data: {
      currency: CURRENCY,
      product_data: { name: String(it.name || "Item") },
      unit_amount: Math.max(1, Math.round(Number(it.amount) || 0)),
    },
    quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
  }));

  // Build absolute success/cancel URLs from the request origin so this works on
  // localhost and on the deployed Netlify domain without hardcoding either.
  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  // Callers can send users back into their own flow (e.g. the order page)
  // instead of the generic /checkout/success + /checkout/cancel pages. Paths
  // are treated as app-relative and resolved against the request origin.
  const successPath =
    typeof body.successPath === "string" ? body.successPath : "/checkout/success";
  const cancelPath =
    typeof body.cancelPath === "string" ? body.cancelPath : "/checkout/cancel";

  // Append the session-id placeholder by hand — URL() would percent-encode the
  // {CHECKOUT_SESSION_ID} braces, which Stripe needs to see literally.
  const sep = successPath.includes("?") ? "&" : "?";
  const success_url = `${origin}${successPath}${sep}session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = `${origin}${cancelPath}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url,
      cancel_url,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
