/**
 * COMPREHENSIVE CHATBOT KNOWLEDGE BASE
 * Contains ALL information about the platform
 * Includes: buttons, features, APIs, dashboards, storefronts, and more
 */

interface KnowledgeEntry {
  questions: string[];
  answer: string;
  category: string;
}

export const CHATBOT_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ============================================
  // GREETING & GENERAL
  // ============================================
  {
    questions: ["hello", "hi", "hey", "greetings", "welcome"],
    answer: "Hello! I'm your chatbot assistant. I'm here to help you with any questions about our platform. Ask me about data packages, agent programs, AFA, dashboards, storefronts, APIs, features, or anything else you're curious about. If you don't understand something, just ask!",
    category: "greeting"
  },
  {
    questions: ["what can you help", "what do you do", "capabilities", "help"],
    answer: "I can answer questions about:\n\n📦 Data Packages & Pricing\n👨‍🌾 AFA Program & Registration\n🤝 Agent Program (Agent, Subagent, Subsubagent)\n🏪 Storefronts (Agent, Subagent, Subsubagent)\n📊 Dashboards & Features\n💰 Withdrawals & Payments\n🔌 API & Integration\n🎯 All Buttons & Features\n📍 Order Tracking\n💬 FAQs & More\n\nJust ask any question you have!",
    category: "general"
  },

  // ============================================
  // DATA PACKAGES
  // ============================================
  {
    questions: ["data packages", "available packages", "what packages", "data available"],
    answer: "Click the 'Show Available Packages' button to see all current data packages grouped by network (MTN, AirtelTigo, Telecel). The list updates in real-time based on what's currently available.",
    category: "packages"
  },
  {
    questions: ["buy data", "purchase data", "how to buy"],
    answer: "Step-by-step:\n\n1. Go to Packages page\n2. Select your network (MTN, AirtelTigo, or Telecel)\n3. Choose package size\n4. Click buy\n5. Choose payment method (Mobile Money, Bank, Card)\n6. Complete payment\n7. Data delivered to your phone within 2 hours",
    category: "packages"
  },
  {
    questions: ["delivery time", "how long", "instant", "when delivered"],
    answer: "Data delivery takes 5-120 minutes depending on network conditions. Without network issues, it's usually delivered within 2 hours. You'll see your data balance updated on your phone once it arrives.",
    category: "packages"
  },

  // ============================================
  // AFA PROGRAM
  // ============================================
  {
    questions: ["afa", "what is afa", "agricultural financing"],
    answer: "AFA (Agricultural Financing and Assurance) is a government-supported program for data access. You don't have to be a farmer to register - anyone can join!\n\nCost: GH₵15 one-time registration fee\nApproval: 24-72 hours\nCheck status: Dial *1848# on MTN\n\nBenefits: Affordable data, community support, farming resources.",
    category: "afa"
  },
  {
    questions: ["afa register", "how to register afa", "afa registration"],
    answer: "Registration steps:\n\n1. Click 'AFA Bundles'\n2. Click 'Register for AFA'\n3. Fill out form with your details\n4. Pay GH₵15 registration fee\n5. Wait 24-72 hours for MTN approval\n6. Receive SMS confirmation\n7. Access AFA bundles\n\nCheck approval status: Dial *1848#",
    category: "afa"
  },
  {
    questions: ["afa approval", "how long afa", "afa time"],
    answer: "AFA approval takes 24-72 hours. MTN reviews your registration and sends an SMS when approved.\n\nTo check your status: Dial *1848# on MTN\n\nKeep your phone available during approval. If no approval after 72 hours, contact support.",
    category: "afa"
  },
  {
    questions: ["afa fee", "afa cost", "how much afa"],
    answer: "AFA registration fee: GH₵15 (one-time)\n\nThis includes:\n✓ Full registration\n✓ MTN verification\n✓ Access to AFA bundles\n✓ All community benefits\n\nNo additional fees after registration.",
    category: "afa"
  },
  {
    questions: ["afa farmer", "do i need to be farmer", "who can register afa"],
    answer: "You don't have to be a farmer to register for AFA! Anyone can join, whether you farm or not. The program is open to everyone.",
    category: "afa"
  },
  {
    questions: ["*1848", "ussd", "dial", "check afa status"],
    answer: "To check your AFA approval status:\n\n1. Dial *1848# on MTN\n2. Follow the prompts\n3. You'll see your status\n\nDo this if you're waiting for approval or want to check anytime.",
    category: "afa"
  },

  // ============================================
  // AGENT PROGRAM
  // ============================================
  {
    questions: ["become agent", "how to be agent", "agent program"],
    answer: "How to become an agent:\n\n1. Click 'Become an Agent' button\n2. Fill registration form\n3. Verify phone number\n4. Wait 24-48 hours approval\n5. Login to Agent Dashboard\n6. Start selling data!\n\nNo startup cost. You earn commission on every sale.",
    category: "agent"
  },
  {
    questions: ["agent commission", "how much earn", "profit"],
    answer: "Agent earnings work like this:\n\nYou get prices from us, you set your own prices:\n- Example: We give 1GB for GH₵3.90\n- You set price at GH₵4.90\n- Your profit: GH₵1.00\n\nCommission tiers:\n✓ Starter: 5% (from day 1)\n✓ Regular: 7.5% (after 100 sales)\n✓ Elite: 10% (500+ monthly sales)\n\nYou control prices and keep all profit!",
    category: "agent"
  },
  {
    questions: ["subagent", "create subagent", "recruit agent"],
    answer: "Subagent program:\n\n1. Go to your Agent Dashboard\n2. Click 'Subagents' section\n3. Click 'Create Subagent'\n4. Enter their details\n5. They can start selling\n6. You earn commission on their sales too!\n\nYou can have unlimited subagents.",
    category: "agent"
  },
  {
    questions: ["subsubagent", "subagent subagent"],
    answer: "Subagents can also create their own subagents (called subsubagents):\n\n1. Subagent goes to their dashboard\n2. Clicks 'Subagents'\n3. Creates subsubagent\n4. They earn commission\n5. You earn commission on their earnings too!\n\nBuild multiple levels!",
    category: "agent"
  },

  // ============================================
  // DASHBOARDS & FEATURES
  // ============================================
  {
    questions: ["agent dashboard", "what is agent dashboard", "dashboard features"],
    answer: "Agent Dashboard includes:\n\n📊 Overview - Your stats\n📦 Buy Data - Purchase bundles\n🛒 Bulk Orders - Buy in bulk\n💲 Store Prices - Set your prices\n🤝 Subagents - Manage your team\n👨‍🌾 AFA - Manage AFA registrations\n🖼️ Flyer Generator - Make marketing flyers\n💸 Withdrawals - Cash out earnings\n🔌 API Key - For integrations\n⚙️ Settings - Account settings\n\nEverything you need to run your business!",
    category: "dashboard"
  },
  {
    questions: ["subagent dashboard", "what is subagent dashboard"],
    answer: "Subagent Dashboard includes:\n\n📊 Overview - Your stats\n📦 Buy Data - Purchase bundles\n🛒 Bulk Orders - Buy in bulk\n💲 Store Prices - Set your prices\n🤝 Sub-Subagents - Create your team\n👨‍🌾 AFA - Manage AFA registrations\n🖼️ Flyer Generator - Make marketing flyers\n💸 Withdrawals - Cash out earnings\n🔌 API Key - For integrations\n⚙️ Settings - Account settings\n\nManage your business and subagents!",
    category: "dashboard"
  },
  {
    questions: ["subsubagent dashboard"],
    answer: "Subsubagent Dashboard includes:\n\n📊 Overview - Your stats\n📦 Buy Data - Purchase bundles\n🛒 Bulk Orders - Buy in bulk\n💲 Store Prices - Set your prices\n🤝 Manage Team - Create more subagents\n👨‍🌾 AFA - Manage AFA registrations\n🖼️ Flyer Generator - Make marketing flyers\n💸 Withdrawals - Cash out earnings\n🔌 API Key - For integrations\n⚙️ Settings - Account settings\n\nRun your business with full features!",
    category: "dashboard"
  },

  // ============================================
  // STOREFRONTS
  // ============================================
  {
    questions: ["agent storefront", "what is storefront", "sell online"],
    answer: "Agent Storefront is your online shop:\n\n✓ Customers visit your unique URL\n✓ See packages and prices you set\n✓ Buy directly from you\n✓ You get the profit\n✓ Customizable with your branding\n✓ Real-time sales updates\n✓ Built-in payment processing\n\nShare your storefront link and start earning!",
    category: "storefront"
  },
  {
    questions: ["subagent storefront"],
    answer: "Subagent Storefront:\n\n✓ Your own online shop\n✓ Customers buy from you\n✓ You keep the profit\n✓ Can have your own subagents buying from you\n✓ Customizable design\n✓ Real-time orders\n✓ Easy to manage\n\nYour personal business storefront!",
    category: "storefront"
  },
  {
    questions: ["store prices", "set prices", "manage prices"],
    answer: "To set your prices:\n\n1. Go to Dashboard\n2. Click 'Store Prices' or 'Bulk Orders'\n3. Set price for each package\n4. Our cost is the base, your markup is profit\n5. Save changes\n6. Prices update on your storefront\n\nYou control all prices!",
    category: "storefront"
  },

  // ============================================
  // API & INTEGRATION
  // ============================================
  {
    questions: ["api", "api key", "integration", "developer"],
    answer: "API Integration:\n\nWe provide an API for developers to:\n✓ Automate purchases\n✓ Check order status\n✓ Manage inventory\n✓ Integrate with your system\n\nTo get API key:\n1. Go to Dashboard\n2. Click 'API Key'\n3. Click 'Generate API Key'\n4. Copy your key\n5. Use in your app\n\nKey format: pk_live_[random]\n\nContact support for API documentation.",
    category: "api"
  },
  {
    questions: ["how to use api", "api documentation", "api endpoints"],
    answer: "API allows you to:\n\n1. Make purchases programmatically\n2. Check order status\n3. Get available packages\n4. Manage your account\n5. Integrate with your system\n\nEndpoints available:\n- POST /api/purchase - Buy data\n- GET /api/orders - View orders\n- GET /api/packages - List packages\n- POST /api/withdraw - Request withdrawal\n\nGet full docs from Dashboard → API Key section.",
    category: "api"
  },

  // ============================================
  // WITHDRAWALS & PAYMENTS
  // ============================================
  {
    questions: ["withdrawal", "withdraw", "cash out", "how to withdraw"],
    answer: "How to withdraw:\n\n1. Go to Dashboard\n2. Click 'Withdrawals'\n3. Enter amount (minimum GH₵15)\n4. Choose payment method:\n   - Mobile Money\n   - Bank Transfer\n   - Wallet\n5. Confirm\n6. Money arrives in <2 minutes\n\nYou can withdraw unlimited times!",
    category: "withdrawal"
  },
  {
    questions: ["minimum withdrawal", "min amount"],
    answer: "Minimum withdrawal: GH₵15\n\nYou can withdraw:\n✓ GH₵15 or more\n✓ Any amount\n✓ Unlimited times\n✓ To mobile money, bank, or wallet\n✓ Processed in <2 minutes",
    category: "withdrawal"
  },
  {
    questions: ["withdrawal time", "how fast", "processing time"],
    answer: "Withdrawal processing:\n\nTime: Less than 2 minutes\n\nProcess:\n1. You request withdrawal\n2. We process: <1 min\n3. Payment provider confirms: <1 min\n4. Money in your account: <2 min total\n\nFastest payouts in the industry!",
    category: "withdrawal"
  },
  {
    questions: ["payment method", "payment", "how to pay"],
    answer: "Payment methods accepted:\n\nTo purchase:\n✓ Mobile Money (MTN, Vodafone, AirtelTigo)\n✓ Bank Transfer\n✓ Debit/Credit Card\n✓ Digital Wallet\n\nAll payments:\n✓ Encrypted & secure\n✓ Instant processing\n✓ Verified\n✓ Safe\n\nChoose at checkout!",
    category: "payment"
  },

  // ============================================
  // FEATURES & BUTTONS
  // ============================================
  {
    questions: ["bulk orders", "what is bulk", "buy in bulk"],
    answer: "Bulk Orders feature:\n\nBuy large quantities at better rates:\n\n1. Go to Dashboard\n2. Click 'Bulk Orders'\n3. Select packages and quantities\n4. Get bulk discount\n5. Purchase\n6. Resell at your prices\n\nPerfect for:\n✓ Retailers\n✓ Corporate offices\n✓ Organizations\n✓ Agents buying stock",
    category: "features"
  },
  {
    questions: ["flyer generator", "marketing flyer", "create flyer"],
    answer: "Flyer Generator tool:\n\nCreate marketing flyers for social media:\n\n1. Go to Dashboard\n2. Click 'Flyer Generator'\n3. Choose design template\n4. Add your prices\n5. Customize colors/text\n6. Download as image\n7. Share on WhatsApp, Facebook, etc.\n\nFree tool to promote your business!",
    category: "features"
  },
  {
    questions: ["order tracking", "track order", "where is my order"],
    answer: "To track your order:\n\n1. Click 'Track Order' button in chat (or on homepage)\n2. Enter your phone number\n3. I'll find your latest order\n4. You'll see:\n   - Order ID\n   - Network\n   - Size\n   - Amount\n   - Status\n   - Delivery Status\n   - Date\n\nJust ask me to track!",
    category: "features"
  },
  {
    questions: ["voucher", "gift voucher", "prepaid code"],
    answer: "Vouchers (Gift Codes):\n\n1. Buy a voucher from us (any amount)\n2. Get unique code\n3. Share with friend/family\n4. They redeem for data\n5. They get instant data\n\nUses:\n✓ Gift to friends\n✓ Family data\n✓ Emergency bundles\n✓ Any occasion\n\nEasy to share via SMS/WhatsApp!",
    category: "features"
  },
  {
    questions: ["offline package", "why offline", "package not available"],
    answer: "When packages show offline:\n\nReasons:\n✓ Server maintenance\n✓ Network stability issues\n✓ High demand\n✓ Temporary interruption\n\nWhat to do:\n1. Try other packages\n2. Check back in 5 minutes\n3. Try different network\n4. Contact support if persists\n\nWe fix these quickly!",
    category: "features"
  },

  // ============================================
  // ACCOUNT & SETTINGS
  // ============================================
  {
    questions: ["settings", "account", "profile", "change password"],
    answer: "Account Settings:\n\nIn Dashboard, click 'Settings' to:\n✓ Update profile info\n✓ Change password\n✓ Manage security\n✓ Set preferences\n✓ View account details\n✓ Manage notifications\n\nKeep your account secure!",
    category: "account"
  },
  {
    questions: ["two factor", "security", "safe account"],
    answer: "Account security:\n\n✓ Encrypted passwords\n✓ Secure login\n✓ Session management\n✓ Activity logs\n✓ Withdrawal verification\n✓ API key protection\n\nBest practices:\n- Don't share password\n- Use strong passwords\n- Enable notifications\n- Monitor activity\n\nContact support if suspicious activity!",
    category: "account"
  },

  // ============================================
  // SUPPORT & HELP
  // ============================================
  {
    questions: ["support", "help", "contact", "issue"],
    answer: "Get help:\n\n✓ Ask me (chatbot) any question\n✓ I can answer about all features\n✓ I can track your orders\n✓ I can show packages\n✓ I can explain anything\n\nIf you don't understand something, just ask!\n\n24/7 available to help.",
    category: "support"
  },
  {
    questions: ["bug", "error", "problem", "not working"],
    answer: "Having an issue?\n\n1. Try refreshing page\n2. Clear browser cache\n3. Try different browser\n4. Check internet connection\n5. Restart device\n\nIf still not working:\nDescribe the issue and I'll help troubleshoot or connect you with support team.",
    category: "support"
  },
  {
    questions: ["complaint", "report", "issue report"],
    answer: "Report an issue:\n\n1. Go to Dashboard\n2. Click 'Complaints' (if agent)\n3. Describe your issue\n4. Provide details\n5. Submit\n6. We investigate and respond\n\nOr ask me to help!",
    category: "support"
  },

  // ============================================
  // GENERAL INFO
  // ============================================
  {
    questions: ["how it works", "overview", "platform"],
    answer: "How the platform works:\n\n1. Sign up as user or agent\n2. Browse packages\n3. Make purchases\n4. Get data delivered to phone\n5. If agent: set prices, manage store, earn commission\n6. Withdraw earnings anytime\n\nFull features:\n✓ Real-time packages\n✓ Instant payments\n✓ Fast delivery\n✓ Easy withdrawals\n✓ API access\n✓ Full dashboard",
    category: "general"
  },
  {
    questions: ["network", "which networks", "mtn airtel telecel"],
    answer: "Supported networks:\n\n✓ MTN - Full range of bundles\n✓ AirtelTigo - Multiple packages\n✓ Telecel - Competitive rates\n\nAll networks with:\n- Multiple sizes\n- Competitive prices\n- Fast delivery\n- Real-time availability\n\nCheck Packages page for current offerings!",
    category: "general"
  },
];

// ============================================
// FREQUENTLY ASKED QUESTIONS FOR UI
// ============================================

export const FREQUENT_QUESTIONS = [
  "Show Available Packages",
  "How do I buy data?",
  "How do I track my order?",
  "How long does delivery take?",
  "What is AFA?",
  "How do I register for AFA?",
  "What is the AFA approval time?",
  "Check AFA status (*1848#)",
  "How do I become an agent?",
  "How much commission do agents earn?",
  "What is a subagent?",
  "How do I withdraw money?",
  "What is the minimum withdrawal?",
  "How fast are withdrawals?",
  "What is the API?",
  "How do I set my prices?",
  "What is a Flyer Generator?",
  "What are bulk orders?",
  "What is a voucher?",
  "Why are packages offline?",
];

// ============================================
// SMART QUESTION MATCHING
// ============================================

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

  // Keyword matching - improved for better understanding
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const question of entry.questions) {
      // Check if user question contains the question keyword
      if (cleanQuestion.includes(question)) {
        return { answer: entry.answer, category: entry.category };
      }
      // Check if any word from entry question is in user question
      const questionWords = question.split(' ').filter(w => w.length > 2);
      if (questionWords.some(word => cleanQuestion.includes(word))) {
        return { answer: entry.answer, category: entry.category };
      }
    }
  }

  // Fuzzy matching - find partial matches
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

  if (bestScore >= 1) {
    return { answer: bestMatch!.answer, category: bestMatch!.category };
  }

  return null;
}
