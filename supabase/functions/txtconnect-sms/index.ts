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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = request.headers.get("Authorization");
    if (!auth) return json({ error: "Authentication required" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Authentication required" }, 401);
    const body = await request.json();
    const action = body.action || "send";
    const apiKey = Deno.env.get("TXT_CONNECT_API");
    if (action === "generate") {
      const gatewayKey = Deno.env.get("AI_GATEWAY_API_KEY");
      if (!gatewayKey) return json({ error: "AI Gateway is not configured" }, 503);
      const type = String(body.type || "promotion");
      const link = String(body.store_link || "").trim();
      const maxUnits = Number(body.max_units || 160);
      const brief = String(body.brief || "").trim();
      const prompt = `Write one polished SMS message. The business is DataPlug Store in Ghana. The user wants: ${brief || type}. Follow the user's request exactly, whether it is about data, a service, an announcement, a reminder, or anything else. ${link ? `Include this store link exactly once: ${link}` : "Do not invent or include a link."} Keep it within ${maxUnits} character units. Return only the message text, no quotes, no title, no explanation.`;
      const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${gatewayKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "google/gemini-3.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 120 }) });
      const raw = await response.text();
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { return json({ error: raw || "AI generation failed" }, response.status); }
      if (!response.ok) return json({ error: String(payload.error || "AI generation failed") }, response.status);
      const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
      return json({ message: choices?.[0]?.message?.content?.trim() || "" });
    }
    if (!apiKey) return json({ error: "TxtConnect is not configured" }, 503);
    if (action === "balance") {
      const response = await fetch("https://api.txtconnect.net/dev/api/sms/checkbalance", { headers: { Authorization: `Bearer ${apiKey}` } });
      return json(await response.json(), response.status);
    }
    if (action === "status") {
      if (!body.message_id) return json({ error: "message_id is required" }, 400);
      const response = await fetch(`https://api.txtconnect.net/dev/api/sms/getstatus/${encodeURIComponent(String(body.message_id))}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      const raw = await response.text();
      let payload: unknown = {};
      try { payload = JSON.parse(raw); } catch { payload = { raw }; }
      return json(payload, response.status);
    }
    const localRecipients = Array.from(new Set((Array.isArray(body.recipients) ? body.recipients : []).map((value: string) => normalizeLocalGh(value)).filter((value: string | null): value is string => Boolean(value && /^0[2-5]\d{8}$/.test(value)))));
    const recipients = localRecipients.map((value) => `233${value.slice(1)}`);
    const senderId = String(body.sender_id || "").trim();
    const message = String(body.message || "").trim();
    console.log(`[v0] SMS send requested: ${localRecipients.length} recipient(s), sender=${senderId}, chars=${smsUnits(message)}`);
    // A sender ID is usable if the user owns an approved copy OR it is a global approved sender.
    const { data: senderRecords } = await supabase
      .from("sms_sender_ids")
      .select("status,user_id,is_global")
      .eq("sender_id", senderId.toUpperCase())
      .eq("status", "approved");
    const senderApproved = (senderRecords || []).some((r: { user_id: string | null; is_global: boolean }) => r.is_global || r.user_id === user.id);
    const messageUnits = smsUnits(message);
    if (!recipients.length || !senderId || !message || senderId.length > 11 || messageUnits > 1600) return json({ error: "Valid recipients, sender ID, and message are required" }, 400);
    if (!senderApproved) return json({ error: "This sender ID is not approved yet" }, 403);
    // Confirmed pricing: GHS 0.09 per contact plus GHS 2.00 per SMS page.
    const contactPrice = 0.09;
    const pagePrice = 2.00;
    const pages = Math.max(1, Math.ceil(messageUnits / 160));
    const chargePerRecipient = contactPrice;
    const totalCharge = (contactPrice * recipients.length) + (pagePrice * pages);
    const { data: charged, error: chargeError } = await supabase.rpc("charge_sms_wallet", { p_user_id: user.id, p_amount: totalCharge });
    if (chargeError || !charged) return json({ error: "Insufficient wallet balance for this SMS campaign" }, 402);
    const { data: record, error: insertError } = await supabase.from("sms_messages").insert({ user_id: user.id, owner_type: body.owner_type === "agent" ? "agent" : "customer", owner_id: body.owner_id || user.id, recipients, sender_id: senderId, message, total_charge: totalCharge, unit_price: contactPrice }).select("id").single();
    if (insertError) { await supabase.rpc("refund_sms_wallet", { p_user_id: user.id, p_amount: totalCharge }); return json({ error: "Could not create the SMS record" }, 500); }
    const unicode = hasUnicode(message) ? "unicode" : "regular";
    const results = await Promise.all(recipients.map(async (to: string) => {
      try {
        const response = await fetch("https://api.txtconnect.net/dev/api/sms/send", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, from: senderId, unicode, sms: message }) });
        const raw = await response.text();
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = { raw }; }
        const data = (body.data || {}) as Record<string, unknown>;
        const messageId = body.messageId || body.message_id || data.messageId || data.message_id || null;
        console.log(`[v0] TxtConnect response: to=${to}, http=${response.status}, messageId=${String(messageId)}, statusCode=${String(data.status_code ?? "")}`);
        return { to, status: response.status, body, message_id: messageId };
      } catch (error) {
        console.error(`[v0] TxtConnect request failed for ${to}`, error);
        return { to, status: 599, body: { error: error instanceof Error ? error.message : "Provider request failed" }, message_id: null };
      }
    }));
    const failed = results.filter((result) => result.status < 200 || result.status >= 300 || ((result.body.data as Record<string, unknown> | undefined)?.status_code && (result.body.data as Record<string, unknown>).status_code !== "000"));
    if (failed.length) await supabase.rpc("refund_sms_wallet", { p_user_id: user.id, p_amount: chargePerRecipient * failed.length });
    const providerMessageIds = results.map((result) => result.message_id).filter(Boolean);
    await supabase.from("sms_messages").update({ status: failed.length ? (failed.length === results.length ? "failed" : "partial") : "sent", provider_response: results, provider_message_ids: providerMessageIds, last_delivery_check_at: null, completed_at: new Date().toISOString(), error_message: failed.length ? `${failed.length} message(s) failed` : null }).eq("id", record.id);
    if (failed.length) return json({ error: `${failed.length} message(s) failed`, sent: results.length - failed.length, refunded: chargePerRecipient * failed.length, total: results.length, pages }, 502);
    return json({ success: true, sent: results.length, charge: totalCharge, pages, id: record.id });
  } catch (error) { console.error("[v0] TxtConnect SMS error", error); return json({ error: "SMS service request failed" }, 500); }
});
