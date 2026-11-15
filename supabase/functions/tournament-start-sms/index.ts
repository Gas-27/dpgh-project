import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SENDER_ID = "GAMEHUB";
const ENTRY_MINUTES = 5;
const CONCURRENCY = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toProviderNumber = (raw: unknown): string | null => {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  if (/^233[0-9]{9}$/.test(digits)) return digits;
  if (/^0[0-9]{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^[0-9]{9}$/.test(digits)) return `233${digits}`;
  return null;
};

const buildMessage = (title: string) => {
  const name = title.length > 32 ? `${title.slice(0, 29)}...` : title;
  return `Your Game Hub tournament "${name}" has started! You already paid, so open Game Hub and join now. You have ${ENTRY_MINUTES} minutes to enter.`;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "SMS service is not configured" }, 503);
    if (!authHeader) return json({ error: "Sign in first" }, 401);

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin, error: adminError } = await caller.rpc("is_wallet_admin");
    if (adminError || isAdmin !== true) return json({ error: "Admin only" }, 403);

    const body = await request.json().catch(() => ({}));
    const tournamentId = typeof body?.tournament_id === "string" ? body.tournament_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(tournamentId)) return json({ error: "Missing tournament" }, 400);

    const providerAuth = Deno.env.get("TXTCONNECT_API_KEY") || Deno.env.get("TXT_CONNECT_API") || Deno.env.get("CURL_AUTH_HEADER_12") || Deno.env.get("CURL_AUTH_HEADER") || Deno.env.get("API_KEY");
    if (!providerAuth) return json({ error: "SMS service is not configured" }, 503);
    const providerHeaders = { Authorization: providerAuth.startsWith("Bearer ") ? providerAuth : `Bearer ${providerAuth}`, "Content-Type": "application/json" };

    const admin = createClient(url, serviceKey);
    const { data: tournament } = await admin.from("gamehub_tournaments").select("id, title, status").eq("id", tournamentId).maybeSingle();
    if (!tournament) return json({ error: "Tournament not found" }, 404);
    if (tournament.status !== "live") return json({ error: "Tournament has not started" }, 409);

    const { data: entries } = await admin.from("gamehub_tournament_entries").select("user_id").eq("tournament_id", tournamentId).eq("status", "joined");
    const { data: already } = await admin.from("gamehub_tournament_sms").select("user_id").eq("tournament_id", tournamentId);
    const done = new Set((already || []).map((row) => row.user_id as string));
    const pending = Array.from(new Set((entries || []).map((row) => row.user_id as string))).filter((id) => !done.has(id));
    if (pending.length === 0) return json({ sent: 0, failed: 0, skipped: 0, already_sent: done.size });

    const { data: profiles } = await admin.from("profiles").select("id, phone").in("id", pending);
    const phoneByUser = new Map((profiles || []).map((row) => [row.id as string, row.phone as string | null]));
    const message = buildMessage(String(tournament.title));

    const sendOne = async (to: string): Promise<{ ok: boolean; reason: string }> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch("https://api.txtconnect.net/dev/api/sms/send", {
            method: "POST", headers: providerHeaders,
            body: JSON.stringify({ to, from: SENDER_ID, unicode: false, sms: message }),
          });
          const raw = await response.text();
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { parsed = {}; }
          const data = (parsed.data || {}) as Record<string, unknown>;
          if (response.status === 429 || response.status >= 500) { await wait(1500 * (attempt + 1)); continue; }
          const ok = response.status >= 200 && response.status < 300 && !(data.status_code && data.status_code !== "000");
          return { ok, reason: ok ? "" : `HTTP ${response.status}` };
        } catch {
          await wait(800 * (attempt + 1));
        }
      }
      return { ok: false, reason: "SMS service was busy" };
    };

    const rows: Array<{ tournament_id: string; user_id: string; phone: string | null; status: string; error: string | null }> = [];
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
      while (cursor < pending.length) {
        const userId = pending[cursor++];
        const number = toProviderNumber(phoneByUser.get(userId));
        if (!number) { rows.push({ tournament_id: tournamentId, user_id: userId, phone: null, status: "skipped", error: "No valid phone number on the account" }); continue; }
        const result = await sendOne(number);
        rows.push({ tournament_id: tournamentId, user_id: userId, phone: number, status: result.ok ? "sent" : "failed", error: result.ok ? null : result.reason });
      }
    }));

    if (rows.length) await admin.from("gamehub_tournament_sms").upsert(rows, { onConflict: "tournament_id,user_id" });
    return json({
      sent: rows.filter((row) => row.status === "sent").length,
      failed: rows.filter((row) => row.status === "failed").length,
      skipped: rows.filter((row) => row.status === "skipped").length,
      already_sent: done.size,
    });
  } catch (error) {
    console.error("[v0] tournament start SMS error", error);
    return json({ error: "Could not send tournament SMS" }, 500);
  }
});
