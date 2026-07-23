// app/apollo-studio/order/page.js
// Order page for Apollo Studio. The customer arrives here from a generated
// design's "Order this design" button (which seeds `orderDraft` in the shared
// state). Here they pick a garment color, a quantity (a size breakdown for
// shirts), see the price, and add line(s) to an in-memory cart. They can add
// the same design in multiple colors as separate cart lines.
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "../../SiteChrome";
import { useApolloStudioState } from "../../StudioStateContext";
import {
  GARMENT_COLORS,
  PRICE_TIERS,
  productBySku,
  isApparel,
  computePricing,
  unitPriceForQty,
  setupForQty,
  lineTotal,
} from "../catalog";

const STRINGS = {
  en: {
    back: "Back to studio",
    title: "Place an order",
    sub: "Choose a color, quantity, and sizes, then add to your cart.",
    noDesign: "No design selected",
    noDesignBody: "Generate a mockup in the studio, then hit “Order this design”.",
    goStudio: "Go to the studio",
    designLabel: "Your design",
    emb: "Embroidery",
    print: "Screen print",
    stitches: "stitches",
    colorsOne: "ink color",
    colorsMany: "ink colors",
    colorLabel: "Garment color",
    qtyLabel: "Quantity",
    sizesLabel: "Sizes",
    sizesHint: "Enter how many of each size.",
    totalUnits: "Total units",
    unitPrice: "Price / unit",
    setup: "Set-up",
    setupWaived: "waived at 144+",
    lineEstimate: "Line estimate",
    volumePricing: "Volume pricing",
    addToCart: "Add to cart",
    enterQty: "Enter a quantity to add.",
    cart: "Your cart",
    cartEmpty: "Your cart is empty.",
    remove: "Remove",
    each: "ea",
    units: "units",
    subtotal: "Subtotal",
    checkout: "Place order",
    checkoutLoading: "Redirecting to payment…",
    checkoutError: "Couldn’t start checkout. Please try again.",
    keepShopping: "Add another design",
    placedTitle: "Payment received",
    placedBody: "Your payment went through in Stripe test mode — no real money moved. In production, this is where the order is confirmed and a receipt is sent.",
    orderNo: "Ref ",
    disclaimer: "Example pricing for demonstration only — not a real quote.",
    // Order-received confirmation page
    rcvLoading: "Confirming your order…",
    rcvTitle: "Order received",
    rcvSub: "Thanks! Your payment was successful and your order is confirmed.",
    rcvTestNote: "Stripe test mode — no real money moved.",
    rcvRef: "Order reference",
    rcvReceipt: "Receipt sent to",
    rcvItems: "Items",
    rcvTotal: "Total paid",
    rcvBack: "Back to studio",
    rcvAnother: "Place another order",
  },
  zh: {
    back: "返回工作台",
    title: "下单",
    sub: "选择颜色、数量和尺码，然后加入购物车。",
    noDesign: "未选择设计",
    noDesignBody: "先在工作台生成样机，然后点击“订购此设计”。",
    goStudio: "前往工作台",
    designLabel: "您的设计",
    emb: "刺绣",
    print: "丝网印刷",
    stitches: "针",
    colorsOne: "个印色",
    colorsMany: "个印色",
    colorLabel: "产品颜色",
    qtyLabel: "数量",
    sizesLabel: "尺码",
    sizesHint: "输入每个尺码的数量。",
    totalUnits: "总件数",
    unitPrice: "单价",
    setup: "制版费",
    setupWaived: "满 144 件免收",
    lineEstimate: "本行小计",
    volumePricing: "批量价格",
    addToCart: "加入购物车",
    enterQty: "请输入数量。",
    cart: "购物车",
    cartEmpty: "购物车是空的。",
    remove: "移除",
    each: "件",
    units: "件",
    subtotal: "小计",
    checkout: "提交订单",
    checkoutLoading: "正在跳转到支付…",
    checkoutError: "无法开始结账，请重试。",
    keepShopping: "添加其他设计",
    placedTitle: "支付成功",
    placedBody: "已在 Stripe 测试模式下完成支付 —— 未产生真实费用。在正式环境中，此处将确认订单并发送收据。",
    orderNo: "编号 ",
    disclaimer: "示例价格，仅供演示，非正式报价。",
    // 订单确认页
    rcvLoading: "正在确认您的订单…",
    rcvTitle: "订单已收到",
    rcvSub: "感谢您的下单！支付成功，订单已确认。",
    rcvTestNote: "Stripe 测试模式 —— 未产生真实费用。",
    rcvRef: "订单编号",
    rcvReceipt: "收据已发送至",
    rcvItems: "商品",
    rcvTotal: "支付总额",
    rcvBack: "返回工作台",
    rcvAnother: "再下一单",
  },
};

const money = (n) => `$${n.toFixed(2)}`;
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const isLight = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
};

function IconCheck(props) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconArrowLeft(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// One color swatch button.
function ColorDot({ color, on, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`relative flex h-8 w-8 items-center justify-center rounded-full border transition-transform hover:scale-110 ${
        on
          ? "border-transparent ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
          : "border-black/15 dark:border-white/20"
      }`}
      style={{ backgroundColor: color.hex }}
    >
      {on && <span style={{ color: isLight(color.hex) ? "#111" : "#fff" }}><IconCheck /></span>}
    </button>
  );
}

export default function OrderPage() {
  const { lang, setLang, orderDraft, cart, setCart } = useApolloStudioState();
  const t = STRINGS[lang];

  const product = orderDraft ? productBySku(orderDraft.productSku) : null;
  const apparel = isApparel(product);
  const pricing = useMemo(() => (orderDraft ? computePricing(orderDraft) : null), [orderDraft]);

  // Configurator state. Default color = the design's color, else the first preset.
  const [color, setColor] = useState(orderDraft?.garmentColor || GARMENT_COLORS[0]);
  const [qty, setQty] = useState(72); // non-apparel single quantity
  const [sizeQty, setSizeQty] = useState({}); // apparel: { S: n, ... }
  // `placed` drives the full "Order received" confirmation view. Shapes:
  //   null                → normal order flow
  //   { loading: true }   → confirming (fetching session details)
  //   { ref, email, amountTotal, currency, lineItems } → confirmed
  const [placed, setPlaced] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  // Stripe redirects back here with ?paid=1&session_id=… after a completed
  // payment. This is a one-shot read of the URL that only a full external
  // navigation can produce, so an on-mount effect is the right tool (the cart is
  // already empty — the in-memory provider reset during the reload). We fetch the
  // session's real line items/total from the server to show a proper receipt.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "1") return;
    const sid = params.get("session_id");
    window.history.replaceState({}, "", "/apollo-studio/order");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaced({ loading: true });
    if (!sid) {
      setPlaced({ ref: null, lineItems: [] });
      return;
    }
    fetch(`/api/checkout/session?id=${encodeURIComponent(sid)}`)
      .then((r) => r.json())
      .then((d) =>
        setPlaced({
          ref: sid.slice(-8).toUpperCase(),
          email: d.email ?? null,
          amountTotal: d.amountTotal ?? null,
          currency: d.currency ?? "usd",
          lineItems: Array.isArray(d.lineItems) ? d.lineItems : [],
        })
      )
      .catch(() =>
        setPlaced({ ref: sid.slice(-8).toUpperCase(), lineItems: [] })
      );
  }, []);

  const colorLabel = (c) => (lang === "zh" ? c.nameZh : c.name);
  const currentQty = apparel
    ? Object.values(sizeQty).reduce((a, b) => a + (Number(b) || 0), 0)
    : Number(qty) || 0;

  const setSize = (key, val) => {
    const n = Math.max(0, Math.floor(Number(val) || 0));
    setSizeQty((s) => ({ ...s, [key]: n }));
  };

  const addToCart = () => {
    if (!orderDraft || currentQty < 1) return;
    const sizes = apparel
      ? Object.fromEntries(Object.entries(sizeQty).filter(([, n]) => Number(n) > 0))
      : null;
    const line = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      draft: orderDraft,
      color,
      sizes,
      qty: currentQty,
    };
    setCart((c) => [...c, line]);
    // Reset the quantity inputs but keep the color for quick multi-color adds.
    setQty(72);
    setSizeQty({});
  };

  const removeLine = (id) => setCart((c) => c.filter((l) => l.id !== id));

  const cartSubtotal = cart.reduce((sum, l) => sum + lineTotal(computePricing(l.draft), l.qty), 0);

  // Real Stripe Checkout. Each cart line becomes one Stripe line item priced at
  // its full line total (unit price × qty + any set-up), so the amount charged
  // matches the subtotal shown here exactly. On success Stripe returns the
  // customer to this page with ?paid=1 (handled by the effect above).
  const checkout = async () => {
    if (!cart.length || checkingOut) return;
    setCheckingOut(true);
    setCheckoutError("");
    try {
      const items = cart.map((l) => {
        const pr = computePricing(l.draft);
        const p = productBySku(l.draft.productSku);
        const name = lang === "zh" ? p?.nameZh : p?.name;
        return {
          name: `${name} · ${colorLabel(l.color)} · ${l.qty} ${t.units}`,
          amount: Math.round(lineTotal(pr, l.qty) * 100), // dollars → cents
          quantity: 1,
        };
      });
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          successPath: "/apollo-studio/order?paid=1",
          cancelPath: "/apollo-studio/order",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || t.checkoutError);
      // Hand off to Stripe's hosted payment page.
      window.location.href = data.url;
    } catch {
      setCheckoutError(t.checkoutError);
      setCheckingOut(false);
    }
  };

  const methodChip = (d, pr) =>
    pr.method === "embroidery"
      ? `${t.emb} · ~${pr.stitches.toLocaleString(lang === "zh" ? "zh-CN" : "en-US")} ${t.stitches}`
      : `${t.print} · ${pr.colors} ${pr.colors === 1 ? t.colorsOne : t.colorsMany}`;

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <SiteHeader lang={lang} setLang={setLang} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {!placed && (
          <Link
            href="/apollo-studio"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <IconArrowLeft />
            {t.back}
          </Link>
        )}

        {placed ? (
          placed.loading ? (
            /* ---------- Confirming payment ---------- */
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500 dark:border-zinc-700 dark:border-t-emerald-500" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{t.rcvLoading}</p>
            </div>
          ) : (
            /* ---------- Order received ---------- */
            <div className="mx-auto max-w-lg py-4">
              <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <IconCheck width="28" height="28" />
                </span>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t.rcvTitle}</h1>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t.rcvSub}</p>

                {placed.ref && (
                  <p className="mt-4 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {t.rcvRef}: {placed.ref}
                  </p>
                )}

                {placed.lineItems?.length > 0 && (
                  <div className="mt-6 text-left">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{t.rcvItems}</p>
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {placed.lineItems.map((li, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">{li.name}</span>
                          <span className="flex-none font-semibold tabular-nums">{money((li.amount || 0) / 100)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {placed.amountTotal != null && (
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 text-left dark:border-zinc-800">
                    <span className="text-sm font-semibold">{t.rcvTotal}</span>
                    <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {money((placed.amountTotal || 0) / 100)}
                    </span>
                  </div>
                )}

                {placed.email && (
                  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                    {t.rcvReceipt} <span className="font-medium">{placed.email}</span>
                  </p>
                )}

                <div className="mt-7 flex flex-col items-center gap-3">
                  <Link
                    href="/apollo-studio"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    <IconArrowLeft />
                    {t.rcvBack}
                  </Link>
                  <Link
                    href="/apollo-studio/order"
                    className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    {t.rcvAnother}
                  </Link>
                </div>

                <p className="mt-6 text-[10px] text-zinc-400">{t.rcvTestNote}</p>
              </div>
            </div>
          )
        ) : (
        <>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{t.sub}</p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_380px]">
          {/* ---------- Left: configurator ---------- */}
          <div>
            {!orderDraft ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-200 px-6 py-14 text-center dark:border-zinc-800">
                <h3 className="text-base font-semibold">{t.noDesign}</h3>
                <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{t.noDesignBody}</p>
                <Link
                  href="/apollo-studio"
                  className="mt-5 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {t.goStudio}
                </Link>
              </div>
            ) : (
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                {/* design summary */}
                <div className="flex items-center gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800">
                  <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    {orderDraft.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={orderDraft.preview} alt={orderDraft.productName} className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product?.file} alt={orderDraft.productName} className="h-full w-full object-contain p-1" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-500">{t.designLabel}</p>
                    <h2 className="mt-0.5 text-lg font-semibold leading-tight">
                      {lang === "zh" ? product?.nameZh : product?.name}
                    </h2>
                    <span className="mt-1.5 inline-block rounded-full border border-zinc-200 px-2.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      {methodChip(orderDraft, pricing)}
                    </span>
                  </div>
                </div>

                {/* color */}
                <div className="pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{t.colorLabel}</h3>
                    <span className="text-xs text-zinc-400">{colorLabel(color)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {GARMENT_COLORS.map((c) => (
                      <ColorDot key={c.id} color={c} on={color.id === c.id} onClick={() => setColor(c)} label={colorLabel(c)} />
                    ))}
                  </div>
                </div>

                {/* quantity / sizes */}
                <div className="mt-6">
                  {apparel ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{t.sizesLabel}</h3>
                        <span className="text-xs text-zinc-400">{t.sizesHint}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {product.sizes.map((sz) => (
                          <label key={sz} className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
                            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{sz}</span>
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={sizeQty[sz] ?? ""}
                              onChange={(e) => setSize(sz, e.target.value)}
                              placeholder="0"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-center text-sm font-medium outline-none focus:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold">{t.qtyLabel}</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={qty}
                          onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                          className="w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        {PRICE_TIERS.map((tier) => (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setQty(tier)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              Number(qty) === tier
                                ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                            }`}
                          >
                            {tier}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* volume pricing mini-table */}
                <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{t.volumePricing}</p>
                  <table className="w-full min-w-[300px] text-xs">
                    <tbody>
                      <tr className="text-zinc-400">
                        {pricing.tiers.map((ti) => (
                          <td key={ti.qty} className="pb-1 text-center font-medium">
                            {ti.qty}{ti.qty === PRICE_TIERS[PRICE_TIERS.length - 1] ? "+" : ""}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        {pricing.tiers.map((ti) => {
                          const active = currentQty >= ti.qty && currentQty < (pricing.tiers[pricing.tiers.indexOf(ti) + 1]?.qty ?? Infinity);
                          return (
                            <td
                              key={ti.qty}
                              className={`text-center font-semibold tabular-nums ${active ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                            >
                              {money(ti.unit)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* live line estimate + add to cart */}
                <div className="mt-6 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/40">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500 dark:text-zinc-400">{t.totalUnits}</dt>
                      <dd className="font-semibold tabular-nums">{currentQty}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500 dark:text-zinc-400">{t.unitPrice}</dt>
                      <dd className="font-semibold tabular-nums">
                        {currentQty > 0 ? `${money(unitPriceForQty(pricing, currentQty))} ${t.each}` : "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500 dark:text-zinc-400">{t.setup}</dt>
                      <dd className="font-semibold tabular-nums">
                        {setupForQty(pricing, currentQty) > 0 ? money(setupForQty(pricing, currentQty)) : t.setupWaived}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-zinc-200 pt-1.5 dark:border-zinc-700">
                      <dt className="font-semibold">{t.lineEstimate}</dt>
                      <dd className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {currentQty > 0 ? money(lineTotal(pricing, currentQty)) : "—"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={currentQty < 1}
                    className="mt-4 w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.addToCart}
                  </button>
                  {currentQty < 1 && <p className="mt-2 text-center text-[11px] text-zinc-400">{t.enterQty}</p>}
                </div>
              </div>
            )}
          </div>

          {/* ---------- Right: cart ---------- */}
          <aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 lg:sticky lg:top-20">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.cart}</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {cart.length}
              </span>
            </div>

            {cart.length === 0 ? (
              <p className="mt-6 text-center text-sm text-zinc-400">{t.cartEmpty}</p>
            ) : (
              <>
                <ul className="mt-4 space-y-3">
                  {cart.map((l) => {
                    const pr = computePricing(l.draft);
                    const p = productBySku(l.draft.productSku);
                    const total = lineTotal(pr, l.qty);
                    return (
                      <li key={l.id} className="flex gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                        <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                          {l.draft.preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.draft.preview} alt="" className="h-full w-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p?.file} alt="" className="h-full w-full object-contain p-1" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-xs font-semibold">{lang === "zh" ? p?.nameZh : p?.name}</p>
                            <button
                              type="button"
                              onClick={() => removeLine(l.id)}
                              aria-label={t.remove}
                              className="flex-none text-zinc-300 transition-colors hover:text-red-500"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="h-3 w-3 flex-none rounded-full border border-black/15 dark:border-white/25" style={{ backgroundColor: l.color.hex }} />
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{colorLabel(l.color)}</span>
                          </div>
                          {l.sizes && (
                            <p className="mt-0.5 text-[10px] text-zinc-400">
                              {Object.entries(l.sizes).map(([s, n]) => `${s}×${n}`).join("  ")}
                            </p>
                          )}
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {l.qty} {t.units} · {money(unitPriceForQty(pr, l.qty))} {t.each}
                            </span>
                            <span className="font-semibold tabular-nums">{money(total)}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <span className="text-sm font-semibold">{t.subtotal}</span>
                  <span className="text-lg font-bold tabular-nums">{money(cartSubtotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={checkout}
                  disabled={checkingOut}
                  className="mt-4 w-full rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  {checkingOut ? t.checkoutLoading : t.checkout}
                </button>
                {checkoutError && (
                  <p className="mt-2 text-center text-[11px] text-red-500">{checkoutError}</p>
                )}
                <Link
                  href="/apollo-studio"
                  className="mt-2 block text-center text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t.keepShopping}
                </Link>
                <p className="mt-3 text-center text-[10px] text-zinc-400">{t.disclaimer}</p>
              </>
            )}
          </aside>
        </div>
        </>
        )}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
