import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAX_RECIPIENTS = 1000;
const MAX_UNITS = 1600;
const SEND_CONCURRENCY = 20;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

const normalizeLocalGh = (value: string) => {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00233")) digits = digits.slice(5);
  else if (digits.startsWith("233") && digits.length >= 12) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 9 && /^[2-5]/.test(digits) ? `0${digits}` : null;
};
const hasUnicode = (value: string) => /[^\x00-\x7F]/.test(value);
const smsUnits = (value: string) => Array.from(value).reduce((total, character) => total + (character.codePointAt(0)! > 0xffff ? 2 : 1), 0);
const money = (value: number) => Math.round(value * 100) / 100;

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

type ApiUser = { id: string; identity_id: string | null; is_agent: boolean | null; api_wallet: number | null; active: boolean | null };

async function authenticate(request: Request): Promise<ApiUser | null> {
  const key = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!key) return null;
  const { data, error } = await admin.from("api_users").select("id, identity_id, is_agent, api_wallet, active").eq("api_key", key).maybeSingle();
  if (error || !data || data.active === false) return null;
  return data as ApiUser;
}

async function pricing() {
  const { data } = await admin.from("app_settings").select("sms_api_recipient_price,sms_api_page_price").eq("id", 1).maybeSingle();
  return { recipient: Number(data?.sms_api_recipient_price) || 0, page: Number(data?.sms_api_page_price) || 0 };
}

async function readBalance(userId: string) {
  const { data } = await admin.from("api_users").select("api_wallet").eq("id", userId).maybeSingle();
  return money(Number(data?.api_wallet) || 0);
}

function visibleSenders(user: ApiUser) {
  return admin
    .from("sms_sender_ids")
    .select("id,sender_id,status,is_global,created_at,reviewed_at,source")
    .or(`is_global.eq.true,user_id.is.null${user.identity_id ? `,user_id.eq.${user.identity_id}` : ""}`)
    .order("sender_id");
}

async function submitSender(user: ApiUser, body: Record<string, unknown>) {
  const sender = String(body.sender_id ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (sender.length < 3 || sender.length > 11) return reply({ success: false, error: "sender_id must be 3-11 characters including spaces" }, 400);
  if (!/^[A-Z0-9 ]+$/.test(sender)) return reply({ success: false, error: "sender_id cannot contain special characters" }, 400);
  if (/^\d+$/.test(sender.replace(/\s+/g, ""))) return reply({ success: false, error: "sender_id cannot be only numbers" }, 400);
  const phone = body.phone_number ? normalizeLocalGh(String(body.phone_number)) : null;
  if (body.phone_number && !phone) return reply({ success: false, error: "phone_number must be a valid Ghana number" }, 400);

  const { data: existing } = await admin.from("sms_sender_ids").select("id").ilike("sender_id", sender).maybeSingle();
  if (existing) return reply({ success: false, error: "This sender ID already exists and must be unique" }, 409);
  const { data: blocked } = await admin.rpc("is_sms_sender_blocked", { p_sender_id: sender });
  if (blocked) return reply({ success: false, error: "This sender ID is locked and cannot be used" }, 403);

  const { data, error } = await admin
    .from("sms_sender_ids")
    .insert({ user_id: user.identity_id, sender_id: sender, phone_number: phone, status: "pending", is_global: false, source: "api" })
    .select("id,sender_id,status,created_at")
    .single();
  if (error) return reply({ success: false, error: error.code === "23505" ? "This sender ID is already pending or registered" : "Could not submit sender ID" }, error.code === "23505" ? 409 : 500);
  return reply({ success: true, sender: data, message: "Sender ID submitted. It becomes usable once an admin approves it." }, 201);
}

async function sendSms(user: ApiUser, body: Record<string, unknown>, idempotencyKey: string) {
  const providerAuth = Deno.env.get("TXTCONNECT_API_KEY") || Deno.env.get("TXT_CONNECT_API") || Deno.env.get("CURL_AUTH_HEADER_12") || Deno.env.get("CURL_AUTH_HEADER") || Deno.env.get("API_KEY");
  if (!providerAuth) return reply({ success: false, error: "SMS provider is not configured" }, 503);
  const providerHeaders = { Authorization: providerAuth.startsWith("Bearer ") ? providerAuth : `Bearer ${providerAuth}`, "Content-Type": "application/json" };

  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : typeof body.recipients === "string" ? String(body.recipients).split(/[\s,;]+/) : [];
  const recipients = Array.from(new Set(rawRecipients.map((value) => normalizeLocalGh(String(value))).filter((value): value is string => Boolean(value))));
  const senderId = String(body.sender_id ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!recipients.length) return reply({ success: false, error: "recipients must contain at least one valid Ghana phone number" }, 400);
  if (recipients.length > MAX_RECIPIENTS) return reply({ success: false, error: `A single request supports up to ${MAX_RECIPIENTS} recipients` }, 400);
  if (!senderId || senderId.length > 11) return reply({ success: false, error: "sender_id is required (max 11 characters)" }, 400);
  if (!message) return reply({ success: false, error: "message is required" }, 400);
  const units = smsUnits(message);
  if (units > MAX_UNITS) return reply({ success: false, error: `message cannot exceed ${MAX_UNITS} characters` }, 400);

  const { data: existing } = await admin.from("sms_messages").select("id,status,total_charge,recipients").eq("api_user_id", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing) return reply({ success: true, duplicate: true, id: existing.id, status: existing.status, charge: Number(existing.total_charge) || 0, recipients: existing.recipients?.length ?? 0 });

  const { data: blocked } = await admin.rpc("is_sms_sender_blocked", { p_sender_id: senderId });
  if (blocked) return reply({ success: false, error: "This sender ID is locked and cannot be used" }, 403);
  const { data: senderRecords } = await visibleSenders(user).eq("sender_id", senderId.toUpperCase()).eq("status", "approved");
  if (!senderRecords?.length) return reply({ success: false, error: "This sender ID is not approved for your account yet" }, 403);

  const price = await pricing();
  if (price.recipient <= 0 && price.page <= 0) return reply({ success: false, error: "Bulk SMS API pricing has not been configured yet" }, 503);
  const pages = Math.max(1, Math.ceil(units / 160));
  const totalCharge = money(price.recipient * recipients.length + price.page * pages);
  if (totalCharge <= 0) return reply({ success: false, error: "Invalid SMS charge" }, 400);

  const { data: charged } = await admin.rpc("api_sms_charge", { p_api_user_id: user.id, p_amount: totalCharge });
  if (!charged) return reply({ success: false, error: "Insufficient API wallet balance", required: totalCharge, balance: await readBalance(user.id) }, 402);

  const refund = (amount: number) => admin.rpc("api_sms_refund", { p_api_user_id: user.id, p_amount: money(amount) });

  const { data: record, error: insertError } = await admin
    .from("sms_messages")
    .insert({
      user_id: user.identity_id,
      owner_type: user.is_agent ? "agent" : "customer",
      owner_id: user.identity_id,
      recipients,
      sender_id: senderId,
      message,
      total_charge: totalCharge,
      unit_price: price.recipient,
      api_user_id: user.id,
      source: "api",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();
  if (insertError || !record) {
    await refund(totalCharge);
    if (insertError?.code === "23505") {
      const { data: duplicate } = await admin.from("sms_messages").select("id,status,total_charge").eq("api_user_id", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (duplicate) return reply({ success: true, duplicate: true, id: duplicate.id, status: duplicate.status, charge: Number(duplicate.total_charge) || 0 });
    }
    return reply({ success: false, error: "Could not create the SMS record" }, 500);
  }

  const unicode = hasUnicode(message);
  const results: Array<{ to: string; ok: boolean; message_id: unknown; reason: string | null }> = [];
  for (let index = 0; index < recipients.length; index += SEND_CONCURRENCY) {
    const batch = recipients.slice(index, index + SEND_CONCURRENCY);
    const settled = await Promise.all(batch.map(async (to) => {
      try {
        const response = await fetch("https://api.txtconnect.net/dev/api/sms/send", { method: "POST", headers: providerHeaders, body: JSON.stringify({ to: `233${to.slice(1)}`, from: senderId, unicode, sms: message }) });
        const raw = await response.text();
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { parsed = { raw }; }
        const data = (parsed.data || {}) as Record<string, unknown>;
        const statusCode = data.status_code;
        const ok = response.ok && (!statusCode || statusCode === "000");
        const messageId = parsed.messageId || parsed.message_id || data.messageId || data.message_id || null;
        return { to, ok, message_id: messageId, reason: ok ? null : providerReason(parsed) || providerReason(data) || `HTTP ${response.status}` };
      } catch (error) {
        return { to, ok: false, message_id: null, reason: error instanceof Error ? error.message : "Provider request failed" };
      }
    }));
    results.push(...settled);
  }

  const failed = results.filter((result) => !result.ok);
  const sent = results.length - failed.length;
  const refunded = failed.length === results.length ? totalCharge : money(price.recipient * failed.length);
  if (failed.length) await refund(refunded);

  await admin.from("sms_messages").update({
    status: failed.length ? (sent === 0 ? "failed" : "partial") : "sent",
    provider_response: results,
    provider_message_ids: results.map((result) => result.message_id).filter(Boolean),
    last_delivery_check_at: null,
    completed_at: new Date().toISOString(),
    error_message: failed.length ? `${failed.length} message(s) failed` : null,
  }).eq("id", record.id);

  const balance = await readBalance(user.id);
  if (sent === 0) {
    return reply({ success: false, error: `All messages failed: ${Array.from(new Set(failed.map((item) => item.reason))).join("; ")}`, id: record.id, refunded, balance }, 502);
  }
  return reply({
    success: true,
    id: record.id,
    status: failed.length ? "partial" : "sent",
    sent,
    failed: failed.map((item) => ({ to: item.to, reason: item.reason })),
    pages,
    charge: money(totalCharge - (failed.length ? refunded : 0)),
    refunded: failed.length ? refunded : 0,
    balance,
    message_ids: results.filter((item) => item.ok).map((item) => ({ to: item.to, message_id: item.message_id })),
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authenticate(request);
    if (!user) return reply({ success: false, error: "Invalid or inactive API key" }, 401);

    if (request.method === "GET") {
      const price = await pricing();
      const [{ data: senders }, { data: officialSenders }] = await Promise.all([
        visibleSenders(user),
        admin.from("sms_sender_ids").select("id,sender_id,status,is_global,created_at,reviewed_at,source").eq("is_global", true).eq("status", "approved").order("sender_id"),
      ]);
      return reply({
        success: true,
        pricing: { currency: "GHS", per_recipient: price.recipient, per_page: price.page, characters_per_page: 160 },
        balance: await readBalance(user.id),
        sender_ids: senders ?? [],
        official_sender_ids: officialSenders ?? [],
      });
    }
    if (request.method !== "POST") return reply({ success: false, error: "Method not allowed" }, 405);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "send");

    if (action === "submit_sender") return await submitSender(user, body);
    if (action === "senders") {
      const [{ data }, { data: official }] = await Promise.all([
        visibleSenders(user),
        admin.from("sms_sender_ids").select("id,sender_id,status,is_global,created_at,reviewed_at,source").eq("is_global", true).eq("status", "approved").order("sender_id"),
      ]);
      return reply({ success: true, sender_ids: data ?? [], official_sender_ids: official ?? [] });
    }
    if (action === "balance") return reply({ success: true, balance: await readBalance(user.id) });
    if (action === "status") {
      const id = String(body.id ?? "").trim();
      if (!id) return reply({ success: false, error: "id is required" }, 400);
      const { data } = await admin.from("sms_messages").select("id,status,sender_id,total_charge,recipients,created_at,completed_at,error_message").eq("id", id).eq("api_user_id", user.id).maybeSingle();
      if (!data) return reply({ success: false, error: "Message not found" }, 404);
      return reply({ success: true, message: { ...data, recipients: data.recipients?.length ?? 0 } });
    }
    if (action !== "send") return reply({ success: false, error: "Unknown action" }, 400);

    const idempotencyKey = (request.headers.get("idempotency-key") || String(body.idempotency_key ?? "")).trim();
    if (!idempotencyKey || idempotencyKey.length > 128) return reply({ success: false, error: "A unique idempotency-key (max 128 characters) is required" }, 400);
    return await sendSms(user, body, idempotencyKey);
  } catch (error) {
    console.error("[v0] sms-api error", error);
    return reply({ success: false, error: "SMS API request failed" }, 500);
  }
});
// Deploy with: supabase functions deploy sms-api
