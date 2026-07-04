/**
 * COMPREHENSIVE CHATBOT KNOWLEDGE BASE
 * Contains ALL information from Agent Dashboard, Subagent Dashboard, Subsubagent Dashboard,
 * Agent Storefront, Subagent Storefront, and all service information
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
    answer: "Hello! How can I help you today? I can answer questions about buying data, tracking orders, agent programs, withdrawals, AFA registration, and more.",
    category: "greeting"
  },

  // ============================================
  // DATA PACKAGES & PRICING
  // ============================================
  {
    questions: ["available packages", "data packages", "which packages", "what packages"],
    answer: "We have data packages for MTN, AirtelTigo, and Telecel. Sizes range from 1GB to 100GB with varying prices. Click 'Show Available Packages' to see current prices and availability.",
    category: "packages"
  },
  {
    questions: ["price", "cost", "how much", "pricing"],
    answer: "Prices vary by network and package size. Click 'Show Available Packages' button to see exact current prices for all networks (MTN, AirtelTigo, Telecel).",
    category: "packages"
  },

  // ============================================
  // ORDER TRACKING
  // ============================================
  {
    questions: ["track", "order status", "where order", "check order", "tracking", "track this order", "track order for me"],
    answer: "I can help track your order! Please provide your phone number so I can find your order details.",
    category: "orders"
  },
  {
    questions: ["data not received", "no data", "data missing", "didn't get data"],
    answer: "If you don't receive data within 2 hours, please contact support via WhatsApp. They can resolve it immediately.",
    category: "orders"
  },

  // ============================================
  // PAYMENT METHODS
  // ============================================
  {
    questions: ["payment", "payment method", "how to pay", "accept"],
    answer: "We accept: Mobile Money (MTN, Vodafone, AirtelTigo), Bank Transfers, Card Payments, and Wallet transfers. All payments are secure and encrypted.",
    category: "payment"
  },
  {
    questions: ["safe", "secure", "payment secure", "safety"],
    answer: "Yes, all payments are 100% safe. We use 256-bit SSL encryption, PCI DSS certification, and Paystack gateway for security.",
    category: "payment"
  },
  {
    questions: ["refund", "money back", "failed payment"],
    answer: "Failed transactions automatically refund within 24-48 hours. Check your payment history or contact support if not refunded.",
    category: "payment"
  },

  // ============================================
  // WITHDRAWAL & AGENT EARNINGS
  // ============================================
  {
    questions: ["withdraw", "withdrawal", "cash out", "get paid", "how to withdraw"],
    answer: "To withdraw earnings:\n1. Go to your Dashboard\n2. Click 'Withdraw'\n3. Enter amount (minimum GH₵15)\n4. Select payment method (Mobile Money, Bank, Wallet)\n5. Confirm - money arrives in your account\n\nMinimum withdrawal: GH₵15",
    category: "withdrawal"
  },
  {
    questions: ["minimum withdrawal", "min withdraw", "lowest withdrawal"],
    answer: "Minimum withdrawal amount is GH₵15. You can withdraw anytime with no maximum limit.",
    category: "withdrawal"
  },

  // ============================================
  // AGENT PROGRAM
  // ============================================
  {
    questions: ["become agent", "agent program", "how to become agent", "join agent", "start as agent"],
    answer: "To become an agent:\n1. Click 'Become an Agent' button\n2. Fill out registration form\n3. Verify your phone number\n4. Wait for approval (24-48 hours)\n5. Start selling!\n\nNo startup cost - completely FREE to register!",
    category: "agent"
  },
  {
    questions: ["agent commission", "how much earn", "agent profit", "agent earnings"],
    answer: "Agent Commission Structure:\n\nYou buy at cost price, set your own selling price, keep the difference as profit.\n\nExample:\n- You buy 1GB for GH₵3.90\n- You set price at GH₵4.90\n- You make GH₵1.00 profit per sale\n\nLevels:\n- Starter: 5% discount (from day 1)\n- Regular: 7.5% discount (100+ sales)\n- Elite: 10% discount (500+ monthly sales)",
    category: "agent"
  },
  {
    questions: ["agent benefits", "why be agent", "agent advantages"],
    answer: "Agent Benefits:\n✓ Set your own prices and profit margins\n✓ 24/7 customer support\n✓ Marketing materials provided\n✓ Sales dashboard with analytics\n✓ Can create subagents and earn from their sales\n✓ Your own custom storefront\n✓ Multiple ways to sell (SMS, WhatsApp, storefront)",
    category: "agent"
  },

  // ============================================
  // SUBAGENT PROGRAM
  // ============================================
  {
    questions: ["subagent", "create subagent", "recruit subagent", "sub agent"],
    answer: "Subagent Program:\n\nCreate subagents who sell data for you:\n1. Go to your Dashboard\n2. Click 'Subagents'\n3. Register new subagent\n4. They get their dashboard and storefront\n5. You earn commission on ALL their sales\n\nUnlimited subagents = unlimited passive income!",
    category: "agent"
  },

  // ============================================
  // AGENT DASHBOARD FEATURES
  // ============================================
  {
    questions: ["dashboard", "agent dashboard", "what is dashboard", "dashboard menu"],
    answer: "Agent Dashboard has these sections:\n\n📊 Overview - Sales stats, wallet balance, recent orders\n🛒 Buy Data - Purchase for customers from your wallet\n📦 Bulk Orders - Send to multiple people at once\n🏪 Store Prices - Set your own package prices\n👥 Subagents - Create and manage subagents\n💳 Subagent Prices - Set subagent commission rates\n⚡ AFA Bundles - Register and manage AFA customers\n🖼️ Flyer Generator - Create marketing flyers\n💰 Withdraw - Cash out your earnings\n⬆️ Top Up - Add money to your wallet\n🔑 API Key - Integrate with other systems\n🎨 Appearance - Customize your storefront\n📢 Notifications - Set up alerts\n📋 Complaints - Manage customer complaints\n⚙️ Settings - Account settings",
    category: "agent"
  },
  {
    questions: ["buy data", "purchase data", "how to buy data in dashboard"],
    answer: "Buy Data from Dashboard:\n1. Check wallet balance (top up if needed)\n2. Select network tab (MTN, AirtelTigo, Telecel)\n3. Tap a package\n4. Enter recipient's phone number\n5. Confirm payment\n\nPayment options: Wallet (instant), Paystack (small fee)\n\nNote: 10-minute cooldown per phone to prevent duplicates",
    category: "agent"
  },
  {
    questions: ["bulk orders", "send multiple", "mass send", "bulk send"],
    answer: "Bulk Orders - Send to multiple people at once:\n1. Select network (MTN, AirtelTigo, Telecel)\n2. Upload CSV/Excel file with phone numbers OR type manually\n3. Choose package size\n4. Confirm\n5. System sends to all at once\n\nPerfect for: Schools, offices, events, businesses",
    category: "agent"
  },
  {
    questions: ["store prices", "set prices", "change prices", "pricing"],
    answer: "Store Prices - Set your own package prices:\n1. Go to Dashboard → Store Prices\n2. For each network (MTN, AirtelTigo, Telecel):\n   - See the cost price\n   - Set YOUR selling price\n   - Keep the difference as profit\n3. Save changes\n\nYour prices show on your storefront automatically",
    category: "agent"
  },
  {
    questions: ["wallet", "wallet balance", "topup", "add money"],
    answer: "Wallet - Your money account:\n- Used to buy data for customers\n- Must have funds before buying\n- Top up to add money\n- Can withdraw earnings anytime (minimum GH₵15)\n- Balance shown at top of dashboard",
    category: "agent"
  },
  {
    questions: ["top up", "add funds", "fund wallet"],
    answer: "Top Up Your Wallet:\n1. Go to Dashboard → Top Up\n2. Enter amount\n3. Choose payment method (Mobile Money, Bank, Card, Paystack)\n4. Confirm\n5. Money added to wallet instantly\n\nUse this wallet to buy data for your customers",
    category: "agent"
  },
  {
    questions: ["api key", "integration", "api"],
    answer: "API Key - Integrate with other systems:\n1. Go to Dashboard → API Key\n2. Generate your unique API key\n3. Use to integrate with websites, apps, or bots\n4. Automate data sales\n5. Full documentation provided",
    category: "agent"
  },
  {
    questions: ["appearance", "customize", "theme", "colors", "storefront design"],
    answer: "Appearance - Customize your storefront:\n1. Go to Dashboard → Appearance\n2. Choose colors (primary, background, etc.)\n3. Set grid layout\n4. Customize text and headlines\n5. Preview changes live\n6. Save - applies to your storefront immediately",
    category: "agent"
  },
  {
    questions: ["complaints", "complaints management", "customer issue"],
    answer: "Complaints Management:\n1. Go to Dashboard → Complaints\n2. View all customer complaints\n3. Respond to each complaint\n4. Mark as resolved\n5. Keep customers happy!",
    category: "agent"
  },

  // ============================================
  // SUBAGENT DASHBOARD (Subagent-specific)
  // ============================================
  {
    questions: ["subagent dashboard", "my subagent dashboard", "subagent panel"],
    answer: "As a Subagent, you have a similar dashboard to Agents with features to:\n- Buy data for customers\n- View your earnings\n- Manage Sub-Subagents (create teams)\n- Set your own store prices\n- Generate flyers\n- Withdraw your earnings\n- Customize your storefront\n\nYou earn from every sale, plus commissions from your Sub-Subagents!",
    category: "subagent"
  },
  {
    questions: ["subsubagent", "sub-subagent", "sub sub agent", "recruit team"],
    answer: "Sub-Subagent Program (For Subagents):\n\nAs a subagent, you can create Sub-Subagents:\n1. Go to your Dashboard\n2. Click 'Sub-Subagents'\n3. Register new person\n4. They become your sub-subagent\n5. You earn commission on their sales\n\nThis creates a 3-level earning structure!",
    category: "subagent"
  },

  // ============================================
  // SUBSUBAGENT DASHBOARD
  // ============================================
  {
    questions: ["subsubagent dashboard", "sub-subagent dashboard"],
    answer: "As a Sub-Subagent, you have full dashboard features:\n- Buy and sell data\n- View earnings\n- Withdraw money\n- Customize storefront\n- Set your own prices\n- Get 24/7 support\n\nYou're part of a earning network - your superiors benefit when you sell!",
    category: "subsubagent"
  },

  // ============================================
  // STOREFRONTS
  // ============================================
  {
    questions: ["storefront", "agent storefront", "my store", "store page"],
    answer: "Your Storefront - Your personal sales page:\n\nEach agent/subagent gets a custom storefront showing:\n- Your store name\n- All your data packages with YOUR prices\n- Contact info (WhatsApp, support)\n- Customized colors and design\n- AFA registration option\n- Easy checkout process\n\nShare your storefront link to start selling!",
    category: "storefront"
  },

  // ============================================
  // AFA PROGRAM
  // ============================================
  {
    questions: ["afa", "what is afa", "afa bundles", "afa program"],
    answer: "AFA (Agricultural Financing) - Special data program:\n\nNOTE: You don't have to be a farmer to register!\n\n✓ Anyone can register (farmer or not)\n✓ Get affordable data bundles\n✓ Registration fee: GH₵15 (one-time)\n✓ Approval takes 24-72 hours\n✓ Check status: Dial *1848# USSD code\n\nPerfect for anyone wanting cheaper data bundles!",
    category: "afa"
  },
  {
    questions: ["afa registration", "register afa", "afa sign up"],
    answer: "AFA Registration (GH₵15 fee):\n\n1. Visit AFA Bundles section\n2. Click 'Register for AFA'\n3. Fill form (name, phone, region, any info)\n4. Pay GH₵15\n5. Wait 24-72 hours for approval\n6. Check status: Dial *1848#\n\nYou DON'T have to be a farmer!",
    category: "afa"
  },
  {
    questions: ["afa approval", "how long afa", "afa time", "24 to 72"],
    answer: "AFA Approval Timeline:\n\n⏱️ Approval time: 24-72 hours\n\n📱 Check status:\n- Dial *1848# on your phone\n- System shows your approval status in real-time\n- Usually approved within 48 hours\n\n✓ Once approved, activate your AFA bundles immediately!",
    category: "afa"
  },
  {
    questions: ["afa fee", "afa cost", "afa price", "registration fee"],
    answer: "AFA Registration Fee: GH₵15 (One-Time)\n\nIncludes:\n✓ AFA membership\n✓ Access to AFA bundles\n✓ Special pricing\n✓ Network verification\n\nPayment: Mobile Money, Bank, Card, Wallet",
    category: "afa"
  },
  {
    questions: ["afa ussd", "*1848#", "check afa status", "afa dial"],
    answer: "Check AFA Status: Dial *1848#\n\nHow to check your AFA approval status:\n1. Open your phone dialer\n2. Dial: *1848#\n3. Press Call\n4. System shows your AFA status instantly\n5. See if approved or pending\n\nThis USSD code works anytime, anywhere!",
    category: "afa"
  },

  // ============================================
  // SUPPORT & CONTACT
  // ============================================
  {
    questions: ["support", "contact", "help", "customer service"],
    answer: "24/7 Support Available:\n\n📞 WhatsApp - Best option for instant help\n- Click WhatsApp button on site\n- Average response: 5 minutes\n- Available anytime\n\n📋 What to include:\n- Your phone number\n- Order ID (if applicable)\n- Description of issue\n\nWe're always here to help!",
    category: "support"
  },

  // ============================================
  // OFFLINE PACKAGES
  // ============================================
  {
    questions: ["offline", "package offline", "why offline", "unavailable"],
    answer: "Why Packages Go Offline:\n\nPackages show as offline when:\n✓ Server maintenance in progress\n✓ Network operator having issues\n✓ High demand overload\n✓ Payment gateway delays\n✓ Temporary system updates\n\nWhat to do:\n1. Check other available packages\n2. Try again in a few minutes\n3. Contact support if persists\n\nWe fix these quickly!",
    category: "packages"
  },

  // ============================================
  // USSD CODE GENERAL
  // ============================================
  {
    questions: ["ussd", "what is ussd", "*"],
    answer: "USSD Code (*1848#) - Check AFA Status:\n\nUSSD (Unstructured Supplementary Service Data) is a quick dial code:\n- No internet needed\n- Works on any phone\n- Instant response\n\n*1848# specifically checks your AFA approval status from MTN network",
    category: "support"
  },

  // ============================================
  // GENERAL FAQ
  // ============================================
  {
    questions: ["how it works", "explain service", "about"],
    answer: "How Our Service Works:\n\n📦 3 Easy Steps:\n1. Choose package (MTN, AirtelTigo, Telecel)\n2. Pay securely (Mobile Money, Bank, Card, Wallet)\n3. Get data in 2 hours or less\n\n🎯 Extra Features:\n- Agent program (earn commissions)\n- Subagent recruitment\n- AFA for cheaper bundles\n- Withdraw anytime (min GH₵15)",
    category: "general"
  },
];

export const FREQUENT_QUESTIONS = [
  "Show Available Packages",
  "How do I buy data?",
  "Track my order by phone",
  "What payment methods do you accept?",
  "How long does delivery take?",
  "How do I become an agent?",
  "How much commission do agents earn?",
  "How do I withdraw my earnings?",
  "What is the minimum withdrawal amount?",
  "Can I create subagents?",
  "What is AFA?",
  "How do I register for AFA?",
  "How long does AFA approval take?",
  "What is the AFA registration fee?",
  "Why do packages go offline?",
  "Is payment safe?",
  "How can I contact support?",
  "What is my dashboard?",
  "How do I set my store prices?",
  "What is a storefront?",
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

  // Keyword matching
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const question of entry.questions) {
      if (cleanQuestion.includes(question)) {
        return { answer: entry.answer, category: entry.category };
      }
    }
  }

  // Partial word matching
  const words = cleanQuestion.split(' ').filter(w => w.length > 2);
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const question of entry.questions) {
      const matches = words.filter(word => question.includes(word)).length;
      if (matches >= 1) {
        return { answer: entry.answer, category: entry.category };
      }
    }
  }

  return null;
}
