import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || "",
  process.env.REACT_APP_SUPABASE_ANON_KEY || ""
);

const EDGE_FUNCTION_URL =
  "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request";

export interface TransferRecipient {
  id: string;
  recipient_name: string;
  recipient_type: "bank" | "momo";
  bank_code?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  momo_network?: string;
  momo_number?: string;
  paystack_recipient_code: string;
  is_active: boolean;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  transfer_code: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
  recipient_id: string;
  error_message?: string;
}

/**
 * Fetch all active recipients for an agent
 */
export async function fetchAgentRecipients(agentStoreId: string): Promise<TransferRecipient[]> {
  const { data, error } = await supabase
    .from("transfer_recipients")
    .select("*")
    .eq("agent_store_id", agentStoreId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch all active recipients for a subagent
 */
export async function fetchSubagentRecipients(subagentStoreId: string): Promise<TransferRecipient[]> {
  const { data, error } = await supabase
    .from("transfer_recipients")
    .select("*")
    .eq("subagent_store_id", subagentStoreId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Add a new recipient for agent
 */
export async function addAgentRecipient(
  agentStoreId: string,
  recipient: Omit<TransferRecipient, "id" | "is_active">
): Promise<TransferRecipient> {
  const { data, error } = await supabase
    .from("transfer_recipients")
    .insert({
      agent_store_id: agentStoreId,
      ...recipient,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Add a new recipient for subagent
 */
export async function addSubagentRecipient(
  subagentStoreId: string,
  recipient: Omit<TransferRecipient, "id" | "is_active">
): Promise<TransferRecipient> {
  const { data, error } = await supabase
    .from("transfer_recipients")
    .insert({
      subagent_store_id: subagentStoreId,
      ...recipient,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Deactivate a recipient
 */
export async function deactivateRecipient(recipientId: string): Promise<void> {
  const { error } = await supabase
    .from("transfer_recipients")
    .update({ is_active: false })
    .eq("id", recipientId);

  if (error) throw error;
}

/**
 * Create a withdrawal/payout request for agent
 */
export async function createAgentPayoutRequest(
  agentStoreId: string,
  amount: number,
  recipientId: string,
  withdrawalSource: "wallet" | "subagent_commission" = "wallet"
): Promise<PayoutRequest> {
  // Fetch recipient to get paystack code
  const { data: recipient, error: recipientError } = await supabase
    .from("transfer_recipients")
    .select("paystack_recipient_code")
    .eq("id", recipientId)
    .single();

  if (recipientError) throw recipientError;
  if (!recipient) throw new Error("Recipient not found");

  // Call edge function
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      transfer_recipient_id: recipient.paystack_recipient_code,
      agent_store_id: agentStoreId,
      subagent_store_id: null,
      withdrawal_source: withdrawalSource,
      recipient_id: recipientId,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Payout request failed");
  }

  // Create payout request record
  const { data: payoutRequest, error: payoutError } = await supabase
    .from("payout_requests")
    .insert({
      agent_store_id: agentStoreId,
      amount,
      recipient_id: recipientId,
      withdrawal_source: withdrawalSource,
      transfer_code: result.transfer_code,
      paystack_transfer_id: result.transfer_id,
      paystack_recipient_code: recipient.paystack_recipient_code,
      status: "pending",
    })
    .select()
    .single();

  if (payoutError) throw payoutError;

  // Deduct balance
  if (withdrawalSource === "subagent_commission") {
    const { data: store } = await supabase
      .from("agent_stores")
      .select("subagent_commission_balance")
      .eq("id", agentStoreId)
      .single();

    if (store) {
      const newBalance = (store.subagent_commission_balance || 0) - amount;
      await supabase
        .from("agent_stores")
        .update({ subagent_commission_balance: newBalance })
        .eq("id", agentStoreId);
    }
  } else {
    const { data: store } = await supabase
      .from("agent_stores")
      .select("wallet_balance")
      .eq("id", agentStoreId)
      .single();

    if (store) {
      const newBalance = (store.wallet_balance || 0) - amount;
      await supabase
        .from("agent_stores")
        .update({ wallet_balance: newBalance })
        .eq("id", agentStoreId);
    }
  }

  return payoutRequest;
}

/**
 * Create a withdrawal/payout request for subagent
 */
export async function createSubagentPayoutRequest(
  subagentStoreId: string,
  amount: number,
  recipientId: string
): Promise<PayoutRequest> {
  // Fetch recipient
  const { data: recipient, error: recipientError } = await supabase
    .from("transfer_recipients")
    .select("paystack_recipient_code")
    .eq("id", recipientId)
    .single();

  if (recipientError) throw recipientError;
  if (!recipient) throw new Error("Recipient not found");

  // Call edge function
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      transfer_recipient_id: recipient.paystack_recipient_code,
      agent_store_id: null,
      subagent_store_id: subagentStoreId,
      withdrawal_source: "wallet",
      recipient_id: recipientId,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Payout request failed");
  }

  // Create payout request record
  const { data: payoutRequest, error: payoutError } = await supabase
    .from("payout_requests")
    .insert({
      subagent_store_id: subagentStoreId,
      amount,
      recipient_id: recipientId,
      withdrawal_source: "wallet",
      transfer_code: result.transfer_code,
      paystack_transfer_id: result.transfer_id,
      paystack_recipient_code: recipient.paystack_recipient_code,
      status: "pending",
    })
    .select()
    .single();

  if (payoutError) throw payoutError;

  // Deduct balance
  const { data: store } = await supabase
    .from("subagent_stores")
    .select("wallet_balance")
    .eq("id", subagentStoreId)
    .single();

  if (store) {
    const newBalance = (store.wallet_balance || 0) - amount;
    await supabase
      .from("subagent_stores")
      .update({ wallet_balance: newBalance })
      .eq("id", subagentStoreId);
  }

  return payoutRequest;
}

/**
 * Fetch payout history for agent
 */
export async function fetchAgentPayoutHistory(agentStoreId: string): Promise<PayoutRequest[]> {
  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("agent_store_id", agentStoreId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch payout history for subagent
 */
export async function fetchSubagentPayoutHistory(subagentStoreId: string): Promise<PayoutRequest[]> {
  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("subagent_store_id", subagentStoreId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get status of a payout request
 */
export async function getPayoutStatus(payoutRequestId: string): Promise<PayoutRequest | null> {
  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("id", payoutRequestId)
    .single();

  if (error) return null;
  return data;
}
