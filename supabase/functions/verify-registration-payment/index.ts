import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Verify with Paystack
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== "success") {
      return new Response(
        JSON.stringify({ error: "Payment not verified", details: verifyData.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const txData = verifyData.data;
    const metadata = txData.metadata || {};
    const paymentType = metadata.type;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // =========================================================
    // AGENT REGISTRATION — approve existing store immediately
    // =========================================================
    if (paymentType === "agent_registration") {
      console.log("[verify-reg] Processing agent_registration payment");
      const agentStoreId = metadata.agent_store_id;

      if (!agentStoreId) {
        return new Response(JSON.stringify({ error: "Missing agent_store_id in payment metadata" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already approved (idempotency)
      const { data: storeRow } = await supabase
        .from("agent_stores")
        .select("id, approved")
        .eq("id", agentStoreId)
        .maybeSingle();

      if (storeRow?.approved) {
        console.log("[verify-reg] Store already approved");
        return new Response(
          JSON.stringify({ success: true, approved: true, already_processed: true, message: "Store already approved" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: approveErr } = await supabase
        .from("agent_stores")
        .update({ approved: true })
        .eq("id", agentStoreId);

      if (approveErr) {
        console.error("[verify-reg] Failed to approve store:", approveErr);
        return new Response(JSON.stringify({ error: "Failed to approve store", details: approveErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[verify-reg] Agent store approved:", agentStoreId);
      return new Response(
        JSON.stringify({ success: true, approved: true, message: "Payment confirmed. Your store is now live!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================
    // NEW STORE CREATION FLOW (called from AgentRegistrationCallback)
    // metadata contains store_data + user_id embedded by initialize-payment
    // =========================================================
    const userId = metadata.user_id || null;
    const storeData = metadata.store_data || null;

    if (!userId || !storeData) {
      // Caller must create the store themselves (it has the data in sessionStorage)
      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment verified. Please complete store creation.",
          user_id: userId,
          store_data: storeData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if store already exists for this user (idempotency)
    const { data: existingStore } = await supabase
      .from("agent_stores")
      .select("id, approved")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingStore) {
      // Store exists — ensure it is approved
      if (!existingStore.approved) {
        await supabase
          .from("agent_stores")
          .update({ approved: true })
          .eq("id", existingStore.id);
      }
      console.log("[verify-reg] Existing store approved:", existingStore.id);
      return new Response(
        JSON.stringify({ success: true, approved: true, already_processed: true, message: "Store already created and approved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the store — approved immediately since payment is confirmed
    const { data: newStore, error: insertErr } = await supabase
      .from("agent_stores")
      .insert({
        user_id: userId,
        store_name: storeData.store_name,
        whatsapp_number: storeData.whatsapp_number || "",
        support_number: storeData.support_number || "",
        whatsapp_group: storeData.whatsapp_group || null,
        momo_number: storeData.momo_number || "",
        momo_name: storeData.momo_name || "",
        momo_network: storeData.momo_network || "mtn",
        approved: true,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[verify-reg] Failed to create store:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create store", details: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[verify-reg] New agent store created and approved:", newStore.id);
    return new Response(
      JSON.stringify({
        success: true,
        approved: true,
        store_id: newStore.id,
        message: "Store created and approved. Payment confirmed!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[verify-reg] Unexpected error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
