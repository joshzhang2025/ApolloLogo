// app/api/checkout/session/route.js
// BACKEND — returns a SANITIZED summary of one Checkout Session so the order
// confirmation page can show real line items + total after a payment. The cart
// is in-memory and gone after the Stripe round-trip, so the session (looked up
// with the secret key here) is the source of truth for what was bought.

import { getStripe } from "@/app/lib/stripe";

export const runtime = "nodejs";

export async function GET(req) {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json(
      { error: "Stripe is not configured." },
      { status: 500 }
    );
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing session id." }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ["line_items"],
    });
    // Return only what the confirmation UI needs — never the whole object.
    return Response.json({
      id: session.id,
      paid: session.payment_status === "paid",
      amountTotal: session.amount_total, // cents
      currency: session.currency,
      email: session.customer_details?.email ?? null,
      lineItems: (session.line_items?.data ?? []).map((li) => ({
        name: li.description,
        amount: li.amount_total, // cents, includes quantity
        quantity: li.quantity,
      })),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 404 });
  }
}
