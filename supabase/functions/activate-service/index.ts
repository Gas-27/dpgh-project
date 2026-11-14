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
    if (service.service_type === "public_shared") {
      if (!order && !service.is_free) {
        // Self-heal: the customer paid but no order was recorded (browser never returned to verify).
        // Find the successful Paystack transaction carrying this phone, access code and service.
        const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
        const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        for (let page = 1; secret && !order && page <= 3; page++) {
          const res = await fetch(`https://api.paystack.co/transaction?status=success&perPage=100&page=${page}&from=${encodeURIComponent(from)}`, { headers: { Authorization: `Bearer ${secret}` } }).catch(() => null);
          const body = res ? await res.json().catch(() => null) : null;
          const rows = body?.data;
          if (!res?.ok || !Array.isArray(rows) || !rows.length) break;
          for (const tx of rows) {
            let meta = tx.metadata;
            if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { meta = null; } }
            if (!meta || typeof meta !== "object") continue;
            const txPhone = String(meta.customer_phone || meta.phone || "").replace(/\D/g, "");
            if (String(meta.service_id) !== String(service_id) || txPhone !== String(phone) || String(meta.access_pin || "").trim() !== String(pin)) continue;
            const paidAt = new Date(tx.paid_at || tx.paidAt || tx.created_at || Date.now()).getTime();
            const { data: existingRef } = await db.from("digital_service_orders").select("id").eq("paystack_reference", tx.reference).maybeSingle();
            if (existingRef) continue;
            const { data: recovered } = await db.from("digital_service_orders").insert({ service_id, credential_id: null, customer_id: meta.user_id || meta.customer_id || null, customer_phone: phone, access_pin_hash: hash, paystack_reference: tx.reference, payment_status: "paid", access_granted_at: new Date(paidAt).toISOString(), access_expires_at: new Date(paidAt + 7 * 24 * 60 * 60 * 1000).toISOString() }).select("id,credential_id,customer_id,access_expires_at").single();
            if (recovered) { order = recovered; break; }
          }
          if (rows.length < 100) break;
        }
      }
      if (!order && !service.is_free) return json({ error: "No paid access found for these details" }, 403);
      if (order && order.access_expires_at && new Date(order.access_expires_at).getTime() <= Date.now()) return json({ error: "Payment expired. Please pay again to access this service." }, 402);
      const { data: credentials, error: credentialsError } = await db.from("digital_service_credentials").select("email,password,instructions").eq("service_id", service_id).eq("active", true).order("slot_number");
      if (credentialsError || !credentials?.length) return json({ error: "Public service login details are not configured yet." }, 404);
      return json({ success: true, credentials, access_expires_at: order?.access_expires_at || null });
    }
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
