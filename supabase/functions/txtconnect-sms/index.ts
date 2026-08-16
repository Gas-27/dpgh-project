import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const normalize = (value: string) => value.replace(/[^0-9+]/g, "");

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
    if (!apiKey) return json({ error: "TxtConnect is not configured" }, 503);
    if (action === "balance") {
      const response = await fetch("https://api.txtconnect.net/dev/api/sms/checkbalance", { headers: { Authorization: `Bearer ${apiKey}` } });
      return json(await response.json(), response.status);
    }
    if (action === "status") {
      if (!body.message_id) return json({ error: "message_id is required" }, 400);
      const response = await fetch("https://api.txtconnect.net/dev/api/sms/getstatus", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ messageId: body.message_id }) });
      return json(await response.json(), response.status);
    }
    const recipients = Array.from(new Set((Array.isArray(body.recipients) ? body.recipients : []).map(normalize).filter((value: string) => /^\+?[0-9]{8,15}$/.test(value))));
    const senderId = String(body.sender_id || "").trim();
    const message = String(body.message || "").trim();
    if (!recipients.length || !senderId || !message || senderId.length > 11 || message.length > 1000) return json({ error: "Valid recipients, sender ID, and message are required" }, 400);
    const { data: setting } = await supabase.from("sms_settings").select("unit_price").eq("id", true).maybeSingle();
    const unitPrice = Number(setting?.unit_price ?? 0.05);
    const totalCharge = unitPrice * recipients.length;
    const { data: charged, error: chargeError } = await supabase.rpc("charge_sms_wallet", { p_user_id: user.id, p_amount: totalCharge });
    if (chargeError || !charged) return json({ error: "Insufficient wallet balance for this SMS campaign" }, 402);
    const { data: record, error: insertError } = await supabase.from("sms_messages").insert({ user_id: user.id, owner_type: body.owner_type === "agent" ? "agent" : "customer", owner_id: body.owner_id || user.id, recipients, sender_id: senderId, message, total_charge: totalCharge, unit_price: unitPrice }).select("id").single();
    if (insertError) { await supabase.rpc("refund_sms_wallet", { p_user_id: user.id, p_amount: totalCharge }); return json({ error: "Could not create the SMS record" }, 500); }
    if (insertError) return json({ error: insertError.message }, 400);
    const results = await Promise.all(recipients.map(async (to: string) => { const response = await fetch("https://api.txtconnect.net/dev/api/sms/send", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, from: senderId, unicode: "regular", sms: message }) }); return { to, status: response.status, body: await response.json().catch(() => ({})) }; }));
    const failed = results.filter((result) => result.status < 200 || result.status >= 300 || result.body?.data?.status_code && result.body.data.status_code !== "000");
    await supabase.from("sms_messages").update({ status: failed.length ? (failed.length === results.length ? "failed" : "partial") : "sent", provider_response: results, completed_at: new Date().toISOString(), error_message: failed.length ? `${failed.length} message(s) failed` : null }).eq("id", record.id);
    if (failed.length) return json({ error: `${failed.length} message(s) failed`, sent: results.length - failed.length, total: results.length }, 502);
    return json({ success: true, sent: results.length, charge: totalCharge, id: record.id });
  } catch (error) { console.error("[v0] TxtConnect SMS error", error); return json({ error: "SMS service request failed" }, 500); }
});
