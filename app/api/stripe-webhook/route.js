// app/api/stripe-webhook/route.js
// BACKEND — Stripe calls THIS endpoint (not the browser) after a payment.
// This is where you "link the payment to something": fulfill the order, mark it
// paid, grant credits, send a receipt, etc. It's the source of truth for
// payment success — never trust the browser redirect alone (a user can hit the
// success URL without paying).
//
// Signature verification needs the EXACT raw request body, so we read it with
// req.text() (NOT req.json()) and hand the untouched string to Stripe.

import { getStripe } from "@/app/lib/stripe";

export const runtime = "nodejs";

export async function POST(req) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json(
      { error: "Webhook not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." },
      { status: 500 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    // constructEventAsync works in every runtime (uses async crypto).
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, secret);
  } catch (err) {
    // A bad signature means the request didn't really come from Stripe (or the
    // secret is wrong). Return 400 so Stripe knows delivery failed.
    return Response.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // === FULFILL THE ORDER HERE ===
      // e.g. look up your order by session.id or session.metadata, mark it paid,
      // grant access, email a receipt. For now we just log it.
      console.log("✅ Payment complete:", {
        sessionId: session.id,
        amountTotal: session.amount_total, // cents
        currency: session.currency,
        email: session.customer_details?.email,
      });
      break;
    }
    default:
      // Many event types arrive; ignore the ones you don't handle.
      console.log("Unhandled Stripe event:", event.type);
  }

  // Acknowledge receipt so Stripe stops retrying.
  return Response.json({ received: true });
}
