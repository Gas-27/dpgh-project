import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hasUnicode = (value: string) => /[^\x00-\x7F]/.test(value);
const RATE_LIMITED = /too many request|rate.?limit/i;
const BATCH_CONCURRENCY = 5;

type Job = {
  schedule_id: string; user_id: string; owner_type: string; owner_id: string; sender_id: string;
  message: string; recipients: string[]; unit_price: number; total_charge: number;
};
type SendResult = { to: string; ok: boolean; message_id: unknown; reason: string };

const providerReason = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["reason", "message", "error", "detail", "msg", "description", "status_message"]) {
      const reason = providerReason(object[key]);
      if (reason) return reason;
    }
  }
  return null;
};

Deno.serve(async (request) => {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    const cronSecret = Deno.env.get("SMS_CRON_SECRET");
    const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const trusted = (cronSecret && request.headers.get("x-cron-secret") === cronSecret) || (serviceKey && bearer === serviceKey);
    if (!trusted) return json({ error: "Not allowed" }, 401);
    if (!serviceKey) return json({ error: "SMS service is not configured" }, 503);

    const providerAuth = Deno.env.get("TXTCONNECT_API_KEY") || Deno.env.get("TXT_CONNECT_API") || Deno.env.get("CURL_AUTH_HEADER_12") || Deno.env.get("CURL_AUTH_HEADER") || Deno.env.get("API_KEY");
    if (!providerAuth) return json({ error: "SMS service is not configured" }, 503);
    const providerHeaders = { Authorization: providerAuth.startsWith("Bearer ") ? providerAuth : `Bearer ${providerAuth}`, "Content-Type": "application/json" };

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data: claimed, error: claimError } = await admin.rpc("claim_due_scheduled_sms", { p_limit: 20 });
    if (claimError) { console.error("[v0] claim scheduled SMS failed", claimError); return json({ error: "Could not claim scheduled SMS" }, 500); }
    const jobs = (claimed || []) as Job[];

    const sendOne = async (job: Job, to: string): Promise<SendResult> => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const response = await fetch("https://api.txtconnect.net/dev/api/sms/send", {
            method: "POST", headers: providerHeaders,
            body: JSON.stringify({ to: `233${to.slice(1)}`, from: job.sender_id, unicode: hasUnicode(job.message), sms: job.message }),
          });
          const raw = await response.text();
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { parsed = { raw }; }
          const data = (parsed.data || {}) as Record<string, unknown>;
          if (response.status === 429 || RATE_LIMITED.test(raw)) { await wait(5000 * (attempt + 1)); continue; }
          if (response.status >= 500) { await wait(400 * 2 ** attempt); continue; }
          const ok = response.status >= 200 && response.status < 300 && !(data.status_code && data.status_code !== "000");
          return { to, ok, message_id: parsed.messageId || parsed.message_id || data.messageId || data.message_id || null, reason: ok ? "" : (providerReason(parsed) || `HTTP ${response.status}`) };
        } catch {
          await wait(400 * 2 ** attempt);
        }
      }
      return { to, ok: false, message_id: null, reason: "SMS service was busy" };
    };

    const summary: Array<Record<string, unknown>> = [];
    for (const job of jobs) {
      const { data: record, error: insertError } = await admin.from("sms_messages").insert({
        user_id: job.user_id, owner_type: job.owner_type, owner_id: job.owner_id, recipients: job.recipients, sender_id: job.sender_id,
        message: job.message, total_charge: job.total_charge, unit_price: job.unit_price, status: "sending", provider_response: [],
        sent_count: 0, failed_count: 0, unicode: hasUnicode(job.message) ? "unicode" : "regular",
      }).select("id").single();
      if (insertError || !record) {
        await admin.rpc("refund_sms_wallet", { p_user_id: job.user_id, p_amount: job.total_charge, p_owner_type: job.owner_type });
        await admin.from("scheduled_sms").update({ last_status: "failed", last_error: "Could not record the SMS. Your wallet was refunded." }).eq("id", job.schedule_id);
        summary.push({ id: job.schedule_id, status: "failed" });
        continue;
      }

      const results: SendResult[] = [];
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, job.recipients.length) }, async () => {
        while (cursor < job.recipients.length) results.push(await sendOne(job, job.recipients[cursor++]));
      }));

      const sent = results.filter((item) => item.ok).length;
      const failed = job.recipients.length - sent;
      const refund = sent === 0 ? job.total_charge : job.unit_price * failed;
      if (refund > 0) await admin.rpc("refund_sms_wallet", { p_user_id: job.user_id, p_amount: refund, p_owner_type: job.owner_type });
      const finalStatus = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
      await admin.from("sms_messages").update({
        status: finalStatus, provider_response: results, provider_message_ids: results.map((item) => item.message_id).filter(Boolean),
        sent_count: sent, failed_count: failed, last_delivery_check_at: null, completed_at: new Date().toISOString(),
        error_message: failed ? `${failed} message(s) could not be delivered` : null,
      }).eq("id", record.id);
      await admin.from("scheduled_sms").update({
        last_status: finalStatus === "sent" ? "success" : finalStatus,
        last_error: failed ? `${failed} of ${job.recipients.length} not delivered and refunded` : null,
      }).eq("id", job.schedule_id);
      summary.push({ id: job.schedule_id, status: finalStatus, sent, failed });
    }
    return json({ processed: jobs.length, summary });
  } catch (error) {
    console.error("[v0] scheduled SMS runner error", error);
    return json({ error: "Scheduled SMS runner failed" }, 500);
  }
});
