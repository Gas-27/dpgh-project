import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callbackUrl, korbaRequest, userMessage } from "../_shared/korba.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function transactionId() {
  return `DP-${crypto.randomUUID()}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await request.json();
    const operation = body.operation;
    const transaction_id = body.transaction_id || transactionId();

    if (operation === "balance") {
      return json(await korbaRequest("/get_ova_balance/", {}));
    }
    if (operation === "status") {
      if (!body.transaction_id) return json({ error: "transaction_id is required" }, 400);
      return json(await korbaRequest("/transaction_status/", { transaction_id: body.transaction_id }));
    }
    if (operation === "transactions") {
      return json(await korbaRequest("/client_transactions/", {}));
    }
    if (operation !== "collect") return json({ error: "Unsupported Korba operation" }, 400);

    const amount = Number(body.amount);
    const customerNumber = String(body.customer_number || "");
    const networkCode = String(body.network_code || "").toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Enter a valid amount" }, 400);
    if (!/^02\d{8}$/.test(customerNumber)) return json({ error: "Enter a valid Ghana phone number" }, 400);
    if (!networkCode) return json({ error: "Network is required" }, 400);

    const result = await korbaRequest("/collect/", {
      amount: amount.toFixed(2), customer_number: customerNumber, network_code: networkCode,
      description: String(body.description || "DataPlug purchase"), transaction_id, callback_url: callbackUrl(),
    }) as { success?: boolean; error_code?: number; error_message?: string; [key: string]: unknown };

    if (result.success === false) return json({ ...result, user_message: userMessage(result.error_code) });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    if (body.order_id) {
      await supabase.from("orders").update({ status: "processing", fulfillment_status: "pending", api_response: JSON.stringify(result), purchase_provider: "korba", purchase_provider_source: transaction_id }).eq("id", body.order_id);
    }
    return json({ ...result, transaction_id });
  } catch (error) {
    console.error("[korba-gateway]", error);
    return json({ error: error instanceof Error ? error.message : "Korba request failed" }, 502);
  }
});
