import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { phone, pin, service_id } = await req.json();
    if (!/^\d{10}$/.test(String(phone)) || !/^\d{4}$/.test(String(pin)) || !service_id) return json({ error: "Invalid activation details" }, 400);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(pin)));
    const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order } = await db.from("digital_service_orders").select("id,credential_id").eq("service_id", service_id).eq("customer_phone", phone).eq("access_pin_hash", hash).eq("payment_status", "paid").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!order?.credential_id) return json({ error: "No paid access found for these details" }, 403);
    const { data: credential, error } = await db.from("digital_service_credentials").select("email,password,instructions").eq("id", order.credential_id).eq("assigned_order_id", order.id).single();
    if (error || !credential) return json({ error: "Assigned access is unavailable" }, 404);
    return json({ success: true, credential });
  } catch (error) {
    console.error("[v0] Service activation failed", error);
    return json({ error: "Activation failed" }, 500);
  }
});
