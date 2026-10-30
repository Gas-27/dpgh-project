import { supabase } from "@/integrations/supabase/client";

export type WalletOwnerType = "customer" | "agent" | "subagent" | "subsubagent";
export type WalletCreditTarget = "agent" | "agent_commission" | "subagent";
export type AdminWalletOwnerType = WalletOwnerType | "agent_commission";

export type DebitKind =
  | "data_purchase"
  | "bulk_data_purchase"
  | "airtime_purchase"
  | "product_post"
  | "product_plan"
  | "product_boost"
  | "wallet_purchase";

export type WalletResult = { ledgerId: string; balanceAfter: number };

function toResult(data: any): WalletResult {
  return { ledgerId: String(data?.ledger_id), balanceAfter: Number(data?.balance_after) };
}

function fail(error: { message?: string } | null | undefined, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export function newOrderId(): string {
  return crypto.randomUUID();
}

// Spend from the signed-in user's own wallet. The server checks ownership and the balance.
export async function debitOwnWallet(args: {
  ownerType: WalletOwnerType;
  ownerId: string;
  amount: number;
  kind: DebitKind;
  reference?: string;
  note?: string;
}): Promise<WalletResult> {
  const { data, error } = await (supabase as any).rpc("wallet_debit_own", {
    p_owner_type: args.ownerType,
    p_owner_id: args.ownerId,
    p_amount: args.amount,
    p_kind: args.kind,
    p_reference: args.reference ?? null,
    p_note: args.note ?? null,
  });
  if (error) fail(error, "Wallet payment failed");
  return toResult(data);
}

// Give the money back when the order a debit was meant for was never created.
export async function refundFailedOrder(orderId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("wallet_refund_failed_order", { p_order_id: orderId });
  if (error) console.error("[wallet] refund of failed order did not complete:", error.message);
}

export async function transferToChild(args: {
  fromType: WalletOwnerType;
  fromId: string;
  toType: WalletOwnerType;
  toId: string;
  amount: number;
  reference?: string;
  note?: string;
}): Promise<WalletResult> {
  const { data, error } = await (supabase as any).rpc("wallet_transfer_to_child", {
    p_from_type: args.fromType,
    p_from_id: args.fromId,
    p_to_type: args.toType,
    p_to_id: args.toId,
    p_amount: args.amount,
    p_reference: args.reference ?? null,
    p_note: args.note ?? null,
  });
  if (error) fail(error, "Transfer failed");
  return toResult(data);
}

// Upline commission can only be paid out of a purchase the caller just made.
export async function creditUpline(args: {
  debitLedgerId: string;
  targetType: WalletCreditTarget;
  targetId: string;
  amount: number;
}): Promise<void> {
  const { error } = await (supabase as any).rpc("wallet_credit_upline", {
    p_debit_ledger_id: args.debitLedgerId,
    p_target_type: args.targetType,
    p_target_id: args.targetId,
    p_amount: args.amount,
  });
  if (error) console.error("[wallet] commission credit failed:", error.message);
}

// Admin only. Positive delta credits the wallet, negative debits it. Every call is ledgered.
export async function adminAdjustWallet(args: {
  ownerType: AdminWalletOwnerType;
  ownerId: string;
  delta: number;
  kind: string;
  reference?: string;
  note?: string;
}): Promise<{ balanceBefore: number; balanceAfter: number }> {
  const { data, error } = await (supabase as any).rpc("admin_wallet_adjust", {
    p_owner_type: args.ownerType,
    p_owner_id: args.ownerId,
    p_delta: args.delta,
    p_kind: args.kind,
    p_reference: args.reference ?? null,
    p_note: args.note ?? null,
  });
  if (error) fail(error, "Wallet adjustment failed");
  return { balanceBefore: Number(data?.balance_before), balanceAfter: Number(data?.balance_after) };
}
