import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const normalizeLocalGh = (value: string) => {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00233")) digits = digits.slice(5);
  else if (digits.startsWith("233") && digits.length >= 12) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 9 && /^[2-5]/.test(digits)) return `0${digits}`;
  return digits.length === 9 ? `0${digits}` : null;
};
const toTxtConnectNumber = (value: string) => {
  const local = normalizeLocalGh(value);
  return local && /^0[2-5]\d{8}$/.test(local) ? `233${local.slice(1)}` : null;
};
const hasUnicode = (value: string) => /[^\x00-\x7F]/.test(value);
const smsUnits = (value: string) => Array.from(value).reduce((total, character) => total + (character.codePointAt(0)! > 0xffff ? 2 : 1), 0);
const providerReason = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) return value.map(providerReason).filter(Boolean).join("; ") || null;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["reason", "message", "error", "detail", "msg", "description", "status_message"]) {
      const reason = providerReason(object[key]);
      if (reason) return reason;
    }
  }
  return null;
};

const SERVICE_BUSY = "SMS service is temporarily busy. You have not been charged. Please try again in a moment.";
// Never let provider names, URLs or network internals reach the browser.
const safeMessage = (value: unknown): string => {
  const text = typeof value === "string" ? value : value instanceof Error ? value.message : "";
  if (!text) return SERVICE_BUSY;
  if (/txtconnect|https?:\/\/|\bapi\.|dns|name resolution|error sending request|fetch failed|connect|timed? ?out|network|socket|tls|ssl|econn|enotfound/i.test(text)) return SERVICE_BUSY;
  return text.replace(/txt\s*connect/gi, "SMS service");
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Transient failures (DNS hiccups, resets) are retried before a recipient is marked failed.
const fetchWithRetry = async (url: string, init: RequestInit, attempts = 4): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status < 500 || attempt === attempts - 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }
    await wait(400 * 2 ** attempt + Math.floor(Math.random() * 200));
  }
  throw lastError instanceof Error ? lastError : new Error("Provider request failed");
};
// Large campaigns used to open one connection per recipient at once, which exhausts DNS/sockets.
const mapWithConcurrency = async <T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> => {
  const output: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]);
    }
  }));
  return output;
};

const BATCH_SIZE = 25;
const BATCH_CONCURRENCY = 5;
const RATE_LIMITED = /too many request|rate.?limit/i;
const retryAfterSeconds = (text: string) => {
  const match = text.match(/(\d+)\s*second/i);
  return match ? Math.min(Math.max(Number(match[1]), 5), 90) : 30;
};
type SendResult = { to: string; status: number; body: Record<string, unknown>; message_id: unknown; reason: string };
const delivered = (result: SendResult) => {
  const data = result.body?.data as Record<string, unknown> | undefined;
  return result.status >= 200 && result.status < 300 && !(data?.status_code && data.status_code !== "000");
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = request.headers.get("Authorization");
    const body = await request.json();
    const action = body.action || "send";
    // Prefer a dedicated TxtConnect credential. The generic CURL_AUTH_HEADER/API_KEY slots
    // are shared with other providers (e.g. Paystack) and can silently rotate to a value
    // TxtConnect no longer recognizes, so they are only a last-resort fallback.
    const providerAuth = Deno.env.get("TXTCONNECT_API_KEY") || Deno.env.get("TXT_CONNECT_API") || Deno.env.get("CURL_AUTH_HEADER_12") || Deno.env.get("CURL_AUTH_HEADER") || Deno.env.get("API_KEY");
    const providerHeaders = { Authorization: providerAuth?.startsWith("Bearer ") ? providerAuth : `Bearer ${providerAuth || ""}`, "Content-Type": "application/json" };
    const normalizeSenderPhone = (value: string) => normalizeLocalGh(value);
    if (action === "generate") {
      const gatewayKey = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("AI_GATEWAY_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("API_KEY");
      if (!gatewayKey) return json({ error: "AI generation is not configured on the SMS service" }, 503);
      const type = String(body.type || "promotion");
      const link = String(body.store_link || "").trim();
      const maxUnits = Number(body.max_units || 160);
      const brief = String(body.brief || "").trim();
      const prompt = `Write one polished SMS message. The business is DataPlug Store in Ghana. The user wants: ${brief || type}. Follow the user's request exactly, whether it is about data, a service, an announcement, a reminder, or anything else. ${link ? `Include this store link exactly once: ${link}` : "Do not invent or include a link."} Keep it within ${maxUnits} character units. Return only the message text, no quotes, no title, no explanation.`;
      const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${gatewayKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 120 }) });
      const raw = await response.text();
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { return json({ error: raw || "AI generation failed" }, response.status); }
      if (!response.ok) return json({ error: String(payload.error || "AI generation failed") }, response.status);
      const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
      return json({ message: choices?.[0]?.message?.content?.trim() || "" });
    }
    if (action === "sender_lookup" || action === "submit_sender") {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
      if (!serviceKey) return json({ error: "Sender service is not configured" }, 503);
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
      const phone = normalizeSenderPhone(String(body.phone || ""));
      if (!phone) return json({ error: "A valid Ghana phone number is required" }, 400);
      if (action === "sender_lookup") {
        const { data, error } = await admin.from("sms_sender_ids").select("id,sender_id,status,is_global,created_at,reviewed_at").eq("phone_number", phone).order("created_at", { ascending: false });
        if (error) return json({ error: "Could not look up sender IDs" }, 500);
        return json({ senders: data || [] });
      }
      const sender = String(body.sender_id || "").trim().replace(/\s+/g, " ").toUpperCase();
      // Guideline checks mirror the submission form so the rules cannot be bypassed.
      if (sender.length < 3 || sender.length > 11) return json({ error: "Sender ID must be 3-11 characters including spaces" }, 400);
      if (!/^[A-Z0-9 ]+$/.test(sender)) return json({ error: "Sender ID cannot contain special characters" }, 400);
      if (/^\d+$/.test(sender.replace(/\s+/g, ""))) return json({ error: "Sender ID cannot be only numbers" }, 400);
      const { data: existingSender } = await admin.from("sms_sender_ids").select("id").ilike("sender_id", sender).maybeSingle();
      if (existingSender) return json({ error: "This sender ID already exists and must be unique" }, 409);
      const { data: blocked } = await admin.rpc("is_sms_sender_blocked", { p_sender_id: sender });
      if (blocked) return json({ error: "This sender ID is locked and cannot be used." }, 403);
      const { data, error } = await admin.from("sms_sender_ids").insert({ user_id: null, sender_id: sender, phone_number: phone, status: "pending", is_global: false }).select("id,sender_id,status,is_global,created_at,reviewed_at").single();
      if (error) return json({ error: error.code === "23505" ? "This sender ID is already pending or registered for that number" : "Could not submit sender ID" }, error.code === "23505" ? 409 : 500);
      return json({ sender: data });
    }
    if (action === "public_sender_lookup") {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
      if (!serviceKey) return json({ error: "Sender service is not configured" }, 503);
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
      const { data, error } = await admin.from("sms_sender_ids").select("id,sender_id,status,is_global,created_at,reviewed_at").eq("status", "approved").or("is_global.eq.true,user_id.is.null").order("sender_id");
      if (error) return json({ error: "Could not load approved sender IDs" }, 500);
      return json({ senders: data || [] });
    }
    if (!auth) return json({ error: "Authentication required" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Authentication required" }, 401);
    if (!providerAuth) return json({ error: "SMS service is not configured" }, 503);
    if (action === "balance") {
      const response = await fetchWithRetry("https://api.txtconnect.net/dev/api/sms/checkbalance", { headers: providerHeaders });
      return json(await response.json(), response.status);
    }
    if (action === "status") {
      if (!body.message_id) return json({ error: "message_id is required" }, 400);
      const response = await fetchWithRetry(`https://api.txtconnect.net/dev/api/sms/getstatus/${encodeURIComponent(String(body.message_id))}`, { headers: providerHeaders });
      const raw = await response.text();
      let payload: unknown = {};
      try { payload = JSON.parse(raw); } catch { payload = { raw }; }
      return json(payload, response.status);
    }
    const walletServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    if (!walletServiceKey) return json({ error: "SMS service is not configured" }, 503);
    // charge/refund RPCs and campaign progress writes are service_role only.
    const walletAdmin = createClient(Deno.env.get("SUPABASE_URL")!, walletServiceKey);

    if (action === "start") {
      const ownerType = ["agent", "subagent", "subsubagent"].includes(String(body.owner_type)) ? String(body.owner_type) : "customer";
      const recipients = Array.from(new Set((Array.isArray(body.recipients) ? body.recipients : []).map((value: string) => normalizeLocalGh(value)).filter((value: string | null): value is string => Boolean(value && /^0[2-5]\d{8}$/.test(value)))));
      const senderId = String(body.sender_id || "").trim();
      const message = String(body.message || "").trim();
      const { data: blockedSender } = await supabase.rpc("is_sms_sender_blocked", { p_sender_id: senderId });
      if (blockedSender) return json({ error: "This sender ID is locked and cannot be used to send SMS." }, 403);
      const { data: senderRecords } = await supabase.from("sms_sender_ids").select("status,user_id,is_global").eq("sender_id", senderId.toUpperCase()).eq("status", "approved");
      const senderApproved = (senderRecords || []).some((r: { user_id: string | null; is_global: boolean }) => r.is_global || r.user_id === user.id || r.user_id === null);
      const messageUnits = smsUnits(message);
      if (!recipients.length || !senderId || !message || senderId.length > 11 || messageUnits > 1600) return json({ error: "Valid recipients, sender ID, and message are required" }, 400);
      if (!senderApproved) return json({ error: "This sender ID is not approved yet" }, 403);
      const { data: appSettings } = await supabase.from("app_settings").select("sms_dashboard_recipient_price,sms_dashboard_page_price,sms_storefront_recipient_price,sms_storefront_page_price").eq("id", 1).maybeSingle();
      const storefront = body.sales_channel === "storefront" || ownerType !== "customer";
      const contactPrice = Number(storefront ? appSettings?.sms_storefront_recipient_price : appSettings?.sms_dashboard_recipient_price) || 0;
      const pagePrice = Number(storefront ? appSettings?.sms_storefront_page_price : appSettings?.sms_dashboard_page_price) || 0;
      const pages = Math.max(1, Math.ceil(messageUnits / 160));
      const totalCharge = (contactPrice * recipients.length) + (pagePrice * pages);
      // The full campaign cost is taken up front; anything that cannot be delivered is refunded in "finish".
      const { data: charged, error: chargeError } = await walletAdmin.rpc("charge_sms_wallet", { p_user_id: user.id, p_amount: totalCharge, p_owner_type: ownerType });
      if (chargeError) { console.error("[v0] SMS wallet charge failed", chargeError); return json({ error: "Could not charge your wallet. Please try again." }, 500); }
      if (!charged) return json({ error: "Insufficient wallet balance for this SMS campaign" }, 402);
      const { data: record, error: insertError } = await walletAdmin.from("sms_messages").insert({ user_id: user.id, owner_type: ownerType, owner_id: body.owner_id || user.id, recipients, sender_id: senderId, message, total_charge: totalCharge, unit_price: contactPrice, status: "sending", provider_response: [], sent_count: 0, failed_count: 0, unicode: hasUnicode(message) ? "unicode" : "regular" }).select("id").single();
      if (insertError || !record) { await walletAdmin.rpc("refund_sms_wallet", { p_user_id: user.id, p_amount: totalCharge, p_owner_type: ownerType }); return json({ error: "Could not create the SMS record" }, 500); }
      return json({ id: record.id, total: recipients.length, pages, charge: totalCharge, batch_size: BATCH_SIZE, recipients });
    }

    if (action === "batch" || action === "finish") {
      const { data: record } = await walletAdmin.from("sms_messages").select("id,user_id,owner_type,recipients,sender_id,message,total_charge,unit_price,status,provider_response,sent_count,failed_count").eq("id", String(body.id || "")).eq("user_id", user.id).maybeSingle();
      if (!record) return json({ error: "SMS campaign not found" }, 404);
      const previous: SendResult[] = Array.isArray(record.provider_response) ? record.provider_response as SendResult[] : [];
      const campaignRecipients: string[] = record.recipients || [];

      if (action === "batch") {
        if (record.status !== "sending") return json({ error: "This SMS campaign is already finished" }, 409);
        const handledAlready = new Set(previous.map((item) => item.to));
        const requested = Array.from(new Set((Array.isArray(body.recipients) ? body.recipients : []).map((value: string) => normalizeLocalGh(value)).filter((value: string | null): value is string => Boolean(value))));
        const allowed = new Set(campaignRecipients);
        const batch = requested.filter((to) => allowed.has(to) && !handledAlready.has(to)).slice(0, BATCH_SIZE);
        const unicode = hasUnicode(record.message);
        let rateLimitedFor: number | null = null;
        const recorded: SendResult[] = [];
        let cursor = 0;
        await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, batch.length) }, async () => {
          while (cursor < batch.length && rateLimitedFor === null) {
            const to = batch[cursor++];
            try {
              const response = await fetchWithRetry("https://api.txtconnect.net/dev/api/sms/send", { method: "POST", headers: providerHeaders, body: JSON.stringify({ to, from: record.sender_id, unicode, sms: record.message }) });
              const raw = await response.text();
              let parsed: Record<string, unknown> = {};
              try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { parsed = { raw }; }
              const data = (parsed.data || {}) as Record<string, unknown>;
              const reasonRaw = providerReason(parsed) || providerReason(data) || `HTTP ${response.status}`;
              if (response.status === 429 || RATE_LIMITED.test(reasonRaw) || RATE_LIMITED.test(raw)) {
                // Not recorded: this recipient is handed back to the client so it can be retried after the cool-down.
                rateLimitedFor = retryAfterSeconds(`${reasonRaw} ${raw}`);
                continue;
              }
              const messageId = parsed.messageId || parsed.message_id || data.messageId || data.message_id || null;
              recorded.push({ to, status: response.status, body: parsed, message_id: messageId, reason: safeMessage(reasonRaw) });
            } catch (error) {
              console.error("[v0] SMS provider request failed", error);
              recorded.push({ to, status: 599, body: { error: SERVICE_BUSY }, message_id: null, reason: SERVICE_BUSY });
            }
          }
        }));
        const merged = [...previous, ...recorded];
        const sentCount = merged.filter(delivered).length;
        await walletAdmin.from("sms_messages").update({ provider_response: merged, sent_count: sentCount, failed_count: merged.length - sentCount }).eq("id", record.id);
        const handled = recorded.map((item) => item.to);
        const sentNow = recorded.filter(delivered).length;
        return json({ handled, sent: sentNow, failed: recorded.length - sentNow, sent_total: sentCount, processed_total: merged.length, total: campaignRecipients.length, remaining: campaignRecipients.length - merged.length, retry_after: rateLimitedFor });
      }

      // finish: close the campaign once and refund whatever could not be delivered.
      if (record.status !== "sending") return json({ success: true, already_finished: true, sent: record.sent_count, failed: record.failed_count, total: campaignRecipients.length });
      const { data: closing } = await walletAdmin.from("sms_messages").update({ status: "finalizing" }).eq("id", record.id).eq("status", "sending").select("id");
      if (!closing?.length) return json({ success: true, already_finished: true, sent: record.sent_count, failed: record.failed_count, total: campaignRecipients.length });
      const sent = previous.filter(delivered).length;
      const failed = campaignRecipients.length - sent;
      const unitPrice = Number(record.unit_price) || 0;
      const refundAmount = sent === 0 ? Number(record.total_charge) : unitPrice * failed;
      if (refundAmount > 0) await walletAdmin.rpc("refund_sms_wallet", { p_user_id: user.id, p_amount: refundAmount, p_owner_type: record.owner_type });
      const ids = previous.map((item) => item.message_id).filter(Boolean);
      const finalStatus = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
      await walletAdmin.from("sms_messages").update({ status: finalStatus, provider_message_ids: ids, sent_count: sent, failed_count: failed, last_delivery_check_at: null, completed_at: new Date().toISOString(), error_message: failed ? `${failed} message(s) could not be delivered` : null }).eq("id", record.id);
      return json({ success: failed === 0, status: finalStatus, sent, failed, refunded: refundAmount, total: campaignRecipients.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) { console.error("[v0] SMS service error", error); return json({ error: safeMessage(error) }, 500); }
});
