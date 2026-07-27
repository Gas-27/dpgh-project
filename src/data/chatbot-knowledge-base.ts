/**
 * COMPREHENSIVE CHATBOT KNOWLEDGE BASE
 * Ghana Data Bundle Reseller Platform (USSD + Web + Agent/Subagent network)
 *
 * This file is self-contained: knowledge entries, synonym expansion,
 * a scored matcher, and helper utilities for follow-up flows
 * (e.g. order tracking needs a phone number).
 */

export interface KnowledgeEntry {
  id: string;
  questions: string[];       // trigger phrases / keywords
  answer: string;
  category: string;
  followUp?: "collect_phone" | "collect_network"; // signals the UI to open an input step
  relatedIds?: string[];     // suggested related entries, shown as "You might also ask..."
}

// ---------------------------------------------------------------------------
// SYNONYM MAP — expands user words to canonical terms before matching so that
// "topup", "top-up", "recharge", "bundle", "internet" etc. all reach "data".
// ---------------------------------------------------------------------------
export const SYNONYMS: Record<string, string> = {
  topup: "data", "top-up": "data", "top up": "data", recharge: "data",
  bundle: "package", bundles: "package", internet: "data", mb: "data", gb: "data",
  momo: "mobilemoney", "mobile money": "mobilemoney", "mtn momo": "mobilemoney",
  agt: "agent", reseller: "agent", vendor: "agent",
  subagt: "subagent", "sub agent": "subagent", "sub-agent": "subagent",
  "sub subagent": "subsubagent", "sub-subagent": "subsubagent", subsubagent: "subsubagent",
  cashout: "withdraw", "cash-out": "withdraw", payout: "withdraw",
  earnings: "commission", profit: "commission", margin: "commission",
  shop: "storefront", store: "storefront", "online shop": "storefront",
  slow: "delivery", pending: "delivery", "not delivered": "delivery", "not received": "delivery",
  register: "signup", registration: "signup", "sign up": "signup", join: "signup",
  farmer: "afa", "afa registration": "afa",
  key: "apikey", "api key": "apikey", token: "apikey",
  down: "offline", unavailable: "offline", "not showing": "offline",
  refund: "dispute", complaint: "dispute", wrong: "dispute", issue: "dispute",
};

function normalize(text: string): string {
  let t = text.toLowerCase().trim();
  for (const [from, to] of Object.entries(SYNONYMS)) {
    t = t.split(from).join(to);
  }
  return t;
}

// ---------------------------------------------------------------------------
// KNOWLEDGE BASE
// ---------------------------------------------------------------------------
export const CHATBOT_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ───────────────────────── Greetings / Meta ─────────────────────────
  {
    id: "greeting",
    questions: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"],
    answer: "Hello! 👋 I'm your platform assistant. I can help with data packages, buying & delivery, AFA registration, becoming an agent/subagent, dashboards, storefronts, withdrawals, the API, order tracking, or anything else on the site. What do you need?",
    category: "greeting",
  },
  {
    id: "thanks",
    questions: ["thanks", "thank you", "ok thanks", "great", "cool", "appreciate it"],
    answer: "You're welcome! Let me know if there's anything else I can help you with. 😊",
    category: "greeting",
  },
  {
    id: "human_agent",
    questions: ["talk to human", "real person", "customer care", "contact support", "speak to someone"],
    answer: "I can answer most questions instantly, but if you need a human, use the Support/Help Center link in the footer or the WhatsApp support contact shown on your dashboard — it's dynamically set per store.",
    category: "support",
  },

  // ───────────────────────── Packages ─────────────────────────
  {
    id: "packages_list",
    questions: ["data packages", "available packages", "what packages", "package list", "prices of data"],
    answer: "Tap 'Show Available Packages' to see everything grouped by network — MTN, AirtelTigo, and Telecel. Prices and availability update in real time, so what you see is always current.",
    category: "packages",
    relatedIds: ["buy_data", "offline_packages"],
  },
  {
    id: "buy_data",
    questions: ["buy data", "how to buy", "purchase data", "how do i order"],
    answer: "To buy data:\n1. Go to the Packages page\n2. Select your network (MTN, AirtelTigo, Telecel)\n3. Choose a package size\n4. Tap Buy\n5. Choose a payment method (Mobile Money via Paystack, or wallet balance)\n6. Complete payment\n7. Your data arrives within 2 hours (usually much faster)",
    category: "packages",
    relatedIds: ["delivery_time", "payment_methods"],
  },
  {
    id: "delivery_time",
    questions: ["delivery time", "how long", "when get", "how fast is delivery"],
    answer: "Delivery normally takes 5 minutes to 2 hours depending on network conditions and provider load. If it's been longer than 2 hours, use 'Track Order' and I'll check the status for you.",
    category: "packages",
    relatedIds: ["track_order", "delivery_delay"],
  },
  {
    id: "delivery_delay",
    questions: ["delivery delay", "data not received", "still waiting", "hasn't arrived"],
    answer: "Sorry about the wait! First, let's track it — share your phone number and I'll pull up the order status. Delays usually happen during high network demand or provider maintenance, and orders almost always still complete.",
    category: "support",
    followUp: "collect_phone",
    relatedIds: ["track_order", "dispute"],
  },
  {
    id: "offline_packages",
    questions: ["offline", "why offline", "package offline", "package not available"],
    answer: "A package can go offline because of network maintenance, unusually high demand, or a temporary provider issue on our end (we work with several backend providers so there's usually a fast fallback). It comes back automatically — check again shortly.",
    category: "packages",
  },
  {
    id: "networks",
    questions: ["networks", "which networks", "supported networks"],
    answer: "Supported networks:\n✓ MTN\n✓ AirtelTigo\n✓ Telecel\n\nAll three have multiple package sizes with fast delivery.",
    category: "packages",
  },
  {
    id: "package_expiry",
    questions: ["package expiry", "does data expire", "validity", "how long does data last"],
    answer: "Validity depends on the package and network — most non-expiry bundles are labelled clearly on the package card. Check the package details on the Packages page before buying if validity matters to you.",
    category: "packages",
  },

  // ───────────────────────── AFA Program ─────────────────────────
  {
    id: "afa_info",
    questions: ["afa", "what is afa"],
    answer: "AFA is an affordable data access program — you do NOT need to be a farmer to join, despite the name. Registration fee: GHC15. Approval takes 24–72 hours. Check status anytime by dialing *1848# on MTN.",
    category: "afa",
    relatedIds: ["afa_register", "afa_status"],
  },
  {
    id: "afa_register",
    questions: ["afa register", "register afa", "join afa", "how to register afa"],
    answer: "To register for AFA:\n1. Tap AFA Bundles\n2. Tap Register\n3. Fill in the form\n4. Pay the GHC15 registration fee\n5. Wait 24–72 hours for MTN to review\n6. You'll get an SMS once approved\n7. Start using your AFA bundle rate",
    category: "afa",
  },
  {
    id: "afa_approval",
    questions: ["afa approval", "how long afa", "afa waiting", "afa pending"],
    answer: "AFA approval takes 24–72 hours. MTN reviews the registration and sends an SMS confirmation. You can check progress anytime by dialing *1848# on MTN.",
    category: "afa",
  },
  {
    id: "afa_status",
    questions: ["*1848", "check status", "afa status", "check afa"],
    answer: "To check your AFA status:\n1. Dial *1848# on your MTN line\n2. Follow the prompts\n3. See your current registration status\n\nUse this any time to check approval progress.",
    category: "afa",
  },
  {
    id: "afa_rejected",
    questions: ["afa rejected", "afa denied", "afa failed"],
    answer: "If AFA registration wasn't approved, it's usually a details mismatch (name/ID/number). Re-register with the corrected details via AFA Bundles → Register, or reach support if you were charged but not approved.",
    category: "afa",
  },

  // ───────────────────────── Agent Program ─────────────────────────
  {
    id: "become_agent",
    questions: ["become agent", "how to be agent", "join as agent", "agent signup"],
    answer: "To become an agent:\n1. Tap 'Become an Agent'\n2. Fill the form\n3. Verify your phone number\n4. Wait 24–48 hours for approval\n5. Log in to your Agent Dashboard\n6. Start selling\n\nThere's no startup cost to become an agent!",
    category: "agent",
    relatedIds: ["agent_dashboard", "agent_commission"],
  },
  {
    id: "agent_commission",
    questions: ["agent commission", "how much earn", "commission rate", "how do agents make money"],
    answer: "You set your own resale prices and keep the profit! Example: we give you 1GB at GHC3.90, you sell it for GHC4.90 = GHC1 profit for you.\n\nCommission tiers on volume:\n• Starter: 5%\n• Regular: 7.5%\n• Elite: 10%\n\nHigher sales volume unlocks higher tiers automatically.",
    category: "agent",
  },
  {
    id: "subagent_create",
    questions: ["subagent", "create subagent", "add subagent"],
    answer: "To create a subagent:\n1. Go to your Agent Dashboard\n2. Tap Subagents\n3. Create a new subagent account\n4. They get their own dashboard and storefront and start selling\n5. You earn from their sales too\n\nYou can create unlimited subagents.",
    category: "agent",
    relatedIds: ["subagent_dashboard", "subsubagent_create"],
  },
  {
    id: "subsubagent_create",
    questions: ["sub-subagent", "subsubagent", "third tier agent"],
    answer: "Subagents can create their own sub-subagents the same way agents create subagents — it's a three-tier network. Each tier can set its own resale prices and earns from the tier below it.",
    category: "agent",
  },
  {
    id: "agent_vs_subagent",
    questions: ["difference agent subagent", "agent vs subagent"],
    answer: "Agents sit at the top tier and can create subagents; subagents can in turn create sub-subagents. Each level gets its own dashboard, storefront, and pricing controls, and earns commission on sales from the tier(s) below it.",
    category: "agent",
  },

  // ───────────────────────── Dashboards ─────────────────────────
  {
    id: "agent_dashboard",
    questions: ["agent dashboard", "dashboard", "what's in dashboard"],
    answer: "Your Agent Dashboard includes:\n• Overview, Buy Data, Bulk Orders\n• Store Prices (set your own resale prices)\n• Subagents, AFA Bundles\n• Flyer Generator, Withdrawals\n• API Key, Settings",
    category: "dashboard",
  },
  {
    id: "subagent_dashboard",
    questions: ["subagent dashboard"],
    answer: "Your Subagent Dashboard includes:\n• Overview, Buy Data, Bulk Orders\n• Store Prices, Sub-Subagents\n• AFA Bundles, Flyer Generator\n• Withdrawals, API Key, Settings",
    category: "dashboard",
  },

  // ───────────────────────── Storefronts ─────────────────────────
  {
    id: "storefront_info",
    questions: ["storefront", "sell online", "my shop", "online store"],
    answer: "Your storefront is your personal online shop:\n• Customers browse your packages and buy directly from you\n• You keep the profit on top of the base price\n• Fully customizable branding\n• Real-time sales tracking\n\nShare your storefront link anywhere — WhatsApp status, social media, flyers.",
    category: "storefront",
    relatedIds: ["flyer_generator"],
  },
  {
    id: "storefront_customize",
    questions: ["customize storefront", "change storefront name", "storefront branding"],
    answer: "You can customize your storefront's name, logo/branding, and displayed prices from your dashboard settings. Changes reflect on your public storefront link immediately.",
    category: "storefront",
  },

  // ───────────────────────── Payments & Withdrawals ─────────────────────────
  {
    id: "payment_methods",
    questions: ["payment methods", "how to pay", "mobile money", "paystack"],
    answer: "Payments are processed securely via Paystack. You can pay with Mobile Money (MTN MoMo, AirtelTigo Money, Telecel Cash) or your platform wallet balance if you've topped up.",
    category: "payment",
  },
  {
    id: "withdraw",
    questions: ["withdraw", "cash out", "get money"],
    answer: "To withdraw:\n1. Go to Withdrawals\n2. Enter an amount (minimum GHC15)\n3. Choose a method — Mobile Money, Bank, or Wallet\n4. Add the recipient details\n5. Confirm\n6. Funds arrive in under 2 minutes",
    category: "withdrawal",
    relatedIds: ["min_withdraw", "withdrawal_speed"],
  },
  {
    id: "min_withdraw",
    questions: ["minimum withdraw", "min amount", "smallest withdrawal"],
    answer: "The minimum withdrawal is GHC15. You can withdraw any time — there's no maximum limit.",
    category: "withdrawal",
  },
  {
    id: "withdrawal_speed",
    questions: ["withdrawal speed", "how fast withdraw", "withdrawal time"],
    answer: "Withdrawals process in under 2 minutes — funds land in your Mobile Money or bank account almost instantly.",
    category: "withdrawal",
  },
  {
    id: "withdrawal_failed",
    questions: ["withdrawal failed", "withdrawal not received", "money not sent"],
    answer: "If a withdrawal hasn't landed after a few minutes, double-check the recipient details you entered. If they're correct and it's still missing, share your phone number and I'll help track it.",
    category: "withdrawal",
    followUp: "collect_phone",
  },
  {
    id: "voucher",
    questions: ["voucher", "gift code", "gift data"],
    answer: "Vouchers are gift codes:\n1. Create one from your dashboard\n2. Set the value\n3. Share the code with someone\n4. They redeem it\n5. They receive the data\n\nGreat for gifting data to friends and family.",
    category: "features",
  },

  // ───────────────────────── API ─────────────────────────
  {
    id: "api_info",
    questions: ["api", "api key", "integration", "developer access"],
    answer: "Your API Key is in your dashboard under Settings. With it you can:\n• Fetch available packages\n• Create orders programmatically\n• Check order status\n• Manage your resale prices\n\nCheck the API documentation link in your dashboard for endpoint details and authentication.",
    category: "api",
  },
  {
    id: "api_rate_limit",
    questions: ["api rate limit", "api errors", "api not working"],
    answer: "If API calls are failing, verify you're sending your key in the correct header and that you haven't exceeded your rate limit. If it persists after checking documentation, contact support with the error response you're seeing.",
    category: "api",
  },

  // ───────────────────────── Order Tracking ─────────────────────────
  {
    id: "track_order",
    questions: ["track order", "where order", "order status", "check my order"],
    answer: "I can help track your order! Please share the phone number used for the purchase and I'll look up the status for you.",
    category: "tracking",
    followUp: "collect_phone",
  },

  // ───────────────────────── Store Features ─────────────────────────
  {
    id: "store_prices",
    questions: ["set prices", "store prices", "price setting", "change my prices"],
    answer: "To set your prices:\n1. Tap Store Prices in your dashboard\n2. Select a package\n3. Set your resale price\n4. Save\n\nYou control every price your customers see.",
    category: "features",
  },
  {
    id: "flyer_generator",
    questions: ["flyer generator", "make flyer", "marketing flyer"],
    answer: "The Flyer Generator is in your dashboard:\n1. Tap Flyer Generator\n2. Customize the design\n3. Add your prices/info\n4. Download the image\n5. Share it for marketing on WhatsApp or social media",
    category: "features",
  },
  {
    id: "bulk_order",
    questions: ["bulk order", "buy bulk", "wholesale"],
    answer: "To buy in bulk:\n1. Go to Buy Data\n2. Tap Bulk Orders\n3. Enter the quantity you want\n4. Get a bulk discount\n5. Pay\n6. Resell for profit!",
    category: "features",
  },
  {
    id: "spin_wheel",
    questions: ["spin wheel", "spin to win", "wheel game", "free data spin"],
    answer: "The Spin-to-Win wheel gives you a chance at bonus rewards! Spin once, then there's a cooldown of 8 hours per phone number before you can spin again. Look for it on your storefront or dashboard.",
    category: "features",
  },

  // ───────────────────────── Disputes / Support ─────────────────────────
  {
    id: "dispute",
    questions: ["refund", "complaint", "wrong package", "charged twice", "double charge"],
    answer: "Sorry for the trouble. Share your phone number and the order details (package, network, amount) and I'll look into it — most issues are resolved once we confirm the transaction reference with the provider.",
    category: "support",
    followUp: "collect_phone",
  },
  {
    id: "help",
    questions: ["help", "support", "question", "what can you do"],
    answer: "I'm here to help! Ask me about:\n• Packages, buying & delivery\n• AFA registration\n• Becoming an Agent/Subagent\n• Dashboards, Storefronts\n• API access\n• Withdrawals & payments\n• Order tracking\n\nWhat would you like to know?",
    category: "support",
  },
];

export const FREQUENT_QUESTIONS = [
  "Show Available Packages",
  "How do I buy data?",
  "How do I track my order?",
  "What is AFA?",
  "How do I become an agent?",
  "How much commission do agents earn?",
  "What is a subagent?",
  "How do I withdraw money?",
  "How do I set prices?",
  "What is the Flyer Generator?",
  "What are bulk orders?",
  "Check AFA status (*1848#)",
  "What payment methods can I use?",
  "How does the Spin-to-Win wheel work?",
  "My data hasn't arrived, what do I do?",
];

// ---------------------------------------------------------------------------
// SCORED MATCHER
// Exact match > phrase containment > weighted keyword overlap.
// Falls back to null (caller should show FREQUENT_QUESTIONS / "I'm not sure").
// ---------------------------------------------------------------------------
export interface MatchResult {
  answer: string;
  category: string;
  id: string;
  followUp?: KnowledgeEntry["followUp"];
  relatedIds?: string[];
  confidence: "exact" | "phrase" | "fuzzy";
}

const STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "how", "what", "when", "where",
  "why", "can", "get", "does", "with", "have", "has", "into", "will",
  "i", "a", "to", "is", "of", "on", "in", "it", "my", "me", "do", "am",
]);

function tokenize(text: string): string[] {
  return text
    .split(/[^a-z0-9*#]+/i)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function findAnswer(userQuestion: string): MatchResult | null {
  if (!userQuestion || !userQuestion.trim()) return null;

  const normalized = normalize(userQuestion);
  const cleanQuestion = normalized.trim();
  const userTokens = tokenize(cleanQuestion);

  // 1) Exact match
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const q of entry.questions) {
      if (cleanQuestion === normalize(q)) {
        return {
          answer: entry.answer,
          category: entry.category,
          id: entry.id,
          followUp: entry.followUp,
          relatedIds: entry.relatedIds,
          confidence: "exact",
        };
      }
    }
  }

  // 2) Phrase containment (either direction)
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const q of entry.questions) {
      const normQ = normalize(q);
      if (cleanQuestion.includes(normQ) || normQ.includes(cleanQuestion)) {
        return {
          answer: entry.answer,
          category: entry.category,
          id: entry.id,
          followUp: entry.followUp,
          relatedIds: entry.relatedIds,
          confidence: "phrase",
        };
      }
    }
  }

  // 3) Weighted fuzzy keyword overlap across ALL trigger phrases per entry
  let bestEntry: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    const entryTokens = new Set<string>();
    for (const q of entry.questions) {
      for (const t of tokenize(normalize(q))) entryTokens.add(t);
    }
    let score = 0;
    for (const t of userTokens) {
      if (entryTokens.has(t)) score += 1;
    }
    // small bonus for category name appearing directly
    if (userTokens.includes(entry.category)) score += 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore >= 1) {
    return {
      answer: bestEntry.answer,
      category: bestEntry.category,
      id: bestEntry.id,
      followUp: bestEntry.followUp,
      relatedIds: bestEntry.relatedIds,
      confidence: "fuzzy",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helper: pull related follow-up questions/answers for a matched entry,
// useful for showing "You might also want to know..." chips in the UI.
// ---------------------------------------------------------------------------
export function getRelatedEntries(id: string): KnowledgeEntry[] {
  const entry = CHATBOT_KNOWLEDGE_BASE.find((e) => e.id === id);
  if (!entry?.relatedIds?.length) return [];
  return entry.relatedIds
    .map((rid) => CHATBOT_KNOWLEDGE_BASE.find((e) => e.id === rid))
    .filter((e): e is KnowledgeEntry => Boolean(e));
}

// ---------------------------------------------------------------------------
// Helper: simple phone-number extractor for follow-up flows like
// "track_order" / "dispute" / "delivery_delay" / "withdrawal_failed".
// Accepts Ghana formats: 0XXXXXXXXX, +233XXXXXXXXX, 233XXXXXXXXX.
// ---------------------------------------------------------------------------
export function extractGhanaPhone(text: string): string | null {
  const digits = text.replace(/[^\d+]/g, "");
  const match = digits.match(/(?:\+?233|0)(\d{9})$/);
  return match ? `0${match[1]}` : null;
}