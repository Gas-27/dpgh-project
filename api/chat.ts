import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- Tool definitions (future-ready) ---
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_order',
      description: 'Look up one or more orders by the customer phone number.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'The 10-digit Ghana phone number, e.g. 0501234567' },
          limit: { type: 'number', description: 'How many recent orders to return (default 1, max 5)' },
        },
        required: ['phone_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'available_packages',
      description: 'Return all active data bundle packages grouped by network.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'store_prices',
      description: 'Return current pricing for a specific network or all networks.',
      parameters: {
        type: 'object',
        properties: {
          network: { type: 'string', description: 'mtn | telecel | airteltigo | all' },
        },
      },
    },
  },
];

// --- Tool implementations ---
async function check_order(phone_number: string, limit = 1): Promise<string> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, network, size_gb, amount, status, fulfillment_status, created_at')
    .eq('customer_number', phone_number)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 5));

  if (error || !data?.length) {
    return `No orders found for ${phone_number}. Please double-check the number or contact WhatsApp support.`;
  }

  return data.map((o, i) => (
    `**Order ${i + 1}:** ${o.id.slice(0, 8)}...\n` +
    `Network: ${o.network?.toUpperCase()} | Size: ${o.size_gb}GB | Amount: GHS ${o.amount}\n` +
    `Status: ${o.fulfillment_status || o.status || 'Processing'} | Date: ${new Date(o.created_at).toLocaleDateString()}`
  )).join('\n\n');
}

async function available_packages(): Promise<string> {
  const { data, error } = await supabase
    .from('data_packages')
    .select('network, size_gb, size_gb_text, active, is_online')
    .order('network', { ascending: true });

  if (error || !data?.length) return 'Package list temporarily unavailable. Please visit the Packages page.';

  const byNetwork: Record<string, typeof data> = {};
  data.forEach(p => {
    if (!byNetwork[p.network]) byNetwork[p.network] = [];
    byNetwork[p.network].push(p);
  });

  return Object.entries(byNetwork).map(([net, pkgs]) => {
    const active = pkgs.filter(p => p.active && p.is_online !== false);
    const offline = pkgs.filter(p => !p.active || p.is_online === false);
    let out = `**${net.toUpperCase()}** (${active.length} active)\n`;
    active.forEach(p => { out += `• ${p.size_gb_text || p.size_gb + 'GB'}\n`; });
    if (offline.length) out += `_${offline.length} package(s) offline_\n`;
    return out;
  }).join('\n');
}

async function store_prices(network = 'all'): Promise<string> {
  const query = supabase.from('data_packages').select('network, size_gb, size_gb_text, price, active').order('network');
  if (network !== 'all') query.eq('network', network.toLowerCase());
  const { data, error } = await query;
  if (error || !data?.length) return 'Price list temporarily unavailable.';

  const byNetwork: Record<string, typeof data> = {};
  data.filter(p => p.active).forEach(p => {
    if (!byNetwork[p.network]) byNetwork[p.network] = [];
    byNetwork[p.network].push(p);
  });

  return Object.entries(byNetwork).map(([net, pkgs]) =>
    `**${net.toUpperCase()}**\n` + pkgs.map(p => `• ${p.size_gb_text || p.size_gb + 'GB'} — GHS ${p.price ?? 'N/A'}`).join('\n')
  ).join('\n\n');
}

// --- System prompt ---
const SYSTEM_PROMPT = `You are DataPlug Assistant, the AI customer support agent for DataPlug Ghana — Ghana's trusted online data bundle store.

You help customers with:
- Buying MTN, Telecel, and AirtelTigo data bundles
- Checking order status and delivery
- Becoming a data reseller agent or sub-agent
- MTN AFA bundle registration
- Payment methods (Mobile Money via Paystack)
- Wallet top-up, withdrawals, and commissions for agents
- DataPlug API for developers
- Premium subscription plans (cheapest data subscription in Ghana)

Key facts:
- DataPlug Ghana website: https://dataplug.store
- Packages page: https://dataplug.store/packages
- Become agent: https://dataplug.store/become-agent
- WhatsApp support: available on the website
- Payment: Mobile Money (MTN MoMo, Telecel Cash, AirtelTigo Money) via Paystack — completely secure
- Delivery: instant in most cases, within 2 hours for all orders
- Available 24/7 — no downtime
- Over 72,000 happy customers

Formatting rules:
- Use **bold** for important terms
- Use bullet points for lists
- Keep responses concise and friendly
- If you need to look up a customer's order, use the check_order tool
- If asked about available packages, use the available_packages tool
- If asked about prices, use the store_prices tool
- Always end with a helpful follow-up or direct the user to WhatsApp if you cannot resolve their issue

Do NOT make up prices or order statuses. Use the tools to get real data.`;

// --- Simple in-memory rate limit (per IP, per minute) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per minute per IP

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

// --- Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment before sending another message.' });
  }

  const { message, conversation = [] } = req.body as {
    message: string;
    conversation: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // Build message history (cap at last 20 for token efficiency)
  const history = conversation.slice(-20).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: message.trim() },
  ];

  try {
    // First completion — may request tool calls
    let response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 800,
      temperature: 0.4,
    });

    let assistantMessage = response.choices[0].message;

    // Agentic tool loop (max 3 rounds)
    let rounds = 0;
    while (assistantMessage.tool_calls?.length && rounds < 3) {
      rounds++;
      messages.push(assistantMessage);

      // Execute each tool call in parallel
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments ?? '{}');
          let content = '';

          switch (tc.function.name) {
            case 'check_order':
              content = await check_order(args.phone_number, args.limit ?? 1);
              break;
            case 'available_packages':
              content = await available_packages();
              break;
            case 'store_prices':
              content = await store_prices(args.network ?? 'all');
              break;
            default:
              content = 'Tool not implemented yet.';
          }

          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content,
          };
        })
      );

      messages.push(...toolResults);

      // Follow-up completion with tool results
      response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 800,
        temperature: 0.4,
      });
      assistantMessage = response.choices[0].message;
    }

    const reply = assistantMessage.content ?? "I'm sorry, I couldn't generate a response. Please try again.";
    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error('[api/chat] error:', err?.message ?? err);
    return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again shortly.' });
  }
}
