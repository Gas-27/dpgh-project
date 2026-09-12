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
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
    const { data: authData } = token ? await authClient.auth.getUser(token) : { data: { user: null } };
    const customerId = authData.user?.id || null;
    let { data: service, error: serviceError } = await db.from("digital_services").select("id,name,is_free,service_type").eq("id", service_id).eq("active", true).single();
    if (serviceError || !service) return json({ error: "Service is unavailable" }, 404);
    let { data: order } = await db.from("digital_service_orders").select("id,credential_id,customer_id,access_expires_at").eq("service_id", service_id).eq("customer_phone", phone).eq("access_pin_hash", hash).in("payment_status", ["paid", "free"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (order && service.service_type === "public_shared" && (order.customer_id !== customerId || (order.access_expires_at && new Date(order.access_expires_at).getTime() <= Date.now()))) return json({ error: "Payment expired. Please pay again to access this service." }, 402);
    if (!order && service.is_free) {
      let { data: slot } = await db.from("digital_service_credentials").select("id,email,password,instructions").eq("service_id", service_id).eq("active", true).is("assigned_order_id", null).order("slot_number").limit(1).maybeSingle();
      if (!slot) {
        const generatedPassword = `${String(phone).slice(-4)}-${crypto.randomUUID().slice(0, 8)}`;
        const { data: createdSlot } = await db.from("digital_service_credentials").insert({ service_id, email: `${String(phone)}@${String(service.name).toLowerCase().replace(/[^a-z0-9]+/g, "")}.local`, password: generatedPassword, instructions: "Your personal access was created automatically.", slot_number: Date.now(), active: true }).select("id,email,password,instructions").single();
        slot = createdSlot;
      }
      if (slot) {
        const { data: created } = await db.from("digital_service_orders").insert({ service_id, credential_id: slot.id, customer_phone: phone, access_pin_hash: hash, payment_status: "free", access_granted_at: new Date().toISOString() }).select("id,credential_id").single();
        if (created) { order = created; await db.from("digital_service_credentials").update({ assigned_order_id: created.id, assigned_phone: phone, assigned_pin_hash: hash, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", slot.id).is("assigned_order_id", null); }
      }
    }
    if (!order?.credential_id) return json({ error: "No paid access found for these details" }, 403);
    const { data: credential, error } = await db.from("digital_service_credentials").select("email,password,instructions").eq("id", order.credential_id).eq("assigned_order_id", order.id).single();
    if (error || !credential) return json({ error: "Assigned access is unavailable" }, 404);
    return json({ success: true, credential });
  } catch (error) {
    console.error("[v0] Service activation failed", error);
    return json({ error: "Activation failed" }, 500);
  }
});
