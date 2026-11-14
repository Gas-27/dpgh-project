// supabase/functions/create-payout-request/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// SECURITY: after a network error the transfer may still have reached Paystack. Ask Paystack before refunding,
// so a timeout can never pay the money out AND put it back in the wallet.
// Returns "sent" (transfer exists), "not_found" (safe to refund) or "unknown" (hold for admin review).
async function transferStatus(secret: string, reference: string): Promise<{ state: "sent" | "not_found" | "unknown"; data?: any }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.paystack.co/transfer/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.status && body?.data) {
        const s = String(body.data.status || "").toLowerCase();
        if (["failed", "reversed", "abandoned", "rejected"].includes(s)) return { state: "not_found" };
        return { state: "sent", data: body.data };
      }
      if (res.status === 404 || (res.status === 400 && /not found/i.test(String(body?.message || "")))) return { state: "not_found" };
    } catch (_e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return { state: "unknown" };
}

const PAUSE_PREFIX = "WITHDRAWALS_PAUSED:";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { requester_type, requester_id, withdrawal_source: initialWithdrawalSource, amount, recipient_id, recipient_details } = await req.json();
    let withdrawal_source = initialWithdrawalSource;
    console.log(`[CREATE-PAYOUT] Request: ${requester_type} ${requester_id}, amount: ${amount}`);

    if (!requester_type || !requester_id || !amount) {
      return json({ success: false, error: "Missing required fields: requester_type, requester_id, amount" }, 400);
    }
    if (!["agent", "subagent", "sub_subagent"].includes(requester_type)) {
      return json({ success: false, error: "Invalid requester_type" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // STEP 0: Admin withdrawal pause. Checked before anything else happens, and fails CLOSED:
    // if the setting can't be read, the withdrawal is refused rather than allowed.
    const { data: pauseMessage, error: pauseError } = await supabase.rpc("withdrawal_pause_message", { p_type: requester_type });
    if (pauseError) {
      console.error(`[CREATE-PAYOUT] Pause check failed:`, pauseError.message);
      return json({ success: false, paused: true, error: "Withdrawals are temporarily unavailable. Please try again shortly." }, 503);
    }
    if (pauseMessage) {
      console.log(`[CREATE-PAYOUT] Blocked: withdrawals paused for ${requester_type}`);
      return json({ success: false, paused: true, error: String(pauseMessage), message: String(pauseMessage) }, 403);
    }

    if (!recipient_id && !recipient_details) {
      return json({ success: false, error: "Provide either recipient_id or recipient_details" }, 400);
    }

    const grossAmount = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      return json({ success: false, error: "Amount must be greater than zero" }, 400);
    }
    const feeRate = grossAmount < 100 ? 0.05 : 0.015;
    const feeAmount = Math.round(grossAmount * feeRate * 100) / 100;
    const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error(`[CREATE-PAYOUT] Auth error:`, userError?.message);
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    // STEP 1: Validate requester and check balance (a quick check; the real check is the atomic debit below)
    let currentBalance = 0;
    if (requester_type === "agent") {
      const { data, error } = await supabase.from("agent_stores").select("id, wallet_balance, subagent_commission_balance").eq("id", requester_id).eq("user_id", user.id).single();
      if (error || !data) return json({ success: false, error: "Agent store not found" }, 404);
      if (withdrawal_source === "wallet_balance") currentBalance = Number(data.wallet_balance);
      else if (withdrawal_source === "subagent_commission_balance") currentBalance = Number(data.subagent_commission_balance);
      else return json({ success: false, error: "Invalid withdrawal_source for agent" }, 400);
    } else if (requester_type === "subagent") {
      const { data, error } = await supabase.from("subagent_stores").select("id, wallet_balance").eq("id", requester_id).eq("user_id", user.id).single();
      if (error || !data) return json({ success: false, error: "Subagent store not found" }, 404);
      withdrawal_source = "wallet_balance";
      currentBalance = Number(data.wallet_balance);
    } else if (requester_type === "sub_subagent") {
      const { data, error } = await supabase.from("sub_subagent_stores").select("id, wallet_balance").eq("id", requester_id).eq("user_id", user.id).single();
      if (error || !data) return json({ success: false, error: "Sub-subagent store not found" }, 404);
      withdrawal_source = "wallet_balance";
      currentBalance = Number(data.wallet_balance);
    } else {
      return json({ success: false, error: "Invalid requester_type" }, 400);
    }

    if (currentBalance < grossAmount) {
      return json({ success: false, error: `Insufficient balance. Available: GHS ${currentBalance}` }, 400);
    }

    // STEP 2: Get or create transfer recipient
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ success: false, error: "Payment service not configured" }, 500);

    let recipientId = recipient_id;
    let recipientCode = null;

    if (recipientId) {
      const { data: recipient, error: recipientError } = await supabase.from("transfer_recipients").select("id, recipient_code").eq("id", recipientId).eq("user_id", user.id).maybeSingle();
      if (recipientError || !recipient) return json({ success: false, error: "Recipient not found" }, 404);
      recipientCode = recipient.recipient_code;
      recipientId = recipient.id;
    }

    if (recipient_details && !recipientId) {
      const { count, error: countError } = await supabase.from("transfer_recipients").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active");
      if (!countError && count && count >= 2) {
        return json({ success: false, error: "Maximum 2 active recipients allowed. Please deactivate one before adding another." }, 400);
      }
      // deno-lint-ignore no-explicit-any
      let paystackPayload: any = {};
      if (recipient_details.provider_type === "bank") {
        paystackPayload = { type: "nuban", name: recipient_details.account_holder_name, account_number: recipient_details.account_number, bank_code: recipient_details.bank_code, currency: "GHS" };
      } else {
        const bankCodeMapping: Record<string, string> = { mtn: "MTN", telecel: "VOD", airteltigo: "ATL" };
        const bankCode = bankCodeMapping[recipient_details.mobile_money_network] || "MTN";
        paystackPayload = { type: "mobile_money", name: recipient_details.account_holder_name, account_number: recipient_details.mobile_money_number, bank_code: bankCode, currency: "GHS" };
      }
      const paystackRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(paystackPayload),
      });
      const paystackResult = await paystackRes.json();
      if (!paystackResult.status) {
        console.error(`[CREATE-PAYOUT] Paystack error:`, paystackResult);
        return json({ success: false, error: `Failed to create recipient: ${paystackResult.message}` }, 400);
      }
      recipientCode = paystackResult.data.recipient_code;
      const { data: newRecipient, error: insertError } = await supabase.from("transfer_recipients").insert({
        user_id: user.id,
        recipient_code: recipientCode,
        account_holder_name: recipient_details.account_holder_name,
        provider_type: recipient_details.provider_type,
        bank_name: recipient_details.bank_name || null,
        bank_code: recipient_details.bank_code || null,
        account_number: recipient_details.account_number || null,
        mobile_money_network: recipient_details.mobile_money_network || null,
        mobile_money_number: recipient_details.mobile_money_number || null,
      }).select("id").single();
      if (insertError) return json({ success: false, error: "Failed to save recipient" }, 500);
      recipientId = newRecipient.id;
    }

    if (!recipientCode) return json({ success: false, error: "No recipient code available" }, 500);

    // STEP 3: Take the money out of the wallet in ONE atomic step. If two withdrawals arrive at the
    // same moment, only one can succeed: the database refuses the second if the balance is too low.
    // The database also refuses (and takes nothing) if an admin paused withdrawals in the meantime.
    const { data: balanceAfterRaw, error: debitError } = await supabase.rpc("payout_debit_wallet", {
      p_type: requester_type,
      p_store_id: requester_id,
      p_user: user.id,
      p_source: withdrawal_source,
      p_amount: grossAmount,
    });
    if (debitError) {
      const msg = String(debitError.message || "");
      if (msg.startsWith(PAUSE_PREFIX)) {
        const adminMsg = msg.slice(PAUSE_PREFIX.length).trim();
        return json({ success: false, paused: true, error: adminMsg, message: adminMsg }, 403);
      }
      console.error(`[CREATE-PAYOUT] Debit failed:`, msg);
      return json({ success: false, error: "Failed to process withdrawal" }, 500);
    }
    if (balanceAfterRaw === null || balanceAfterRaw === undefined) {
      return json({ success: false, error: "Insufficient balance. Refresh and try again." }, 400);
    }
    const balanceAfter = Number(balanceAfterRaw);
    const balanceBefore = Math.round((balanceAfter + grossAmount) * 100) / 100;

    // STEP 4: Record the payout request (wallet already debited)
    const { data: payoutRequest, error: payoutError } = await supabase.from("payout_requests").insert({
      requester_type,
      requester_id,
      recipient_id: recipientId,
      amount: grossAmount,
      withdrawal_source,
      source_balance_before: balanceBefore,
      source_balance_after: balanceAfter,
      status: "processing",
    }).select("id").single();

    if (payoutError) {
      console.error(`[CREATE-PAYOUT] Failed to create payout request:`, payoutError.message);
      await supabase.rpc("payout_refund_wallet", { p_type: requester_type, p_store_id: requester_id, p_source: withdrawal_source, p_amount: grossAmount });
      const blocked = /fraudulent activity|blocked from using|on hold/i.test(payoutError.message || "");
      return json({ success: false, error: blocked ? payoutError.message : "Failed to create payout request" }, blocked ? 403 : 500);
    }
    const payoutId = payoutRequest.id;

    // STEP 5: Initiate Paystack Transfer
    const transferReference = `PAYOUT_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const amountInPesewas = Math.round(netAmount * 100);
    const transferPayload = { source: "balance", amount: amountInPesewas, recipient: recipientCode, reference: transferReference, reason: `Payout for ${requester_type} ${requester_id}` };

    // Save the reference first so a timed-out transfer can always be traced.
    await supabase.from("payout_requests").update({ paystack_reference: transferReference }).eq("id", payoutId);

    let transferSuccess = false;
    let transferError: string | null = null;
    let networkFailure = false;
    // deno-lint-ignore no-explicit-any
    let transferData: any = null;
    try {
      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(transferPayload),
      });
      const transferResult = await transferRes.json();
      console.log(`[CREATE-PAYOUT] Paystack transfer response:`, JSON.stringify(transferResult));
      if (transferResult.status && transferResult.data) {
        transferSuccess = true;
        transferData = transferResult.data;
      } else {
        transferError = transferResult.message || "Transfer initiation failed";
        if (transferRes.status >= 500) networkFailure = true;
      }
    } catch (err) {
      transferError = (err as Error).message;
      networkFailure = true;
    }

    // SECURITY: the request may have reached Paystack even though we got no clear answer.
    if (!transferSuccess && networkFailure) {
      const check = await transferStatus(PAYSTACK_SECRET_KEY, transferReference);
      if (check.state === "sent") {
        transferSuccess = true;
        transferData = check.data;
        console.warn(`[CREATE-PAYOUT] Transfer ${transferReference} went through despite a network error; not refunding.`);
      } else if (check.state === "unknown") {
        await supabase.from("payout_requests").update({
          status: "processing",
          failure_reason: `Paystack did not answer clearly (${transferError}); held for admin review before any refund.`,
          paystack_response: { error: transferError, held_for_review: true },
        }).eq("id", payoutId);
        console.error(`[CREATE-PAYOUT] Transfer ${transferReference} status unknown; held for review.`);
        return json({
          success: false,
          status: "processing",
          payout_request_id: payoutId,
          message: "Your withdrawal is being confirmed with the payment provider. If it does not arrive, support will refund your wallet.",
        }, 202);
      }
    }

    // STEP 6: Handle transfer result
    if (transferSuccess && transferData) {
      await supabase.from("payout_requests").update({
        status: "success",
        transfer_code: transferData.transfer_code,
        paystack_reference: transferReference,
        paystack_response: transferData,
        completed_at: new Date().toISOString(),
      }).eq("id", payoutId);

      return json({
        success: true,
        payout_request_id: payoutId,
        status: "success",
        transfer_code: transferData.transfer_code,
        amount: grossAmount,
        gross_amount: grossAmount,
        fee_amount: feeAmount,
        net_amount: netAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        message: "Payout completed successfully",
      });
    }

    // Transfer definitely failed: give the money back by ADDING it, so nothing that happened in between is lost.
    const { data: restored, error: refundError } = await supabase.rpc("payout_refund_wallet", {
      p_type: requester_type, p_store_id: requester_id, p_source: withdrawal_source, p_amount: grossAmount,
    });
    const refundSuccess = !refundError && restored !== null && restored !== undefined;
    if (!refundSuccess) console.error(`[CREATE-PAYOUT] CRITICAL: Wallet refund failed! Manual intervention required.`, refundError?.message);

    await supabase.from("payout_requests").update({
      status: "failed",
      source_balance_after: refundSuccess ? Number(restored) : balanceAfter,
      paystack_response: { error: transferError },
      failure_reason: transferError,
      completed_at: new Date().toISOString(),
    }).eq("id", payoutId);

    return json({
      success: false,
      error: "Transfer failed. Your wallet has been refunded.",
      payout_request_id: payoutId,
      status: "failed",
      failure_reason: transferError,
      wallet_restored: refundSuccess,
      balance: refundSuccess ? Number(restored) : balanceAfter,
      message: refundSuccess ? "Wallet refunded. Please try again later." : "CRITICAL: Wallet refund failed. Contact support.",
    }, 400);
  } catch (err) {
    console.error(`[CREATE-PAYOUT] Unexpected error:`, err);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});
