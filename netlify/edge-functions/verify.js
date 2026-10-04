// Confirms a finished Stripe Checkout payment.
// For a download it reports which resume and format it unlocked; for a token pack, how many AI edits are left.
// The count of used tokens lives on the Stripe payment itself (metadata "used"), so no database is needed.

export default async (req) => {
  const key = Netlify.env.get("STRIPE_SECRET_KEY");
  if (!key) return Response.json({ paid: false, error: "Payments are not set up" }, { status: 500 });

  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return Response.json({ paid: false }, { status: 400 });

  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}?expand[]=payment_intent`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return Response.json({ paid: false }, { status: 404 });
  const s = await r.json();
  const kind = s.metadata?.kind === "tokens" ? "tokens" : "download";
  const pack = parseInt(s.metadata?.tokens || "0", 10) || 0;
  const used = parseInt(s.payment_intent?.metadata?.used || "0", 10) || 0;

  return Response.json(
    {
      paid: s.payment_status === "paid",
      kind,
      resumeId: s.metadata?.resume_id || "",
      format: s.metadata?.format || "pdf",
      remaining: kind === "tokens" ? Math.max(0, pack - used) : 0,
    },
    { headers: { "cache-control": "no-store" } },
  );
};

export const config = { path: "/api/verify" };
