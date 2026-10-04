import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const PAYOUT_API = "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request";

export interface TransferRecipient {
  id: string;
  recipient_code: string;
  account_holder_name: string;
  provider_type: "bank" | "mobile_money";
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  mobile_money_network?: string;
  mobile_money_number?: string;
  status: "active" | "inactive";
  created_at: string;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  status: "processing" | "success" | "failed";
  transfer_code?: string;
  withdrawal_source: string;
  source_balance_before: number;
  source_balance_after: number;
  failure_reason?: string;
  created_at: string;
  completed_at?: string;
  transfer_recipients: TransferRecipient;
}

export interface Balance {
  wallet_balance: number;
  subagent_commission_balance?: number;
}

// Get agent balance
export async function getAgentBalance(agentStoreId: string): Promise<Balance> {
  const { data, error } = await supabase
    .from("agent_stores")
    .select("wallet_balance, subagent_commission_balance")
    .eq("id", agentStoreId)
    .single();

  if (error || !data) {
    throw new Error("Failed to fetch agent balance");
  }

  return {
    wallet_balance: Number(data.wallet_balance) || 0,
    subagent_commission_balance: Number(data.subagent_commission_balance) || 0,
  };
}

// Get subagent balance
export async function getSubagentBalance(subagentStoreId: string): Promise<Balance> {
  const { data, error } = await supabase
    .from("subagent_stores")
    .select("wallet_balance")
    .eq("id", subagentStoreId)
    .single();

  if (error || !data) {
    throw new Error("Failed to fetch subagent balance");
  }

  return {
    wallet_balance: Number(data.wallet_balance) || 0,
  };
}

// Get transfer recipients
export async function getTransferRecipients(): Promise<TransferRecipient[]> {
  const { data, error } = await supabase
    .from("transfer_recipients")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to fetch recipients");
  }

  return data || [];
}

// Get payout history
export async function getPayoutHistory(requesterType: string, requesterId: string): Promise<PayoutRequest[]> {
  const { data, error } = await supabase
    .from("payout_requests")
    .select(`
      id,
      amount,
      status,
      transfer_code,
      withdrawal_source,
      source_balance_before,
      source_balance_after,
      failure_reason,
      created_at,
      completed_at,
      transfer_recipients (
        id,
        account_holder_name,
        provider_type,
        bank_name,
        account_number,
        mobile_money_network,
        mobile_money_number
      )
    `)
    .eq("requester_type", requesterType)
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to fetch payout history");
  }

  return data || [];
}

// Create payout request
export async function createPayoutRequest(
  token: string,
  payload: {
    requester_type: "agent" | "subagent";
    requester_id: string;
    withdrawal_source: string;
    amount: number;
    recipient_id?: string;
    recipient_details?: {
      account_holder_name: string;
      provider_type: "bank" | "mobile_money";
      bank_name?: string;
      bank_code?: string;
      account_number?: string;
      mobile_money_network?: string;
      mobile_money_number?: string;
    };
  }
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(PAYOUT_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const raw = await response.text();
    let result: any = {};
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      result = { error: raw || `Payout request failed (${response.status})` };
    }

    if (!response.ok) {
      throw new Error(result.error || result.message || `Payout request failed (${response.status})`);
    }

    if (result.success === false) {
      throw new Error(result.error || result.message || "Payout request failed");
    }

    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The transfer request timed out. Please check payout history before trying again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

// Deactivate recipient
export async function deactivateRecipient(recipientId: string) {
  const { error } = await supabase
    .from("transfer_recipients")
    .update({ status: "inactive" })
    .eq("id", recipientId);

  if (error) {
    throw new Error("Failed to deactivate recipient");
  }
}
