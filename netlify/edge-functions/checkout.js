// Starts a Stripe Checkout payment: either one resume download (PDF or Word) or a pack of AI edit tokens.
// Environment variables:
//   STRIPE_SECRET_KEY  required for payments (dashboard.stripe.com > Developers > API keys)
//   PRICE_CENTS        optional, price of one download, default 300 ($3.00)
//   PACK_CENTS         optional, price of a token pack, default 100 ($1.00)
//   PACK_SIZE          optional, AI edits per pack, default 5

export default async (req) => {
  const key = Netlify.env.get("STRIPE_SECRET_KEY");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!key) return Response.json({ error: "Payments are not set up" }, { status: 500 });

  let body = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const kind = body.kind === "tokens" ? "tokens" : "download";
  const resumeId = String(body.resumeId || "").replace(/[^\w-]/g, "").slice(0, 64);
  const format = body.format === "docx" ? "docx" : "pdf";
  if (kind === "download" && !resumeId) return Response.json({ error: "Missing resume id" }, { status: 400 });

  const int = (name, d) => Math.max(1, parseInt(Netlify.env.get(name) || String(d), 10) || d);
  const packSize = int("PACK_SIZE", 5);
  const cents = Math.max(50, kind === "tokens" ? int("PACK_CENTS", 100) : int("PRICE_CENTS", 300));
  const origin = new URL(req.url).origin;

  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][product_data][name]": kind === "tokens" ? `${packSize} AI resume edits` : `Tailored resume download (${format === "docx" ? "Word" : "PDF"})`,
    "metadata[kind]": kind,
    "metadata[resume_id]": resumeId,
    "metadata[format]": format,
    "metadata[tokens]": String(kind === "tokens" ? packSize : 0),
    "payment_intent_data[metadata][kind]": kind,
    "payment_intent_data[metadata][used]": "0",
    success_url: `${origin}/?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?canceled=1`,
  });

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) {
    console.log("Stripe checkout error", r.status, JSON.stringify(j).slice(0, 500));
    return Response.json({ error: "Checkout failed" }, { status: 502 });
  }
  return Response.json({ url: j.url }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/checkout" };
