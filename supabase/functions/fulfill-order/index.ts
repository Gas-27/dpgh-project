import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NETWORK_MAP: Record<string, string> = {
  mtn: "MTN",
  telecel: "TELECEL",
  airteltigo: "AIRTELTIGO_ISHARE",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataApiKey = Deno.env.get("DATA_API_KEY");

    if (!dataApiKey) {
      return new Response(JSON.stringify({ error: "Data API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number - remove +233 or 233 prefix
    let phone = order.customer_number.replace(/[^0-9]/g, "");
    if (phone.startsWith("233")) {
      phone = "0" + phone.slice(3);
    }
    if (!phone.startsWith("0")) {
      phone = "0" + phone;
    }

    const network = NETWORK_MAP[order.network] || order.network.toUpperCase();
    const apiUrl = `https://backend.mycledanet.com/${dataApiKey}/order`;

    console.log(`Fulfilling order ${order_id}: phone=${phone}, size=${order.size_gb}, network=${network}`);

    const apiRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": dataApiKey,
      },
      body: JSON.stringify({
        phone,
        size: Number(order.size_gb),
        network,
      }),
    });

    const apiData = await apiRes.text();
    console.log(`API response for order ${order_id}: ${apiRes.status} - ${apiData}`);

    if (apiRes.ok) {
      await supabase
        .from("orders")
        .update({ fulfillment_status: "completed", api_response: apiData, status: "completed" })
        .eq("id", order_id);

      return new Response(JSON.stringify({ success: true, message: "Order fulfilled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await supabase
        .from("orders")
        .update({ fulfillment_status: "failed", api_response: apiData })
        .eq("id", order_id);

      return new Response(JSON.stringify({ success: false, message: "Fulfillment failed", api_response: apiData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Fulfill error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
