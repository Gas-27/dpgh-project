import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BODY_CHARS = 20000;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function stripHtml(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
}

function extractCode(subject: string, body: string) {
  const text = `${subject}\n${body}`.slice(0, MAX_BODY_CHARS);
  const patterns = [
    /(?:verification|access|security|sign[- ]?in|login|temporary|one[- ]time)?\s*(?:code|passcode|pin|otp)[^0-9]{0,60}?\b(\d{4,8})\b/i,
    /\b(\d{4,8})\s+is\s+your\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const provided = req.headers.get("x-inbound-secret") ?? "";
  const { data: settings, error: settingsError } = await supabase
    .from("private_share_inbound_settings").select("secret").eq("id", true).maybeSingle();
  if (settingsError || !settings?.secret || !provided || !safeEqual(provided, settings.secret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const mailbox = String(payload.mailbox ?? payload.to ?? "").slice(0, 320);
  const from = String(payload.from ?? "").slice(0, 320);
  const subject = String(payload.subject ?? "").slice(0, 500);
  const rawBody = payload.text ? String(payload.text) : stripHtml(String(payload.html ?? ""));
  const receivedAt = payload.received_at ? new Date(String(payload.received_at)) : new Date();

  const code = extractCode(subject, rawBody.slice(0, MAX_BODY_CHARS));
  if (!code) return json({ ok: true, stored: false, reason: "no_code_found" });

  const { data, error } = await supabase.rpc("private_share_ingest_code", {
    p_mailbox: mailbox,
    p_sender: from,
    p_code: code,
    p_received_at: Number.isNaN(receivedAt.getTime()) ? null : receivedAt.toISOString(),
  });
  if (error) {
    console.error("private-share-inbound-email: ingest failed", error.message);
    return json({ error: "Could not store code" }, 500);
  }
  return json({ ok: true, ...(data as Record<string, unknown>) });
});
