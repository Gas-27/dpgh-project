import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_FEE_PERCENT = 1.98;

// Timeout wrapper - if handler takes more than 25 seconds, return error
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 25000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Handler timeout")), timeoutMs)
    ),
  ]);
}

Deno.serve(async (req) => {
  console.log("[v0] REQUEST_RECEIVED");
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    return await withTimeout(handlePayment(req));
  } catch (err: any) {
    console.error("[v0] HANDLER_ERROR:", err?.message);
    return new Response(
      JSON.stringify({ error: err?.message || "Payment processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handlePayment(req: Request): Promise<Response> {
  console.log("[v0] PARSING_REQUEST");
  const { email, phone, metadata, callback_url, amount: requestedAmount } = await req.json();

  if (!email || !phone || !metadata) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[v0] PAYMENT_TYPE:", metadata?.type);
  
  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!PAYSTACK_SECRET_KEY) {
    console.error("[v0] PAYSTACK_KEY_MISSING");
    return new Response(JSON.stringify({ error: "Paystack not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle agent_registration payments
  if (metadata?.type === "agent_registration") {
    console.log("[v0] AGENT_REGISTRATION_TYPE");
    if (!requestedAmount || !metadata?.agent_store_id) {
      return new Response(JSON.stringify({ error: "Missing agent registration fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountInPesewas = Math.round(Number(requestedAmount) * 100);
    return initializePaystack(email, amountInPesewas, callback_url, metadata, PAYSTACK_SECRET_KEY);
  }

  // Handle spin_wheel payments
  if (metadata?.type === "spin_wheel") {
    console.log("[v0] SPIN_WHEEL_TYPE");
    if (!requestedAmount) {
      return new Response(JSON.stringify({ error: "Missing spin wheel amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountInPesewas = Math.round(Number(requestedAmount) * 100);
    return initializePaystack(email, amountInPesewas, callback_url, metadata, PAYSTACK_SECRET_KEY);
  }

  // Handle data_package purchases (THIS IS WHERE THE BUG WAS - .single() was crashing)
  if (metadata?.type === "data_package" || metadata?.package_id) {
    console.log("[v0] DATA_PACKAGE_TYPE");
    
    if (!metadata?.package_id) {
      return new Response(JSON.stringify({ error: "Missing package ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[v0] SUPABASE_CLIENT_INIT");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("[v0] FETCH_PACKAGE");
    // ✅ FIX #1: Changed from .single() to .maybeSingle() to prevent crashes
    const { data: packageData, error: packageError } = await supabaseClient
      .from("data_packages")
      .select("agent_price, price, size_gb, network")
      .eq("id", metadata.package_id)
      .maybeSingle();

    if (packageError || !packageData) {
      console.error("[v0] PACKAGE_FETCH_ERROR:", packageError?.message);
      return new Response(JSON.stringify({ error: "Package not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[v0] PACKAGE_FOUND");

    let baseAmount: number;
    let priceType: string;

    // Priority: 1. Subagent's sell_price, 2. Agent's sell_price, 3. Admin's base price
    if (metadata.subagent_store_id) {
      console.log("[v0] FETCH_SUBAGENT_PRICE");
      // ✅ FIX #2: Changed from .single() to .maybeSingle()
      const { data: subagentPrices, error: subagentPriceError } = await supabaseClient
        .from("subagent_package_prices")
        .select("sell_price")
        .eq("subagent_store_id", metadata.subagent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (!subagentPriceError && subagentPrices?.sell_price != null) {
        baseAmount = Number(subagentPrices.sell_price);
        priceType = "subagent_sell_price";
        console.log("[v0] USING_SUBAGENT_PRICE:", baseAmount);
      } else {
        console.log("[v0] SUBAGENT_PRICE_FALLBACK");
        // Fall back to agent price
        // ✅ FIX #3: Changed from .single() to .maybeSingle()
        const { data: agentStoreData, error: agentStoreError } = await supabaseClient
          .from("subagent_stores")
          .select("agent_store_id")
          .eq("id", metadata.subagent_store_id)
          .maybeSingle();

        if (!agentStoreError && agentStoreData?.agent_store_id) {
          // ✅ FIX #4: Changed from .single() to .maybeSingle()
          const { data: agentPrices, error: agentPriceError } = await supabaseClient
            .from("agent_package_prices")
            .select("sell_price")
            .eq("agent_store_id", agentStoreData.agent_store_id)
            .eq("package_id", metadata.package_id)
            .maybeSingle();

          if (!agentPriceError && agentPrices?.sell_price != null) {
            baseAmount = Number(agentPrices.sell_price);
            priceType = "agent_sell_price_fallback";
            console.log("[v0] USING_AGENT_PRICE:", baseAmount);
          } else {
            baseAmount = Number(packageData.price);
            priceType = "admin_user_price";
            console.log("[v0] USING_ADMIN_PRICE:", baseAmount);
          }
        } else {
          baseAmount = Number(packageData.price);
          priceType = "admin_user_price";
          console.log("[v0] USING_ADMIN_PRICE_NO_AGENT:", baseAmount);
        }
      }
    } else if (metadata.agent_store_id) {
      console.log("[v0] FETCH_AGENT_PRICE");
      // ✅ FIX #5: Changed from .single() to .maybeSingle()
      const { data: agentPrices, error: agentPriceError } = await supabaseClient
        .from("agent_package_prices")
        .select("sell_price")
        .eq("agent_store_id", metadata.agent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (!agentPriceError && agentPrices?.sell_price != null) {
        baseAmount = Number(agentPrices.sell_price);
        priceType = "agent_sell_price";
        console.log("[v0] USING_AGENT_PRICE:", baseAmount);
      } else {
        baseAmount = Number(packageData.price);
        priceType = "admin_user_price";
        console.log("[v0] USING_ADMIN_PRICE_NO_AGENT_MATCH:", baseAmount);
      }
    } else {
      baseAmount = Number(packageData.price);
      priceType = "admin_user_price";
      console.log("[v0] USING_ADMIN_PRICE_DIRECT:", baseAmount);
    }

    // Safety check
    if (!baseAmount || isNaN(baseAmount) || baseAmount <= 0) {
      console.error("[v0] INVALID_AMOUNT:", baseAmount);
      return new Response(JSON.stringify({ error: "Invalid package price" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate total with Paystack fee
    const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
    const totalWithFee = baseAmount + feeAmount;
    const amountToCharge = Math.round(totalWithFee * 100) / 100;
    const amountInPesewas = Math.round(amountToCharge * 100);

    console.log("[v0] AMOUNT_CALCULATED:", { baseAmount, fee: feeAmount, total: amountToCharge });

    return initializePaystack(
      email,
      amountInPesewas,
      callback_url,
      {
        ...metadata,
        phone,
        price_type: priceType,
        base_amount: baseAmount,
        fee_amount: feeAmount,
      },
      PAYSTACK_SECRET_KEY
    );
  }

  return new Response(JSON.stringify({ error: "Unknown payment type" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function initializePaystack(
  email: string,
  amountInPesewas: number,
  callback_url: string,
  metadata: Record<string, unknown>,
  PAYSTACK_SECRET_KEY: string
): Promise<Response> {
  console.log("[v0] PAYSTACK_INIT");
  
  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountInPesewas,
      currency: "GHS",
      callback_url,
      metadata,
    }),
  });

  console.log("[v0] PAYSTACK_RESPONSE_STATUS:", paystackRes.status);
  
  const result = await paystackRes.json();

  if (!result.status) {
    console.error("[v0] PAYSTACK_ERROR:", result.message);
    return new Response(JSON.stringify({ error: result.message || "Paystack error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!result.data?.authorization_url) {
    console.error("[v0] NO_AUTHORIZATION_URL");
    return new Response(JSON.stringify({ error: "No authorization URL from Paystack" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[v0] PAYSTACK_SUCCESS");
  
  return new Response(
    JSON.stringify({
      authorization_url: result.data.authorization_url,
      reference: result.data.reference,
      amount: result.data.amount,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
