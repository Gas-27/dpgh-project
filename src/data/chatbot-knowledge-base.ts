/**
 * COMPREHENSIVE CHATBOT KNOWLEDGE BASE
 * Contains all information about the platform
 */

interface KnowledgeEntry {
  questions: string[];
  answer: string;
  category: string;
}

export const CHATBOT_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // Greetings
  {
    questions: ["hello", "hi", "hey"],
    answer: "Hello! I'm your chatbot assistant. Ask me about data packages, agent programs, AFA, dashboards, APIs, or anything else!",
    category: "greeting"
  },

  // Data Packages
  {
    questions: ["data packages", "available packages", "what packages"],
    answer: "Click the 'Show Available Packages' button to see all packages grouped by network (MTN, AirtelTigo, Telecel). Packages update in real-time.",
    category: "packages"
  },
  {
    questions: ["buy data", "how to buy", "purchase data"],
    answer: "1. Go to Packages page\n2. Select your network\n3. Choose package size\n4. Click buy\n5. Choose payment method\n6. Complete payment\n7. Data arrives in 2 hours",
    category: "packages"
  },
  {
    questions: ["delivery time", "how long", "when get"],
    answer: "Delivery takes 5 minutes to 2 hours depending on network conditions. Without issues, usually within 2 hours.",
    category: "packages"
  },

  // AFA Program
  {
    questions: ["afa", "what is afa"],
    answer: "AFA is an affordable data program. You don't need to be a farmer. Registration fee: GHC15. Approval: 24-72 hours. Check status: Dial *1848#",
    category: "afa"
  },
  {
    questions: ["afa register", "register afa"],
    answer: "1. Click AFA Bundles\n2. Click Register\n3. Fill form\n4. Pay GHC15\n5. Wait 24-72 hours\n6. Get SMS approval\n7. Start using AFA",
    category: "afa"
  },
  {
    questions: ["afa approval", "how long afa"],
    answer: "AFA approval takes 24-72 hours. MTN reviews and sends SMS. Check status: Dial *1848# on MTN.",
    category: "afa"
  },
  {
    questions: ["*1848", "check status", "afa status"],
    answer: "To check AFA status:\n1. Dial *1848# on MTN\n2. Follow prompts\n3. See your status\n\nUse this to check approval progress.",
    category: "afa"
  },

  // Agent Program
  {
    questions: ["become agent", "how to be agent"],
    answer: "1. Click Become an Agent\n2. Fill form\n3. Verify phone\n4. Wait 24-48 hours\n5. Login dashboard\n6. Start selling\n\nNo startup cost!",
    category: "agent"
  },
  {
    questions: ["agent commission", "how much earn"],
    answer: "You set prices and keep profit!\nExample: We give 1GB for GHC3.90, you sell for GHC4.90 = GHC1 profit.\n\nCommission tiers:\n- Starter: 5%\n- Regular: 7.5%\n- Elite: 10%",
    category: "agent"
  },
  {
    questions: ["subagent", "create subagent"],
    answer: "1. Go to Agent Dashboard\n2. Click Subagents\n3. Create new subagent\n4. They start selling\n5. You earn from their sales\n\nUnlimited subagents!",
    category: "agent"
  },

  // Dashboards
  {
    questions: ["agent dashboard", "dashboard"],
    answer: "Agent Dashboard has:\n- Overview, Buy Data, Bulk Orders\n- Store Prices (set your prices)\n- Subagents, AFA\n- Flyer Generator, Withdrawals\n- API Key, Settings",
    category: "dashboard"
  },
  {
    questions: ["subagent dashboard"],
    answer: "Subagent Dashboard has:\n- Overview, Buy Data, Bulk Orders\n- Store Prices, Sub-Subagents\n- AFA, Flyer Generator\n- Withdrawals, API Key, Settings",
    category: "dashboard"
  },

  // Storefronts
  {
    questions: ["storefront", "sell online"],
    answer: "Your storefront is your online shop:\n- Customers see your packages\n- Buy directly from you\n- You get the profit\n- Customizable branding\n- Real-time sales\n\nShare your storefront link!",
    category: "storefront"
  },

  // Payments & Withdrawals
  {
    questions: ["withdraw", "cash out", "get money"],
    answer: "To withdraw:\n1. Go to Withdrawals\n2. Enter amount (minimum GHC15)\n3. Choose method (Mobile Money, Bank, Wallet)\n4. Add recipient\n5. Confirm\n6. Money arrives in <2 minutes",
    category: "withdrawal"
  },
  {
    questions: ["minimum withdraw", "min amount"],
    answer: "Minimum withdrawal: GHC15. You can withdraw anytime, no maximum limit.",
    category: "withdrawal"
  },
  {
    questions: ["withdrawal speed", "how fast"],
    answer: "Withdrawals process in less than 2 minutes. Money goes to your account almost instantly!",
    category: "withdrawal"
  },

  // API
  {
    questions: ["api", "api key"],
    answer: "API Key is in your dashboard under Settings. Use it to integrate our services. APIs let you:\n- Fetch packages\n- Create orders\n- Check status\n- Manage prices\n\nCheck documentation for details.",
    category: "api"
  },

  // Order Tracking
  {
    questions: ["track order", "where order"],
    answer: "To track your order: I can help! Please enter your phone number and I'll find your order and show status.",
    category: "tracking"
  },

  // Store Features
  {
    questions: ["set prices", "store prices", "price setting"],
    answer: "In your dashboard:\n1. Click Store Prices\n2. Select package\n3. Set your price\n4. Save\n\nYou control all prices!",
    category: "features"
  },
  {
    questions: ["flyer generator", "make flyer"],
    answer: "Flyer Generator is in your dashboard:\n1. Click Flyer Generator\n2. Customize design\n3. Add prices/info\n4. Download\n5. Share for marketing",
    category: "features"
  },
  {
    questions: ["bulk order", "buy bulk"],
    answer: "Buy bundles in bulk:\n1. Go to Buy Data\n2. Click Bulk Orders\n3. Enter quantity\n4. Get discount\n5. Pay\n6. Resell for profit!",
    category: "features"
  },
  {
    questions: ["voucher", "gift code"],
    answer: "Vouchers are gift codes:\n1. Create from dashboard\n2. Set amount\n3. Share code\n4. Customer redeems\n5. They get data\n\nPerfect for gifts!",
    category: "features"
  },

  // Packages offline
  {
    questions: ["offline", "why offline", "package offline"],
    answer: "Packages go offline when:\n- Network maintenance\n- High demand\n- System issues\n\nThey come back online automatically. Check back soon!",
    category: "support"
  },

  // General
  {
    questions: ["networks", "which networks"],
    answer: "Supported networks:\n✓ MTN\n✓ AirtelTigo\n✓ Telecel\n\nAll with multiple sizes and fast delivery.",
    category: "general"
  },
  {
    questions: ["help", "support", "question"],
    answer: "I'm here to help! Ask me anything about:\n- Packages, AFA, Agents\n- Dashboards, Storefronts\n- APIs\n- Any feature on the platform\n\nWhat would you like to know?",
    category: "support"
  }
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
  "Check AFA status (*1848#)"
];

export function findAnswer(userQuestion: string): { answer: string; category: string } | null {
  const cleanQuestion = userQuestion.toLowerCase().trim();

  // Exact match
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const question of entry.questions) {
      if (cleanQuestion === question) {
        return { answer: entry.answer, category: entry.category };
      }
    }
  }

  // Keyword match
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const question of entry.questions) {
      if (cleanQuestion.includes(question)) {
        return { answer: entry.answer, category: entry.category };
      }
      const words = question.split(' ').filter(w => w.length > 2);
      if (words.some(word => cleanQuestion.includes(word))) {
        return { answer: entry.answer, category: entry.category };
      }
    }
  }

  // Fuzzy match
  const userWords = cleanQuestion.split(' ').filter(w => w.length > 2);
  let bestMatch = null;
  let bestScore = 0;

  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const question of entry.questions) {
      const matches = userWords.filter(word => question.includes(word)).length;
      if (matches > bestScore) {
        bestScore = matches;
        bestMatch = entry;
      }
    }
  }

  return bestScore >= 1 && bestMatch ? { answer: bestMatch.answer, category: bestMatch.category } : null;
}
