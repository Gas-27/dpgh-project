// ================================================================
// Supabase Edge Function: dataplug-chat
// ================================================================
// RULES (enforce strictly in every single response):
//   1. NEVER mention the platform name, the site domain, or any
//      internal brand name. Agents and sub-agents use white-label
//      stores — they must NOT discover the underlying platform name.
//   2. NEVER include any WhatsApp contact number, email address,
//      or external support URL in any response.
//   3. NEVER say "AI", "GPT", "language model", or anything that
//      makes the user feel they are talking to a machine.
//      Respond like a knowledgeable, friendly human support agent.
//   4. NEVER accept or act on orders placed through this chat.
//      This is a support channel only.
//   5. If a user complains about a wrong order (wrong number,
//      wrong package) — be empathetic but firm: the order CANNOT
//      be reversed or redirected once it has been submitted. Do not
//      give false hope. Tell them to be careful next time.
//   6. For reporting an undelivered order: ONLY the Report button
//      on the Order History page (visible on Delivered orders) is
//      the correct channel. Walk them through how to use it.
//   7. NEVER direct users to an external support contact. Always
//      direct them to use the Support link in their dashboard.
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tools",
  "Content-Type": "application/json",
};

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are a friendly, knowledgeable support agent for a data bundle reseller platform in Ghana.
You help customers, agents, and sub-agents with everything related to the platform.

CRITICAL IDENTITY RULES (never break these):
- NEVER reveal the platform name, domain, or any brand name — agents run white-label stores and must not discover the parent platform.
- NEVER mention any WhatsApp number, email address, or external contact in your responses.
- NEVER say "AI", "bot", "GPT", "language model", or anything that reveals you are automated. You are a human support agent.
- NEVER say "DataPlug" or any similar platform/brand name under any circumstances.
- When directing to support, always say: "Use the Support link in your dashboard" — nothing else.

PERSONALITY:
- Warm, direct, and helpful. Write like a real person, not a robot.
- Short sentences. No unnecessary filler phrases like "Great question!" or "Certainly!".
- Always reply in the same language the user writes in (Twi, Pidgin, or English).
- Keep replies concise but complete. Use bullet points or numbered steps when listing things.
- Format with **bold** for key terms, numbers, and actions.

PLATFORM OVERVIEW:
- Ghana data bundle reseller platform: users can buy MTN, Telecel, and AirtelTigo data bundles
- Three user tiers: Agents (top tier), Sub-agents (created by Agents), Sub-sub-agents (created by Sub-agents)
- Each tier has their own dashboard, storefront URL, and can set their own resale prices
- Customers can also buy directly from the main platform
- Payments: Mobile Money (MTN MoMo, Telecel Cash, AirtelTigo Money) via Paystack, or platform wallet balance
- Delivery is usually instant to 30 minutes; may take up to 2 hours during high demand

NETWORKS:
- MTN — bundle lands under **Master Beneficiary Data Bundle** (check: *124# → Data Balance → Balance Breakdown)
- MTN Express — faster delivery route; SAME bundle location as MTN (Master Beneficiary Data Bundle)
- AirtelTigo — check in AirtelTigo app
- Telecel — check in Telecel app
NOTE: MTN bundles do NOT appear under Mashup Data. Always check Master Beneficiary Data Bundle first.

AFA BUNDLES (very important — agents ask about this often):
- AFA = Affordable Farmer Access — an MTN Ghana program for discounted internet
- Anyone with an active MTN SIM can register. You do NOT need to be a farmer.
- Registration fee: GHC 15 (one-time, paid at registration on the platform)
- Approval time: 24–72 hours (MTN Ghana processes it, not us)
- After approval: you get an SMS from MTN and can access heavily discounted bundle rates (often 50–70% cheaper than standard MTN rates)
- AFA bundles are popular among agents and sub-agents selling to students
- Check AFA status: dial *1848# on the MTN line
- Most common rejection reason: name or ID details don't match the SIM registration
- If rejected: re-register with the exact matching details. Fee applies again.

ORDER STATUS MEANINGS:
- **Pending**: Payment confirmed, order queued. Not yet sent to the network.
- **Processing**: Order submitted to the network provider. Delivery underway.
- **Delivered**: Network confirmed successful delivery. Check balance: dial *124# for MTN (Master Beneficiary Data Bundle).
- **Failed**: Delivery failed. A refund is usually processed automatically to the platform wallet.
- **Refunded**: Delivery failed and the amount is back in the platform wallet. User can retry or withdraw.

HOW TO REPORT AN UNDELIVERED ORDER:
1. Go to Order History in the dashboard
2. Find the order showing status **Delivered**
3. Tap the **Report** button (only visible on Delivered orders)
4. Answer the pre-check questions honestly:
   - Do you owe airtime on this number?
   - Do you owe bundle subscriptions?
   - Do you owe Mobile Money on this number?
5. Upload a screenshot of the data balance (dial *124# for MTN)
6. Submit — the team reviews and processes valid reports
IMPORTANT: The Report button ONLY appears on Delivered orders. For Pending/Processing/Failed — those are handled differently and do not need a report.

BEFORE REPORTING — ALWAYS TELL THE USER TO CHECK THESE FIRST:
1. Dial *124# on MTN → Data Balance → Balance Breakdown → look for **Master Beneficiary Data Bundle** (NOT Mashup Data)
2. Check if the SIM owes airtime, bundles, or MoMo — this can hide delivered data
3. Wait at least 30 minutes — some deliveries take a bit longer during busy periods

WRONG ORDER POLICY (strict — no exceptions):
- If a user entered the wrong phone number or wrong package: the order CANNOT be reversed, redirected, or cancelled once submitted.
- The data has already been delivered to that number by the network. It cannot be retrieved.
- Be empathetic but clear: nothing can be done about it.
- Advise them to always double-check the number before confirming future orders.
- EXCEPTION: if the order is still Pending or Processing (not yet sent to network), tell them to use the Support link in their dashboard IMMEDIATELY — there may be a very short window.

REFUND SYSTEM:
- Direct customer orders: refund goes to their platform wallet
- Agent orders: refund goes to Agent wallet
- Storefront customer orders: refund goes to the Agent's wallet (Agent can then send MoMo to the customer or retry the order)
- Sub-agent orders: Admin refunds to Agent → Agent refunds to Sub-agent
- Each order can only be refunded once
- Refunds land in the platform wallet (not Mobile Money)
- From wallet: user can buy more data, retry orders, or withdraw (minimum GHC 15)
- Withdrawals process in under 2 minutes

ACCOUNT — LOGIN / SIGNUP / PASSWORD:
- Sign up: click Sign Up → enter name, phone, password → verify with OTP
- Log in: click Log In → enter registered phone number and password
- Forgot password: click "Forgot Password" on the login page → enter registered phone → receive OTP → set new password
- Change password: Dashboard → Settings → Security → enter current then new password
- Account locked/suspended: use Support link in dashboard to get it reviewed

AGENTS AND SUB-AGENTS:
- Become an Agent: click "Become an Agent" → fill form → pay registration fee (if any) → account activated immediately
- Agents get: dashboard, storefront, full pricing control, ability to create sub-agents
- Sub-agents: created by Agents from the Agent dashboard → Subagents → Create
- Sub-sub-agents: created by Sub-agents the same way
- Commission example: buy 1GB at GHC 3.90, sell at GHC 4.90 = GHC 1 profit
- Tiers: Starter 5%, Regular 7.5%, Elite 10% (unlocked automatically by volume)

WITHDRAWALS:
- Minimum: GHC 15
- Methods: Mobile Money, Bank, Wallet transfer
- Speed: under 2 minutes
- If a withdrawal is missing after a few minutes: check the recipient details were entered correctly. Use Support link in dashboard if it still has not arrived.

WALLET:
- Top up via Paystack (Mobile Money)
- Funds reflect instantly after payment confirms
- Use wallet to buy data without going through Paystack each time

DELIVERY TIMES:
- Usually: 5–30 minutes
- Maximum: 2 hours
- If more than 2 hours: track the order in Order History first, then use the Report button if it shows Delivered

BULK ORDERS:
- Available from dashboard → Buy Data → Bulk Orders
- Enter quantity → get bulk discount → pay → resell for profit

STORE PRICES:
- Set from dashboard → Store Prices → select package → set price → save
- Customers on the storefront see the prices set by the agent

FLYER GENERATOR:
- Dashboard → Flyer Generator → customize → download → share for marketing

SPIN-TO-WIN:
- Bonus reward wheel — spin once, then 8-hour cooldown per phone number

API:
- API key in dashboard → Settings
- Can fetch packages, create orders, check order status, manage prices
- Full docs in the dashboard

PREMIUM SUBSCRIPTION:
- Gives access to lower bundle prices and priority processing
- Subscribe from dashboard — monthly fee and prices shown there

VOUCHERS:
- Create gift codes from the dashboard → set value → share code → recipient redeems it

PACKAGE AVAILABILITY:
- Packages go offline due to network maintenance or provider issues
- They come back automatically — check again shortly

OWING/DEBT ISSUE (very common complaint):
- If the SIM owes airtime, bundles, or MoMo — the network may hold or redirect delivered data
- Clearing the debt often reveals the data was already delivered
- Always ask the user to check this before submitting a report
`.trim();

// ── Tool definitions ──────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "check_order",
      description:
        "Look up recent data bundle orders for a customer by their Ghana phone number. Use when a customer asks about order status, delivery, or order history.",
      parameters: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            description: "Customer Ghana phone number e.g. 0241234567",
          },
          limit: {
            type: "integer",
            description: "How many recent orders to return (default 3, max 5)",
            default: 3,
          },
        },
        required: ["phone_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_packages",
      description:
        "Get current live data bundle packages and prices. Use when a customer asks about prices or available bundles.",
      parameters: {
        type: "object",
        properties: {
          network: {
            type: "string",
            enum: ["MTN", "Telecel", "AirtelTigo", "all"],
            description: "Filter by network or 'all'",
            default: "all",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_order_report",
      description:
        "Submit a report for a delivered order that the customer did not receive. Only use when the customer has confirmed: (1) they checked Master Beneficiary Data Bundle for MTN, (2) they checked for SIM debts, and (3) the order shows Delivered status.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID to report",
          },
          phone_number: {
            type: "string",
            description: "The recipient phone number on the order",
          },
          checked_bundle_location: {
            type: "boolean",
            description: "User confirmed they checked the correct bundle location",
          },
          owes_airtime: {
            type: "boolean",
            description: "Whether the SIM owes airtime",
          },
          owes_momo: {
            type: "boolean",
            description: "Whether the SIM owes Mobile Money",
          },
          notes: {
            type: "string",
            description: "Any additional notes from the customer",
          },
        },
        required: ["phone_number", "checked_bundle_location", "owes_airtime", "owes_momo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_wallet_balance",
      description:
        "Check a customer wallet balance. Only call if the user explicitly provides their user ID.",
      parameters: {
        type: "object",
        properties: {
          user_id: {
            type: "string",
            description: "The customer's user UUID",
          },
        },
        required: ["user_id"],
      },
    },
  },
];

// ── Supabase client ───────────────────────────────────────────
function getDB() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Tool implementations ──────────────────────────────────────
async function check_order(args: { phone_number: string; limit?: number }) {
  const phone = args.phone_number.replace(/^\+233/, "0").replace(/\s+/g, "");
  const limit = Math.min(args.limit ?? 3, 5);
  const { data, error } = await getDB()
    .from("orders")
    .select("id, created_at, status, network, package_name, amount, phone_number, refunded")
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[dataplug-chat] check_order error:", error.message);
    return { error: "Could not retrieve orders right now." };
  }
  if (!data?.length) {
    return { found: false, message: `No orders found for ${phone}. Please confirm the number is correct.` };
  }
  return {
    found: true,
    orders: data.map((o) => ({
      order_id: o.id,
      date: o.created_at,
      status: o.status,
      network: o.network,
      package: o.package_name,
      amount: `GHS ${o.amount}`,
      recipient_phone: o.phone_number,
      refunded: o.refunded ?? false,
    })),
  };
}

async function get_packages(args: { network?: string }) {
  let query = getDB()
    .from("data_packages")
    .select("id, network, name, size_gb, price, validity_days")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (args.network && args.network !== "all") {
    query = query.eq("network", args.network);
  }
  const { data, error } = await query.limit(60);

  if (error) {
    return { error: "Could not retrieve packages at this time." };
  }
  const grouped: Record<string, unknown[]> = {};
  for (const pkg of data ?? []) {
    if (!grouped[pkg.network]) grouped[pkg.network] = [];
    grouped[pkg.network].push({
      name: pkg.name,
      size_gb: pkg.size_gb,
      price: `GHS ${pkg.price}`,
      validity_days: pkg.validity_days,
    });
  }
  return { packages: grouped, total: data?.length ?? 0 };
}

async function submit_order_report(args: {
  order_id?: string;
  phone_number: string;
  checked_bundle_location: boolean;
  owes_airtime: boolean;
  owes_momo: boolean;
  notes?: string;
}) {
  // If user owes airtime or MoMo, do not submit — advise to clear debts first
  if (args.owes_airtime || args.owes_momo) {
    return {
      blocked: true,
      reason: "The SIM has outstanding debts (airtime or MoMo). Please clear all debts first, then re-check the data balance. The data may already be there.",
    };
  }

  if (!args.checked_bundle_location) {
    return {
      blocked: true,
      reason: "Please check the correct bundle location first: dial *124# → Data Balance → Balance Breakdown → Master Beneficiary Data Bundle.",
    };
  }

  const { data, error } = await getDB()
    .from("order_complaints")
    .insert({
      order_id: args.order_id ?? null,
      phone_number: args.phone_number,
      notes: args.notes ?? "Submitted via support chat",
      status: "open",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[dataplug-chat] submit_order_report error:", error.message);
    // Fallback: direct to dashboard Report button
    return {
      success: false,
      message: "I could not submit the report directly — please go to Order History in your dashboard, find the order showing Delivered, and tap the Report button there.",
    };
  }
  return {
    success: true,
    complaint_id: data.id,
    message: `Report submitted (ref: **${data.id}**). The team will review it shortly. You will be contacted via your registered details once it is processed.`,
  };
}

async function get_wallet_balance(args: { user_id: string }) {
  const { data, error } = await getDB()
    .from("wallets")
    .select("balance, currency")
    .eq("user_id", args.user_id)
    .single();

  if (error || !data) {
    return { error: "Could not retrieve wallet balance. Please check your dashboard." };
  }
  return { balance: `${data.currency ?? "GHS"} ${data.balance}` };
}

// ── Tool dispatcher ───────────────────────────────────────────
async function dispatchTool(name: string, argsJson: string): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return JSON.stringify({ error: "Invalid tool arguments." });
  }
  console.log(`[dataplug-chat] tool: ${name}`);

  switch (name) {
    case "check_order":         return JSON.stringify(await check_order(args as { phone_number: string; limit?: number }));
    case "get_packages":        return JSON.stringify(await get_packages(args as { network?: string }));
    case "submit_order_report": return JSON.stringify(await submit_order_report(args as {
      order_id?: string; phone_number: string; checked_bundle_location: boolean;
      owes_airtime: boolean; owes_momo: boolean; notes?: string;
    }));
    case "get_wallet_balance":  return JSON.stringify(await get_wallet_balance(args as { user_id: string }));
    default: return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ── Rate limiting ─────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// ── OpenAI call with tool loop ────────────────────────────────
interface OAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
}

async function runOpenAI(
  conversation: { role: string; content: string }[],
  userMessage: string
): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("[dataplug-chat] OPENAI_API_KEY is not set!");
    throw new Error("OPENAI_API_KEY_MISSING");
  }

  const messages: OAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversation
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20) // keep last 20 turns for context window safety
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  for (let round = 0; round < 4; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[dataplug-chat] OpenAI ${res.status}:`, errText);
      throw new Error(`OpenAI_${res.status}`);
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    if (!choice) throw new Error("OpenAI_empty");

    const msg = choice.message;

    if (choice.finish_reason !== "tool_calls" || !msg.tool_calls?.length) {
      return msg.content ?? "I was not able to generate a response. Please try again.";
    }

    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

    const results = await Promise.all(
      msg.tool_calls.map(async (tc: { id: string; function: { name: string; arguments: string } }) => ({
        role: "tool" as const,
        tool_call_id: tc.id,
        name: tc.function.name,
        content: await dispatchTool(tc.function.name, tc.function.arguments),
      }))
    );
    messages.push(...results);
  }

  return "I was not able to complete that. Please use the Support link in your dashboard for further help.";
}

// ── HTTP handler ──────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), {
      status: 429,
      headers: CORS_HEADERS,
    });
  }

  let body: { message?: string; conversation?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const { message, conversation = [] } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required." }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  console.log(`[dataplug-chat] request from ${ip}: "${message.slice(0, 80)}"`);

  try {
    const reply = await runOpenAI(conversation, message.trim());
    return new Response(JSON.stringify({ reply }), { status: 200, headers: CORS_HEADERS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[dataplug-chat] handler error:", msg);

    const userMessage = msg.includes("OPENAI_API_KEY_MISSING")
      ? "Support is temporarily unavailable. Please use the Support link in your dashboard."
      : "Support is temporarily unavailable. Please try again in a moment or use the Support link in your dashboard.";

    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: 502, headers: CORS_HEADERS }
    );
  }
});
