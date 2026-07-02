/**
 * Wallet Top-up Payment Initialization
 * Handles calling the Supabase Edge Function to initialize Paystack payments
 */

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
    const response = await fetch(
      "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/initialize-wallet-topup",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        message: "Failed to initialize payment",
        error: errorData.error || response.statusText,
      };
    }

    const data: WalletTopupResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[v0] Wallet topup error:", error);
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
