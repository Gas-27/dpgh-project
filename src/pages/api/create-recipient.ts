import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
      userId,
    } = req.body;

    console.log("[CREATE-RECIPIENT] Request received:", {
      account_holder_name,
      provider_type,
      mobile_money_network,
    });

    // Validate required fields
    if (!account_holder_name || !provider_type || !userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[CREATE-RECIPIENT] PAYSTACK_SECRET_KEY not configured");
      return res.status(500).json({
        success: false,
        error: "Payment service not configured",
      });
    }

    // Check max 2 recipients limit
    const { count, error: countError } = await supabase
      .from("transfer_recipients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active");

    if (!countError && count && count >= 2) {
      console.log(`[CREATE-RECIPIENT] Recipient limit reached: ${count}`);
      return res.status(400).json({
        success: false,
        error: "Maximum 2 active recipients allowed",
      });
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
        mtn: "MTN",
        telecel: "VOD",
        vodafone: "VOD",
        airteltigo: "ATL",
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

    console.log("[CREATE-RECIPIENT] Creating Paystack recipient:", paystackPayload);

    const paystackRes = await fetch(
      "https://api.paystack.co/transferrecipient",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paystackPayload),
      }
    );

    const paystackResult = await paystackRes.json();

    console.log("[CREATE-RECIPIENT] Paystack response:", paystackResult);

    if (!paystackResult.status) {
      console.error("[CREATE-RECIPIENT] Paystack error:", paystackResult);
      return res.status(400).json({
        success: false,
        error: `Failed to create recipient: ${paystackResult.message}`,
      });
    }

    const recipientCode = paystackResult.data.recipient_code;

    // Save to database
    const { data: newRecipient, error: insertError } = await supabase
      .from("transfer_recipients")
      .insert({
        user_id: userId,
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
      .select()
      .single();

    if (insertError) {
      console.error("[CREATE-RECIPIENT] Failed to save recipient:", insertError);
      return res.status(500).json({
        success: false,
        error: "Failed to save recipient",
      });
    }

    console.log(
      `[CREATE-RECIPIENT] Recipient created successfully: ${recipientCode}`
    );

    return res.status(200).json({
      success: true,
      recipient: newRecipient,
    });
  } catch (error: any) {
    console.error("[CREATE-RECIPIENT] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
