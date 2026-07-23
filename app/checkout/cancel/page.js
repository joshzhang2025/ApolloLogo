// app/checkout/cancel/page.js
// Where Stripe redirects if the customer backs out of the hosted payment page.
import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-md rounded-2xl border border-black/10 dark:border-white/15 p-8 text-center shadow-sm">
        <div className="text-4xl">↩️</div>
        <h1 className="mt-4 text-2xl font-semibold">Checkout canceled</h1>
        <p className="mt-2 text-sm opacity-70">
          No charge was made. You can try again anytime.
        </p>
        <Link
          href="/checkout"
          className="mt-6 inline-block rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-medium"
        >
          Return to checkout
        </Link>
      </div>
    </main>
  );
}
