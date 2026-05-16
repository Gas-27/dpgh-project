import { supabase } from "@/integrations/supabase/client";

interface AgentPrice {
  agent_store_id: string;
  package_id: string;
  sell_price: number;
}

interface SubagentPriceInput {
  subagent_store_id: string;
  package_id: string;
  sell_price: number;
}

/**
 * Validates that a subagent's sell price is not below the agent's minimum price
 * This enforces the pricing hierarchy: Admin -> Agent -> Subagent
 */
export async function validateSubagentPrice(
  subagentStoreId: string,
  packageId: string,
  proposedPrice: number
): Promise<{ valid: boolean; minPrice?: number; error?: string }> {
  try {
    // Get the subagent store to find its parent agent
    const { data: subagentStore, error: subagentError } = await supabase
      .from("subagent_stores")
      .select("agent_store_id")
      .eq("id", subagentStoreId)
      .single();

    if (subagentError || !subagentStore) {
      return { valid: false, error: "Subagent store not found" };
    }

    // Get the agent's pricing for this package
    const { data: agentPrice, error: agentError } = await supabase
      .from("agent_package_prices")
      .select("sell_price")
      .eq("agent_store_id", subagentStore.agent_store_id)
      .eq("package_id", packageId)
      .single();

    if (agentError && agentError.code !== "PGRST116") {
      // PGRST116 = no rows found, which is okay
      return { valid: false, error: "Failed to fetch agent pricing" };
    }

    // If agent doesn't have a price set, use the base agent_price from data_packages
    let minPrice = agentPrice?.sell_price ?? 0;

    if (!minPrice) {
      const { data: basePackage, error: packageError } = await supabase
        .from("data_packages")
        .select("agent_price")
        .eq("id", packageId)
        .single();

      if (packageError) {
        return { valid: false, error: "Failed to fetch package details" };
      }

      minPrice = basePackage?.agent_price ?? 0;
    }

    // Validate that proposed price is at or above the minimum
    if (proposedPrice < minPrice) {
      return {
        valid: false,
        minPrice,
        error: `Price must be at least GH₵${minPrice.toFixed(2)} (agent's price)`,
      };
    }

    return { valid: true, minPrice };
  } catch (error) {
    console.error("Pricing validation error:", error);
    return { valid: false, error: "An error occurred during validation" };
  }
}

/**
 * Batch validate multiple subagent prices
 */
export async function validateSubagentPrices(
  subagentStoreId: string,
  prices: Array<{ packageId: string; sellPrice: number }>
): Promise<{ valid: boolean; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};

  for (const price of prices) {
    const validation = await validateSubagentPrice(
      subagentStoreId,
      price.packageId,
      price.sellPrice
    );

    if (!validation.valid) {
      errors[price.packageId] = validation.error || "Invalid price";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Get agent's minimum price for a package
 */
export async function getAgentMinimumPrice(
  agentStoreId: string,
  packageId: string
): Promise<number> {
  try {
    // First try to get agent's custom price
    const { data: agentPrice } = await supabase
      .from("agent_package_prices")
      .select("sell_price")
      .eq("agent_store_id", agentStoreId)
      .eq("package_id", packageId)
      .single();

    if (agentPrice) {
      return agentPrice.sell_price;
    }

    // Fall back to base agent_price
    const { data: basePackage } = await supabase
      .from("data_packages")
      .select("agent_price")
      .eq("id", packageId)
      .single();

    return basePackage?.agent_price ?? 0;
  } catch (error) {
    console.error("Failed to get minimum price:", error);
    return 0;
  }
}

/**
 * Calculate profit for a subagent sale
 */
export function calculateProfit(
  sellPrice: number,
  costPrice: number
): number {
  return Math.max(0, sellPrice - costPrice);
}

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number): string {
  return `GH₵${price.toFixed(2)}`;
}
