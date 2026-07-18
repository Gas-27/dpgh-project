import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS so we can read/write any row.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      requester_type,
      requester_id,       // auth user_id for agents; store uuid for subagents
      withdrawal_source: rawSource,
      amount,
      recipient_id,
      recipient_details,
    } = req.body;

    // ── Validate required fields ───────────────────────────────────────────
    if (!requester_type || !requester_id || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    if (!recipient_id && !recipient_details) {
      return res.status(400).json({ success: false, error: "Provide either recipient_id or recipient_details" });
    }
    if (amount <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be greater than zero" });
    }

    // ── Authenticate caller ────────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: "Unauthorized" });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ success: false, error: "Unauthorized" });

    // Is the caller an admin?
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ success: false, error: "Payment service not configured" });
    }

    // ── STEP 1: Look up store and validate balance ─────────────────────────
    let storeId: string;         // agent_stores.id (PK) — used for all DB ops
    let currentBalance = 0;
    let withdrawal_source: string;

    if (requester_type === "agent") {
      // requester_id is always the auth user_id — look up the store by user_id.
      const { data: store, error: storeErr } = await supabase
        .from("agent_stores")
        .select("id, user_id, wallet_balance, subagent_commission_balance, last_withdrawal_at")
        .eq("user_id", requester_id)
        .maybeSingle();

      if (storeErr || !store) {
        return res.status(404).json({ success: false, error: "Agent store not found" });
      }

      // Authorization: must be the store owner or an admin.
      if (store.user_id !== user.id && !isAdmin) {
        return res.status(403).json({ success: false, error: "Not authorized for this store" });
      }

      storeId = store.id;

      // Normalise withdrawal_source (accept both short and long forms).
      if (rawSource === "wallet_balance" || rawSource === "wallet") {
        withdrawal_source = "wallet_balance";
        currentBalance = Number(store.wallet_balance ?? 0);
      } else if (rawSource === "subagent_commission_balance" || rawSource === "subagent_commission") {
        withdrawal_source = "subagent_commission_balance";
        currentBalance = Number(store.subagent_commission_balance ?? 0);
      } else {
        return res.status(400).json({ success: false, error: "Invalid withdrawal_source for agent" });
      }

      // Check balance.
      if (amount > currentBalance) {
        return res.status(400).json({
          success: false,
          error: `Insufficient balance. Available: GHS ${currentBalance.toFixed(2)}`,
        });
      }

      // 24-hour cooldown.
      if (store.last_withdrawal_at) {
        const elapsed = Date.now() - new Date(store.last_withdrawal_at).getTime();
        const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
        if (elapsed < TWENTY_FOUR_H) {
          const remaining = TWENTY_FOUR_H - elapsed;
          const h = Math.ceil(remaining / 3600000);
          const m = Math.ceil((remaining % 3600000) / 60000);
          return res.status(429).json({
            success: false,
            error: `Withdrawal cooldown active. Try again in ${h}h ${m}m`,
            cooldown_remaining_ms: remaining,
          });
        }
      }
    } else if (requester_type === "subagent") {
      const { data: store, error: storeErr } = await supabase
        .from("subagent_stores")
        .select("id, user_id, wallet_balance, last_withdrawal_at")
        .eq("id", requester_id)
        .maybeSingle();

      if (storeErr || !store) {
        return res.status(404).json({ success: false, error: "Subagent store not found" });
      }

      if (store.user_id !== user.id && !isAdmin) {
        return res.status(403).json({ success: false, error: "Not authorized for this store" });
      }

      storeId = store.id;
      withdrawal_source = "wallet_balance";
      currentBalance = Number(store.wallet_balance ?? 0);

      if (amount > currentBalance) {
        return res.status(400).json({
          success: false,
          error: `Insufficient balance. Available: GHS ${currentBalance.toFixed(2)}`,
        });
      }
    } else {
      return res.status(400).json({ success: false, error: "Invalid requester_type" });
    }

    // ── STEP 2: Resolve recipient ──────────────────────────────────────────
    let recipientDbId: string | null = null;
    let recipientCode: string | null = null;

    if (recipient_id) {
      // recipient_id is the recipient_code string from transfer_recipients.
      const { data: rec, error: recErr } = await supabase
        .from("transfer_recipients")
        .select("id, recipient_code")
        .eq("recipient_code", recipient_id)
        .maybeSingle();

      if (recErr || !rec) {
        return res.status(404).json({ success: false, error: "Recipient not found" });
      }

      recipientDbId = rec.id;
      recipientCode = rec.recipient_code;
    } else if (recipient_details) {
      // Create a new Paystack recipient then save it.
      const bankCodeMapping: Record<string, string> = {
        mtn: "MTN", telecel: "VOD", vodafone: "VOD", airteltigo: "ATL",
      };

      const paystackPayload =
        recipient_details.provider_type === "bank"
          ? {
              type: "nuban",
              name: recipient_details.account_holder_name,
              account_number: recipient_details.account_number,
              bank_code: recipient_details.bank_code,
              currency: "GHS",
            }
          : {
              type: "mobile_money",
              name: recipient_details.account_holder_name,
              account_number: recipient_details.mobile_money_number,
              bank_code: bankCodeMapping[recipient_details.mobile_money_network] || "MTN",
              currency: "GHS",
            };

      const psRecRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(paystackPayload),
      });
      const psRecJson = await psRecRes.json();
      if (!psRecJson.status) {
        return res.status(400).json({ success: false, error: `Failed to create recipient: ${psRecJson.message}` });
      }
      recipientCode = psRecJson.data.recipient_code;

      const { data: newRec, error: insertErr } = await supabase
        .from("transfer_recipients")
        .insert({
          user_id: requester_id,
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

      if (insertErr || !newRec) {
        return res.status(500).json({ success: false, error: "Failed to save recipient" });
      }
      recipientDbId = newRec.id;
    }

    if (!recipientCode) {
      return res.status(500).json({ success: false, error: "No recipient code available" });
    }

    // ── STEP 3: Create payout_requests record ─────────────────────────────
    const { data: payoutRow, error: payoutErr } = await supabase
      .from("payout_requests")
      .insert({
        requester_type,
        requester_id: storeId,          // store PK (not user_id)
        recipient_id: recipientDbId,
        amount,
        withdrawal_source,
        source_balance_before: currentBalance,
        status: "processing",
      })
      .select("id")
      .single();

    if (payoutErr || !payoutRow) {
      return res.status(500).json({ success: false, error: "Failed to create payout request" });
    }
    const payoutId = payoutRow.id;

    // ── STEP 4: Deduct balance — use storeId (the agent_stores PK) ────────
    const balanceAfter = currentBalance - amount;

    const deductColumn =
      withdrawal_source === "subagent_commission_balance"
        ? "subagent_commission_balance"
        : "wallet_balance";

    const table = requester_type === "agent" ? "agent_stores" : "subagent_stores";

    const { error: deductErr } = await supabase
      .from(table)
      .update({ [deductColumn]: balanceAfter })
      .eq("id", storeId);   // ← always use the PK, never the user_id

    if (deductErr) {
      // Roll back the payout record.
      await supabase.from("payout_requests").delete().eq("id", payoutId);
      return res.status(500).json({ success: false, error: "Failed to process withdrawal" });
    }

    // ── STEP 5: Initiate Paystack Transfer ────────────────────────────────
    const transferReference = `PAYOUT_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(amount * 100),   // pesewas
        recipient: recipientCode,
        reference: transferReference,
        reason: `Payout for ${requester_type} ${storeId}`,
      }),
    });
    const transferJson = await transferRes.json();
    const transferSuccess = transferJson.status && transferJson.data;

    const now = new Date().toISOString();

    if (transferSuccess) {
      // ── STEP 6a: Transfer succeeded ──────────────────────────────────
      await supabase
        .from("payout_requests")
        .update({
          status: "success",
          transfer_code: transferJson.data.transfer_code,
          paystack_reference: transferReference,
          paystack_response: transferJson.data,
          source_balance_after: balanceAfter,
          completed_at: now,
        })
        .eq("id", payoutId);

      // Set 24-hour cooldown.
      await supabase
        .from(table)
        .update({ last_withdrawal_at: now })
        .eq("id", storeId);

      return res.status(200).json({
        success: true,
        payout_request_id: payoutId,
        status: "success",
        transfer_code: transferJson.data.transfer_code,
        amount,
        balance_before: currentBalance,
        balance_after: balanceAfter,
        message: "Payout completed successfully",
      });
    } else {
      // ── STEP 6b: Transfer failed — refund the balance ─────────────
      const { error: refundErr } = await supabase
        .from(table)
        .update({ [deductColumn]: currentBalance })
        .eq("id", storeId);

      await supabase
        .from("payout_requests")
        .update({
          status: "failed",
          source_balance_after: refundErr ? balanceAfter : currentBalance,
          paystack_response: { error: transferJson.message },
          failure_reason: transferJson.message,
          completed_at: now,
        })
        .eq("id", payoutId);

      return res.status(400).json({
        success: false,
        error: "Transfer failed. Your wallet has been refunded.",
        payout_request_id: payoutId,
        status: "failed",
        wallet_restored: !refundErr,
      });
    }
  } catch (err: any) {
    console.error("[CREATE-PAYOUT] Unexpected error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
