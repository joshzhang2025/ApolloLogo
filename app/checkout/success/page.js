// app/checkout/success/page.js
// Where Stripe redirects after a successful payment. This is a SERVER component:
// it retrieves the Checkout Session with the secret key to show the confirmed
// order. NOTE: this page is for display only — actual fulfillment happens in the
// webhook (/api/stripe-webhook), because the browser reaching this URL is not
// proof of payment on its own.
import Link from "next/link";
import { getStripe } from "@/app/lib/stripe";

export default async function CheckoutSuccessPage({ searchParams }) {
  const { session_id } = await searchParams;

  let session = null;
  const stripe = getStripe();
  if (stripe && session_id) {
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch {
      // ignore — we'll just show a generic confirmation
    }
  }

  const paid = session?.payment_status === "paid";
  const total =
    session?.amount_total != null
      ? `$${(session.amount_total / 100).toFixed(2)}`
      : null;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-md rounded-2xl border border-black/10 dark:border-white/15 p-8 text-center shadow-sm">
        <div className="text-4xl">{paid ? "✅" : "🧾"}</div>
        <h1 className="mt-4 text-2xl font-semibold">
          {paid ? "Payment successful" : "Thanks for your order"}
        </h1>
        {total && (
          <p className="mt-2 text-sm opacity-70">
            Amount paid: <span className="font-medium">{total}</span>
          </p>
        )}
        {session?.customer_details?.email && (
          <p className="mt-1 text-sm opacity-70">
            Receipt to {session.customer_details.email}
          </p>
        )}
        <Link
          href="/checkout"
          className="mt-6 inline-block rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-medium"
        >
          Back to checkout
        </Link>
      </div>
    </main>
  );
}
