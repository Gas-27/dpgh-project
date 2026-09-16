// supabase/functions/create-payout-request/index.ts

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
      requester_type,
      requester_id,
      withdrawal_source: initialWithdrawalSource,
      amount,
      recipient_id,
      recipient_details,
    } = await req.json();

    let withdrawal_source = initialWithdrawalSource;

    if (!requester_type || !requester_id || !amount) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required fields: requester_type, requester_id, amount",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!recipient_id && !recipient_details) {
      return new Response(JSON.stringify({
        success: false,
        error: "Provide either recipient_id or recipient_details",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "Amount must be greater than zero",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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
      console.error(`[CREATE-PAYOUT] Auth error:`, userError?.message);
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =============================================
    // Determine if the caller is an admin.
    // Admins can request payouts on behalf of a store (impersonation),
    // so we must NOT force user_id == store.user_id in that case.
    // =============================================
    let isAdmin = false;
    {
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (roleError) {
        console.error(`[CREATE-PAYOUT] Role lookup error:`, roleError.message);
      } else {
        isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
      }
    }
    console.log(`[CREATE-PAYOUT] Caller ${user.id} isAdmin: ${isAdmin}`);

    // =============================================
    // STEP 1: Validate requester and check balance
    // Look up the store by id ONLY (service role bypasses RLS),
    // then authorize: allow if caller owns the store OR is an admin.
    // =============================================
    let currentBalance = 0;
    let requesterData: any = null;

    if (requester_type === "agent") {
      // requester_id is the auth user UUID (session.user.id) — look up by user_id.
      // This works whether the agent is logged in directly or an admin is acting
      // on their behalf (admin passes the agent's user_id as requester_id).
      const { data, error } = await supabase
        .from("agent_stores")
        .select("id, user_id, wallet_balance, subagent_commission_balance, last_withdrawal_at")
        .eq("user_id", requester_id)
        .maybeSingle();

      if (error || !data) {
        console.error(`[CREATE-PAYOUT] Agent store not found for user_id: ${requester_id}`, error?.message);
        return new Response(JSON.stringify({ success: false, error: "Agent store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization: the caller must be the store owner OR an admin
      if (data.user_id !== user.id && !isAdmin) {
        return new Response(JSON.stringify({ success: false, error: "Not authorized for this store" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      requesterData = data;

      // Accept both short form ("wallet"/"subagent_commission") and full form
      if (withdrawal_source === "wallet_balance" || withdrawal_source === "wallet") {
        currentBalance = Number(data.wallet_balance);
        withdrawal_source = "wallet_balance";
      } else if (withdrawal_source === "subagent_commission_balance" || withdrawal_source === "subagent_commission") {
        currentBalance = Number(data.subagent_commission_balance);
        withdrawal_source = "subagent_commission_balance";
      } else {
        return new Response(JSON.stringify({ success: false, error: "Invalid withdrawal_source for agent" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (requester_type === "subagent") {
      const { data, error } = await supabase
        .from("subagent_stores")
        .select("id, user_id, wallet_balance, agent_store_id")
        .eq("id", requester_id)
        .maybeSingle();

      if (error || !data) {
        console.error(`[CREATE-PAYOUT] Subagent store not found: ${requester_id}`, error?.message);
        return new Response(JSON.stringify({ success: false, error: "Subagent store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization: owner or admin only
      if (data.user_id !== user.id && !isAdmin) {
        console.error(`[CREATE-PAYOUT] Forbidden: user ${user.id} is not owner of subagent store ${requester_id} and not admin`);
        return new Response(JSON.stringify({ success: false, error: "Not authorized for this store" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      requesterData = data;
      withdrawal_source = "wallet_balance";
      currentBalance = Number(data.wallet_balance);
    } else {
      return new Response(JSON.stringify({ success: false, error: "Invalid requester_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (currentBalance < amount) {
      return new Response(JSON.stringify({
        success: false,
        error: `Insufficient balance. Available: GHS ${currentBalance}`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =============================================
    // CHECK 24-HOUR WITHDRAWAL COOLDOWN
    // =============================================
    const lastWithdrawalAt = requesterData.last_withdrawal_at;
    if (lastWithdrawalAt) {
      const lastWithdrawalTime = new Date(lastWithdrawalAt).getTime();
      const now = Date.now();
      const timeSinceLastWithdrawal = now - lastWithdrawalTime;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (timeSinceLastWithdrawal < TWENTY_FOUR_HOURS) {
        const remainingTime = TWENTY_FOUR_HOURS - timeSinceLastWithdrawal;
        const hoursRemaining = Math.ceil(remainingTime / (60 * 60 * 1000));
        const minutesRemaining = Math.ceil((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
        
        console.log(`[CREATE-PAYOUT] Cooldown active. Hours remaining: ${hoursRemaining}, Minutes: ${minutesRemaining}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Withdrawal cooldown active. Try again in ${hoursRemaining}h ${minutesRemaining}m`,
          cooldown_remaining_ms: remainingTime,
          retry_after: new Date(now + remainingTime).toISOString(),
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // The owner of the store/recipient rows (matters when an admin acts on behalf of a store)
    const storeUserId = requesterData.user_id as string;

    // =============================================
    // STEP 2: Get or create transfer recipient
    // =============================================
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[CREATE-PAYOUT] PAYSTACK_SECRET_KEY not configured");
      return new Response(JSON.stringify({
        success: false,
        error: "Payment service not configured",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let recipientId = recipient_id;
    let recipientCode: string | null = null;

    // If recipient_id (recipient_code) provided, fetch the recipient row
    if (recipientId) {
      const { data: recipient, error: recipientError } = await supabase
        .from("transfer_recipients")
        .select("id, recipient_code, provider_type, account_holder_name, account_number, mobile_money_number, bank_name")
        .eq("recipient_code", recipientId)
        .maybeSingle();

      if (recipientError || !recipient) {
        console.error(`[CREATE-PAYOUT] Recipient not found: ${recipientId}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Recipient not found",
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const recipientUuidId = recipient.id;
      recipientCode = recipient.recipient_code;

      console.log(`[CREATE-PAYOUT] Using existing recipient: ${recipientUuidId}, code: ${recipientCode}`);

      recipientId = recipientUuidId;
    }

    // If recipient_details provided, create new recipient
    if (recipient_details && !recipientId) {
      // Check max 2 recipients limit (scoped to the STORE owner, not the caller)
      const { count, error: countError } = await supabase
        .from("transfer_recipients")
        .select("id", { count: "exact", head: true })
        .eq("user_id", storeUserId)
        .eq("status", "active");

      if (!countError && count && count >= 2) {
        console.log(`[CREATE-PAYOUT] Recipient limit reached: ${count}`);
        return new Response(JSON.stringify({
          success: false,
          error: "Maximum 2 active recipients allowed. Please deactivate one before adding another.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Build Paystack payload
      let paystackPayload: any = {};

      if (recipient_details.provider_type === "bank") {
        paystackPayload = {
          type: "nuban",
          name: recipient_details.account_holder_name,
          account_number: recipient_details.account_number,
          bank_code: recipient_details.bank_code,
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
        const bankCode = bankCodeMapping[recipient_details.mobile_money_network] || "MTN";

        paystackPayload = {
          type: "mobile_money",
          name: recipient_details.account_holder_name,
          account_number: recipient_details.mobile_money_number,
          bank_code: bankCode,
          currency: "GHS",
        };
      }

      console.log(`[CREATE-PAYOUT] Creating Paystack recipient:`, JSON.stringify(paystackPayload));

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
        console.error(`[CREATE-PAYOUT] Non-JSON response from Paystack. Status: ${paystackRes.status}, Content-Type: ${contentType}, Body: ${textBody.substring(0, 200)}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Paystack API error (HTTP ${paystackRes.status}): Invalid response format`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!paystackResult.status) {
        console.error(`[CREATE-PAYOUT] Paystack error:`, paystackResult);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to create recipient: ${paystackResult.message}`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      recipientCode = paystackResult.data.recipient_code;

      // Save to database under the STORE owner
      const { data: newRecipient, error: insertError } = await supabase
        .from("transfer_recipients")
        .insert({
          user_id: storeUserId,
          recipient_code: recipientCode,
          account_holder_name: recipient_details.account_holder_name,
          provider_type: recipient_details.provider_type,
          bank_name: recipient_details.bank_name || null,
          bank_code: recipient_details.bank_code || null,
          account_number: recipient_details.account_number || null,
          mobile_money_network: recipient_details.mobile_money_network || null,
          mobile_money_number: recipient_details.mobile_money_number || null,
          status: "active",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`[CREATE-PAYOUT] Failed to save recipient:`, insertError.message);
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to save recipient",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      recipientId = newRecipient.id;
      console.log(`[CREATE-PAYOUT] Created recipient: ${recipientId}, code: ${recipientCode}`);
    }

    if (!recipientCode) {
      console.error(`[CREATE-PAYOUT] No recipient code available`);
      return new Response(JSON.stringify({
        success: false,
        error: "No recipient code available",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =============================================
    // STEP 3: Create payout request with processing status
    // =============================================
    const { data: payoutRequest, error: payoutError } = await supabase
      .from("payout_requests")
      .insert({
        requester_type: requester_type,
        requester_id: requester_id,
        recipient_id: recipientId,
        amount: amount,
        withdrawal_source: withdrawal_source,
        source_balance_before: currentBalance,
        status: "processing",
      })
      .select("id")
      .single();

    if (payoutError) {
      console.error(`[CREATE-PAYOUT] Failed to create payout request:`, payoutError.message);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to create payout request",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payoutId = payoutRequest.id;
    console.log(`[CREATE-PAYOUT] Payout request created: ${payoutId}`);

    // =============================================
    // STEP 4: Deduct balance (before transfer)
    // =============================================
    const balanceAfter = currentBalance - amount;

    if (requester_type === "agent") {
      if (withdrawal_source === "wallet_balance") {
        console.log(`[CREATE-PAYOUT] Updating agent wallet - Before: ${currentBalance}, After: ${balanceAfter}`);
        const { error: updateError } = await supabase
          .from("agent_stores")
          .update({ wallet_balance: balanceAfter })
          .eq("id", requester_id);

        if (updateError) {
          console.error(`[CREATE-PAYOUT] ❌ CRITICAL: Failed to deduct agent wallet:`, updateError.message);
          console.error(`[CREATE-PAYOUT] Store ID: ${requester_id}, Attempted balance: ${balanceAfter}`);
          await supabase.from("payout_requests").delete().eq("id", payoutId);
          return new Response(JSON.stringify({ success: false, error: "Failed to process withdrawal" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log(`[CREATE-PAYOUT] ✅ Agent wallet updated successfully: ${requester_id}`);
      } else {
        const { error: updateError } = await supabase
          .from("agent_stores")
          .update({ subagent_commission_balance: balanceAfter })
          .eq("id", requester_id);

        if (updateError) {
          console.error(`[CREATE-PAYOUT] Failed to deduct agent commission:`, updateError.message);
          await supabase.from("payout_requests").delete().eq("id", payoutId);
          return new Response(JSON.stringify({ success: false, error: "Failed to process withdrawal" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      console.log(`[CREATE-PAYOUT] Updating subagent wallet - Before: ${currentBalance}, After: ${balanceAfter}`);
      const { error: updateError } = await supabase
        .from("subagent_stores")
        .update({ wallet_balance: balanceAfter })
        .eq("id", requester_id);

      if (updateError) {
        console.error(`[CREATE-PAYOUT] ❌ CRITICAL: Failed to deduct subagent wallet:`, updateError.message);
        console.error(`[CREATE-PAYOUT] Store ID: ${requester_id}, Attempted balance: ${balanceAfter}`);
        await supabase.from("payout_requests").delete().eq("id", payoutId);
        return new Response(JSON.stringify({ success: false, error: "Failed to process withdrawal" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[CREATE-PAYOUT] ✅ Subagent wallet updated successfully: ${requester_id}`);
    }

    console.log(`[CREATE-PAYOUT] ✅ BALANCE DEDUCTED: ${currentBalance} -> ${balanceAfter}`);
    console.log(`[CREATE-PAYOUT] Database Update Result: Deducted GHS ${amount} from ${requester_type} ${requester_id}`);
    console.log(`[CREATE-PAYOUT] Payout Request ID: ${payoutId}`);

    // =============================================
    // STEP 5: Initiate Paystack Transfer
    // =============================================
    const transferReference = `PAYOUT_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const amountInPesewas = Math.round(amount * 100);

    const transferPayload = {
      source: "balance",
      amount: amountInPesewas,
      recipient: recipientCode,
      reference: transferReference,
      reason: `Payout for ${requester_type} ${requester_id}`,
    };

    console.log(`[CREATE-PAYOUT] Initiating Paystack transfer:`, JSON.stringify(transferPayload));

    let transferSuccess = false;
    let transferError: string | null = null;
    let transferData: any = null;

    try {
      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transferPayload),
      });

      const contentType = transferRes.headers.get("content-type");
      let transferResult: any;

      if (contentType && contentType.includes("application/json")) {
        transferResult = await transferRes.json();
      } else {
        const textBody = await transferRes.text();
        console.error(`[CREATE-PAYOUT] Non-JSON response from Paystack. Status: ${transferRes.status}, Content-Type: ${contentType}, Body: ${textBody.substring(0, 200)}`);
        transferError = `Paystack API error (HTTP ${transferRes.status}): Invalid response format`;
      }

      if (transferResult) {
        console.log(`[CREATE-PAYOUT] Paystack transfer response:`, JSON.stringify(transferResult));

        if (transferResult.status && transferResult.data) {
          transferSuccess = true;
          transferData = transferResult.data;
        } else {
          transferError = transferResult.message || "Transfer initiation failed";
          console.error(`[CREATE-PAYOUT] Transfer failed:`, transferError);
        }
      }
    } catch (err) {
      transferError = (err as Error).message;
      console.error(`[CREATE-PAYOUT] Transfer error:`, transferError);
    }

    // =============================================
    // STEP 6: Handle transfer result
    // =============================================
    if (transferSuccess && transferData) {
      const now = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from("payout_requests")
        .update({
          status: "success",
          transfer_code: transferData.transfer_code,
          paystack_reference: transferReference,
          paystack_response: transferData,
          source_balance_after: balanceAfter,
          completed_at: now,
        })
        .eq("id", payoutId);

      if (updateError) {
        console.error(`[CREATE-PAYOUT] Failed to update payout request:`, updateError.message);
      }

      // Update last_withdrawal_at for 24-hour cooldown
      if (requester_type === "agent") {
        const { error: cooldownError } = await supabase
          .from("agent_stores")
          .update({ last_withdrawal_at: now })
          .eq("id", requester_id);
        if (cooldownError) console.error(`[CREATE-PAYOUT] Failed to set cooldown:`, cooldownError.message);
      } else {
        const { error: cooldownError } = await supabase
          .from("subagent_stores")
          .update({ last_withdrawal_at: now })
          .eq("id", requester_id);
        if (cooldownError) console.error(`[CREATE-PAYOUT] Failed to set cooldown:`, cooldownError.message);
      }

      console.log(`[CREATE-PAYOUT] Transfer successful: ${transferData.transfer_code}`);

      return new Response(JSON.stringify({
        success: true,
        payout_request_id: payoutId,
        status: "success",
        transfer_code: transferData.transfer_code,
        amount: amount,
        balance_before: currentBalance,
        balance_after: balanceAfter,
        message: "Payout completed successfully",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      // Transfer failed - REFUND the wallet
      console.log(`[CREATE-PAYOUT] Transfer failed - REFUNDING wallet...`);

      let refundSuccess = false;

      if (requester_type === "agent") {
        if (withdrawal_source === "wallet_balance") {
          const { error: refundError } = await supabase
            .from("agent_stores")
            .update({ wallet_balance: currentBalance })
            .eq("id", requester_id);
          if (!refundError) refundSuccess = true;
        } else {
          const { error: refundError } = await supabase
            .from("agent_stores")
            .update({ subagent_commission_balance: currentBalance })
            .eq("id", requester_id);
          if (!refundError) refundSuccess = true;
        }
      } else {
        const { error: refundError } = await supabase
          .from("subagent_stores")
          .update({ wallet_balance: currentBalance })
          .eq("id", requester_id);
        if (!refundError) refundSuccess = true;
      }

      await supabase
        .from("payout_requests")
        .update({
          status: "failed",
          source_balance_after: refundSuccess ? currentBalance : balanceAfter,
          paystack_response: { error: transferError },
          failure_reason: transferError,
          completed_at: new Date().toISOString(),
        })
        .eq("id", payoutId);

      if (refundSuccess) {
        console.log(`[CREATE-PAYOUT] Wallet refunded successfully: ${currentBalance}`);
      } else {
        console.error(`[CREATE-PAYOUT] CRITICAL: Wallet refund failed! Manual intervention required.`);
      }

      return new Response(JSON.stringify({
        success: false,
        error: "Transfer failed. Your wallet has been refunded.",
        payout_request_id: payoutId,
        status: "failed",
        failure_reason: transferError,
        wallet_restored: refundSuccess,
        balance: refundSuccess ? currentBalance : balanceAfter,
        message: refundSuccess ? "Wallet refunded. Please try again later." : "CRITICAL: Wallet refund failed. Contact support.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error(`[CREATE-PAYOUT] Unexpected error:`, err);
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
