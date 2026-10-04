// Resume Tailor: relays requests from the web page to Claude (Anthropic API).
// The API key stays here on the server; visitors never see it.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   ANTHROPIC_API_KEY  required. From console.anthropic.com > API keys.
//   ACCESS_CODE        optional. If set, visitors must type this code to use the site.
//   MODEL              optional. Defaults to claude-sonnet-5-5.
//
// This is an Edge Function so the answer can stream back for as long as Claude takes to write it;
// waiting on Claude does not count against the edge CPU limit.

export default async (req) => {
  const MAX_PROMPT_CHARS = 120_000;
  const MAX_IMAGES = 6;
  const MAX_IMAGE_B64 = 4_000_000; // ~3 MB per image after the page downsizes it

  const key = Netlify.env.get("ANTHROPIC_API_KEY");
  const code = Netlify.env.get("ACCESS_CODE");

  if (req.method === "GET") {
    return Response.json({ ok: !!key, codeRequired: !!code }, { headers: { "cache-control": "no-store" } });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!key) return new Response("Server is missing ANTHROPIC_API_KEY", { status: 500 });
  if (code && (req.headers.get("x-access-code") || "").trim() !== code.trim()) {
    return new Response("Access code required", { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  if (!prompt) return new Response("Missing prompt", { status: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) return new Response("Prompt too large", { status: 413 });

  const images = (Array.isArray(body.images) ? body.images : [])
    .slice(0, MAX_IMAGES)
    .filter((i) => i && /^image\/(jpeg|png|webp|gif)$/.test(i.media_type) && typeof i.data === "string" && i.data.length < MAX_IMAGE_B64);

  const content = [
    ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
    { type: "text", text: prompt },
  ];

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Netlify.env.get("MODEL") || "claude-sonnet-5-5",
      max_tokens: 8000,
      stream: true,
      messages: [{ role: "user", content }],
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.log("Anthropic error", upstream.status, detail.slice(0, 500));
    return new Response("Upstream error", { status: upstream.status === 429 || upstream.status === 529 ? 429 : 502 });
  }

  // Pass Claude's event stream straight through to the browser.
  return new Response(upstream.body, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
  });
};

export const config = { path: "/api/ai" };
