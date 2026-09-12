import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface EdgeFunctionRequest {
  message: string;
  conversation: ConversationMessage[];
  systemPrompt: string;
}

interface EdgeFunctionResponse {
  reply?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Knowledge-base compiled into a rich system prompt.
// The KB is inlined here so the Vercel serverless function is self-contained
// (the /api directory is separate from /src and cannot import from it).
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are DataPlug Assistant — the official AI customer support agent for DataPlug Ghana (https://dataplug.store), Ghana's most trusted online data bundle store.

Your personality: friendly, concise, professional. You speak plain English (not overly formal). You understand Ghanaian mobile data terms.

ALWAYS use **bold** for key terms, bullet points for steps, and keep answers under 200 words unless deep detail is truly needed.
NEVER make up prices, order statuses, or policies. Use the knowledge below.
If a user's question requires their phone number (order tracking, withdrawal issue, dispute), ask for it politely.
If you cannot resolve something, direct them to WhatsApp support shown in the footer/dashboard.

---
## PLATFORM OVERVIEW

DataPlug Ghana sells MTN, Telecel, and AirtelTigo data bundles online. Customers buy directly; Agents resell through their own storefront and dashboard. There is a 3-tier agent network: Agent → Subagent → Sub-Subagent.

Payments: Paystack (MTN MoMo, AirtelTigo Money, Telecel Cash) or wallet balance.
Delivery: Usually instant, max 2 hours.
Support: WhatsApp (link on site) and this chatbot.

---
## PACKAGES & BUYING

- Packages page: browse by network (MTN, MTN Express, AirtelTigo, Telecel).
- To buy: select network → choose size → tap Buy → pay → data arrives.
- Prices update in real time. Offline packages come back automatically after network issues.
- Package validity varies; check the card before buying.

**MTN bundle location:** Dials *124# → Data Balance → Balance Breakdown → look for "Master Beneficiary Data Bundle". NOT under Mashup or any other section.
**MTN Express:** Faster MTN delivery route. Bundle also lands under "Master Beneficiary Data Bundle" — same location as standard MTN.
**Telecel:** Check balance in the official Telecel Ghana app.
**AirtelTigo:** Check balance in the official AirtelTigo Ghana app.

---
## AFA PROGRAM

- AFA = Affordable data access program. Anyone can register — you do NOT need to be a farmer.
- Registration fee: GHC 15. Approval: 24–72 hours. SMS confirmation sent by MTN.
- Register: AFA Bundles → Register → fill form → pay fee.
- Check status: dial *1848# on MTN line.
- If rejected: usually a name/ID mismatch. Re-register with corrected details.

---
## AGENT PROGRAMME

**Become an Agent:**
1. Click "Become an Agent" on the menu/homepage.
2. Fill in registration form.
3. Pay the agent fee (check signup page for current amount).
4. Account activated immediately — no approval wait.
5. Log in to Agent Dashboard and start selling.

**Commission tiers (volume-based, auto-upgrades):**
- Starter: 5%
- Regular: 7.5%
- Elite: 10%

Agents set their own resale prices and keep the markup profit. Example: buy 1GB at GHC 3.90, sell at GHC 4.90 = GHC 1 profit per bundle.

**Subagents:** Agents create unlimited Subagents from Dashboard → Subagents. Subagents get their own dashboard, storefront, pricing control, and can create Sub-Subagents.

**Agent Dashboard includes:** Overview, Buy Data, Bulk Orders, Store Prices, Subagents, AFA Bundles, Flyer Generator, Withdrawals, API Key, Settings.

**Storefront:** Each agent/subagent gets a unique storefront link. Customers buy directly from it. Fully customizable branding. Share via WhatsApp, social media, flyers.

---
## PAYMENTS & WALLET

- Pay with Paystack (Mobile Money) or wallet balance.
- Top up wallet: Dashboard → top-up section → enter amount → pay via Paystack → instant.
- Withdraw: Dashboard → Withdrawals → enter amount (min GHC 15) → choose MoMo/Bank/Wallet → confirm → arrives in under 2 minutes. No maximum limit.

---
## REFUND SYSTEM

Refunds flow through the agent chain based on where the order was placed:

1. **Direct customer order** → refund lands in User Dashboard Wallet.
2. **Agent buying for themselves** → refund lands in Agent Wallet.
3. **Agent storefront order** → refund goes to Agent's wallet (at base price). Agent can then send MoMo to customer OR retry the order from wallet balance.
4. **Subagent order** → Admin refunds to Agent wallet → Agent refunds to Subagent wallet → Subagent can retry or withdraw.
5. **Sub-Subagent order** → chain continues: Admin → Subagent wallet → Sub-Subagent wallet.

**Key rules:** Each order can only be refunded once. Refunds land in platform wallets, not Mobile Money. Withdraw from wallet any time (min GHC 15).

---
## ORDER TRACKING & DISPUTES

- Track order: ask user for their Ghana phone number (format: 0XXXXXXXXX) and use the check_order tool.
- Dispute on delivered order: order history → find order → tap Report → answer pre-check questions (owing airtime/bundle/MoMo?) → upload data balance screenshot → submit.
- **Common reason data seems missing:** the SIM has outstanding airtime, bundle, or MoMo debt. Clear the debt first, then re-check *124# balance.

---
## OWING / DEBT ISSUE

If a SIM owes airtime, bundles, or MoMo, the network may hold/redirect delivered data. Before reporting:
1. Check if the SIM owes airtime.
2. Check outstanding bundle subscriptions.
3. Check MoMo debt.
4. Clear debts → re-check *124# balance.

---
## API ACCESS

- API Key: Dashboard → Settings.
- Capabilities: fetch packages, create orders, check status, manage prices.
- Rate limit errors: verify key header format and check docs. Report persistent issues with the full error response.

---
## ADDITIONAL FEATURES

- **Bulk Orders:** Buy Data → Bulk Orders → enter quantity → bulk discount applied.
- **Flyer Generator:** Dashboard → Flyer Generator → customise → download → share.
- **Vouchers:** Create gift codes for data. Dashboard → create voucher → set value → share code → recipient redeems.
- **Spin-to-Win:** Chance at bonus rewards. 8-hour cooldown per phone number.
- **Premium Subscription:** cheapest-ever monthly data subscription — visit /premium-subscription.

---
## FUTURE TOOLS (already declared — use when available)

- check_order: look up orders by phone number
- get_packages: list current active packages by network
- get_wallet_balance: get a user's wallet balance
- refund_status: check refund status for an order
- create_support_ticket: open a support ticket for complex issues

Always attempt to use these tools when a user's request matches their purpose.
`;

// ---------------------------------------------------------------------------
// Tool definitions (future-ready — Supabase Edge Function will implement them)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_order',
      description: 'Look up recent orders for a customer by their Ghana phone number.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Ghana phone number in format 0XXXXXXXXX or +233XXXXXXXXX',
          },
          limit: {
            type: 'number',
            description: 'Number of recent orders to return (default 1, max 5)',
          },
        },
        required: ['phone_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_packages',
      description: 'Return all active data bundle packages grouped by network.',
      parameters: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            description: 'Filter by network: mtn | telecel | airteltigo | mtn_express | all',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_wallet_balance',
      description: "Return the authenticated user's wallet balance.",
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'The user UUID' },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'refund_status',
      description: 'Check the refund status for a specific order.',
      parameters: {
        type: 'object',
        properties: {
          order_id: { type: 'string', description: 'The order UUID or short ID' },
        },
        required: ['order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_support_ticket',
      description: 'Open a support ticket for a complex issue that cannot be resolved by the bot.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string' },
          issue_summary: { type: 'string' },
          category: {
            type: 'string',
            enum: ['delivery', 'refund', 'account', 'payment', 'agent', 'other'],
          },
        },
        required: ['phone_number', 'issue_summary', 'category'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Rate limiting (in-memory per-IP, per minute)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Main handler — calls Supabase Edge Function which holds the OPENAI_API_KEY
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before sending another message.',
    });
  }

  const { message, conversation = [] } = req.body as {
    message: string;
    conversation: ConversationMessage[];
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[api/chat] Missing Supabase credentials');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/dataplug-chat`;

  const payload: EdgeFunctionRequest = {
    message: message.trim(),
    conversation: conversation.slice(-20),
    systemPrompt: SYSTEM_PROMPT,
  };

  try {
    const edgeRes = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
        'x-tools': JSON.stringify(TOOLS),
      },
      body: JSON.stringify(payload),
    });

    if (!edgeRes.ok) {
      const errorBody = await edgeRes.text().catch(() => '');
      console.error(`[api/chat] Edge function returned ${edgeRes.status}:`, errorBody);
      return res.status(502).json({
        error: 'AI service temporarily unavailable. Please try again shortly or contact WhatsApp support.',
      });
    }

    const data: EdgeFunctionResponse = await edgeRes.json();

    if (data.error) {
      console.error('[api/chat] Edge function error:', data.error);
      return res.status(502).json({ error: data.error });
    }

    return res.status(200).json({ reply: data.reply });
  } catch (err: any) {
    console.error('[api/chat] Fetch error:', err?.message ?? err);
    return res.status(500).json({
      error: 'Could not reach AI service. Please try again or contact WhatsApp support.',
    });
  }
}
