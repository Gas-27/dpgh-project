/**
 * Wallet Top-up Payment Initialization
 * Handles calling the Supabase Edge Function to initialize Paystack payments
 */

import { supabase } from "@/integrations/supabase/client";

export interface WalletTopupRequest {
  api_key?: string;
  identity_id?: string;
  amount: number;
  callback_url: string;
}

export interface WalletTopupResponse {
  success: boolean;
  message: string;
  data?: {
    authorization_url: string;
    reference: string;
    amount: number;
    base_amount: number;
    fee_amount: number;
  };
  error?: string;
}

/**
 * Initialize a wallet top-up payment via Paystack
 * @param request The top-up request with amount and callback URL
 * @returns Response with Paystack authorization URL or error
 */
export const initializeWalletTopup = async (
  request: WalletTopupRequest
): Promise<WalletTopupResponse> => {
  try {
    // Use supabase.functions.invoke so the required apikey/Authorization
    // headers are automatically attached (avoids the 401 gateway error).
    const { data, error } = await supabase.functions.invoke(
      "initialize-wallet-topup",
      {
        body: request,
      }
    );

    if (error) {
      // Try to surface the edge function's own error message if present
      let message = error.message;
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          message = body?.error || body?.message || message;
        }
      } catch {
        // ignore parse errors, fall back to error.message
      }
      return {
        success: false,
        message: "Failed to initialize payment",
        error: message,
      };
    }

    return data as WalletTopupResponse;
  } catch (error) {
    return {
      success: false,
      message: "Error initializing payment",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Redirect user to Paystack for payment
 * @param authorizationUrl The Paystack authorization URL from the response
 */
export const redirectToPaystack = (authorizationUrl: string) => {
  window.location.href = authorizationUrl;
};
