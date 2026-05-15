import { supabase } from "@/integrations/supabase/client";

// ==================== SUBAGENT STORE OPERATIONS ====================

export const createSubagentStore = async (parentAgentStoreId: string, storeData: any) => {
  const topupRef = `SAG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const { data, error } = await supabase
    .from("subagent_stores")
    .insert({
      ...storeData,
      parent_agent_store_id: parentAgentStoreId,
      topup_reference: topupRef,
      approved: false,
      wallet_balance: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getSubagentStore = async (storeId: string) => {
  const { data, error } = await supabase
    .from("subagent_stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (error) throw error;
  return data;
};

export const getSubagentStoresByAgent = async (parentAgentStoreId: string) => {
  const { data, error } = await supabase
    .from("subagent_stores")
    .select("*")
    .eq("parent_agent_store_id", parentAgentStoreId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getSubagentStoreByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from("subagent_stores")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
};

export const updateSubagentStore = async (storeId: string, updates: any) => {
  const { data, error } = await supabase
    .from("subagent_stores")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", storeId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ==================== SUBAGENT PACKAGE PRICING ====================

export const setSubagentPackagePrices = async (subagentStoreId: string, prices: any[]) => {
  const { error } = await supabase
    .from("subagent_package_prices")
    .upsert(
      prices.map(p => ({
        ...p,
        subagent_store_id: subagentStoreId,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "subagent_store_id,package_id" }
    );

  if (error) throw error;
};

export const getSubagentPackagePrices = async (subagentStoreId: string) => {
  const { data, error } = await supabase
    .from("subagent_package_prices")
    .select("*")
    .eq("subagent_store_id", subagentStoreId);

  if (error) throw error;
  return data || [];
};

export const updateSubagentPackagePrice = async (priceId: string, updates: any) => {
  const { data, error } = await supabase
    .from("subagent_package_prices")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", priceId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ==================== SUBAGENT ORDERS ====================

export const createSubagentOrder = async (orderData: any) => {
  const { data, error } = await supabase
    .from("subagent_orders")
    .insert(orderData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getSubagentOrders = async (subagentStoreId: string, limit = 100, offset = 0) => {
  const { data, error } = await supabase
    .from("subagent_orders")
    .select("*")
    .eq("subagent_store_id", subagentStoreId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
};

export const getSubagentOrderStats = async (subagentStoreId: string) => {
  const { data, error } = await supabase
    .from("subagent_orders")
    .select("customer_amount, agent_cost, profit, status")
    .eq("subagent_store_id", subagentStoreId);

  if (error) throw error;

  const orders = data || [];
  const completedOrders = orders.filter(o => o.status === "completed");

  return {
    totalOrders: orders.length,
    completedOrders: completedOrders.length,
    totalRevenue: completedOrders.reduce((sum, o) => sum + (o.customer_amount || 0), 0),
    totalCost: completedOrders.reduce((sum, o) => sum + (o.agent_cost || 0), 0),
    totalProfit: completedOrders.reduce((sum, o) => sum + (o.profit || 0), 0),
  };
};

export const updateSubagentOrder = async (orderId: string, updates: any) => {
  const { data, error } = await supabase
    .from("subagent_orders")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ==================== SUBAGENT WITHDRAWALS ====================

export const createWithdrawalRequest = async (subagentStoreId: string, amount: number) => {
  const { data, error } = await supabase
    .from("subagent_withdrawal_requests")
    .insert({
      subagent_store_id: subagentStoreId,
      amount,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getWithdrawalRequests = async (subagentStoreId: string) => {
  const { data, error } = await supabase
    .from("subagent_withdrawal_requests")
    .select("*")
    .eq("subagent_store_id", subagentStoreId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updateWithdrawalRequest = async (requestId: string, status: string, processedAt?: boolean) => {
  const { data, error } = await supabase
    .from("subagent_withdrawal_requests")
    .update({
      status,
      ...(processedAt && { processed_at: new Date().toISOString() }),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ==================== SUBAGENT WALLET TOPUPS ====================

export const createWalletTopup = async (subagentStoreId: string, amount: number, adminId?: string) => {
  const { data, error } = await supabase
    .from("subagent_wallet_topups")
    .insert({
      subagent_store_id: subagentStoreId,
      amount,
      admin_id: adminId,
    })
    .select()
    .single();

  if (error) throw error;

  // Update wallet balance
  const store = await getSubagentStore(subagentStoreId);
  await updateSubagentStore(subagentStoreId, {
    wallet_balance: (store.wallet_balance || 0) + amount,
  });

  return data;
};

export const getWalletTopups = async (subagentStoreId: string) => {
  const { data, error } = await supabase
    .from("subagent_wallet_topups")
    .select("*")
    .eq("subagent_store_id", subagentStoreId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

// ==================== BATCH OPERATIONS ====================

export const copyAgentPricesToSubagent = async (parentAgentStoreId: string, subagentStoreId: string) => {
  // Get agent's package prices
  const { data: agentPrices, error: agentPriceError } = await supabase
    .from("agent_package_prices")
    .select("*")
    .eq("agent_store_id", parentAgentStoreId);

  if (agentPriceError) throw agentPriceError;

  if (agentPrices && agentPrices.length > 0) {
    const subagentPrices = agentPrices.map(ap => ({
      subagent_store_id: subagentStoreId,
      package_id: ap.package_id,
      base_cost: ap.sell_price,
      sell_price: ap.sell_price,
    }));

    const { error: priceError } = await supabase
      .from("subagent_package_prices")
      .insert(subagentPrices);

    if (priceError) throw priceError;
  }
};

export const approveSubagentStore = async (storeId: string) => {
  const { data, error } = await supabase
    .from("subagent_stores")
    .update({
      approved: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const rejectSubagentStore = async (storeId: string) => {
  const { data, error } = await supabase
    .from("subagent_stores")
    .update({
      approved: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
