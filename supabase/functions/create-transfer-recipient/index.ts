// supabase/functions/create-transfer-recipient/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      account_holder_name,
      provider_type,
      mobile_money_network,
      mobile_money_number,
      account_number,
      bank_code,
      bank_name,
    } = await req.json();

    if (!account_holder_name || !provider_type) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: account_holder_name, provider_type",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error(`[CREATE-RECIPIENT] Auth error:`, userError?.message);
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[CREATE-RECIPIENT] Request from user: ${user.id}`);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[CREATE-RECIPIENT] PAYSTACK_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment service not configured",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max 2 recipients limit
    const { count, error: countError } = await supabase
      .from("transfer_recipients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");

    if (!countError && count && count >= 2) {
      console.log(`[CREATE-RECIPIENT] Recipient limit reached: ${count}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Maximum 2 active recipients allowed. Please deactivate one before adding another.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Paystack payload
    let paystackPayload: any = {};

    if (provider_type === "bank") {
      paystackPayload = {
        type: "nuban",
        name: account_holder_name,
        account_number: account_number,
        bank_code: bank_code,
        currency: "GHS",
      };
    } else {
      // Mobile money
      const bankCodeMapping: Record<string, string> = {
        "mtn": "MTN",
        "telecel": "VOD",
        "vodafone": "VOD",
        "airteltigo": "ATL",
      };
      const bankCode = bankCodeMapping[mobile_money_network] || "MTN";

      paystackPayload = {
        type: "mobile_money",
        name: account_holder_name,
        account_number: mobile_money_number,
        bank_code: bankCode,
        currency: "GHS",
      };
    }

    console.log(`[CREATE-RECIPIENT] Creating Paystack recipient:`, JSON.stringify(paystackPayload));

    const paystackRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const contentType = paystackRes.headers.get("content-type");
    let paystackResult: any;

    if (contentType && contentType.includes("application/json")) {
      paystackResult = await paystackRes.json();
    } else {
      const textBody = await paystackRes.text();
      console.error(
        `[CREATE-RECIPIENT] Non-JSON response from Paystack. Status: ${paystackRes.status}, Content-Type: ${contentType}, Body: ${textBody.substring(0, 200)}`
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: `Paystack API error (HTTP ${paystackRes.status}): Invalid response format`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!paystackResult.status) {
      console.error(`[CREATE-RECIPIENT] Paystack error:`, paystackResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create recipient: ${paystackResult.message}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientCode = paystackResult.data.recipient_code;

    // Save to database
    const { data: newRecipient, error: insertError } = await supabase
      .from("transfer_recipients")
      .insert({
        user_id: user.id,
        recipient_code: recipientCode,
        account_holder_name: account_holder_name,
        provider_type: provider_type,
        bank_name: bank_name || null,
        bank_code: bank_code || null,
        account_number: account_number || null,
        mobile_money_network: mobile_money_network || null,
        mobile_money_number: mobile_money_number || null,
        status: "active",
      })
      .select("id, recipient_code, account_holder_name, mobile_money_network, mobile_money_number, provider_type")
      .single();

    if (insertError) {
      console.error(`[CREATE-RECIPIENT] Failed to save recipient:`, insertError.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to save recipient to database",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CREATE-RECIPIENT] Recipient created successfully: ${newRecipient.id}, code: ${recipientCode}`);

    return new Response(
      JSON.stringify({
        success: true,
        recipient: newRecipient,
        message: "Recipient created successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[CREATE-RECIPIENT] Error:`, err);
    return new Response(
      JSON.stringify({
        success: false,
        error: (err as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
