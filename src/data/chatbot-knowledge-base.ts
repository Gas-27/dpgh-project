/**
 * COMPREHENSIVE CHATBOT KNOWLEDGE BASE
 * Contains all accurate information about DataPlug.Store
 * Updated: AFA 24-72 hours approval, Withdrawal GH₵16 & <2 minutes
 */

interface KnowledgeEntry {
  questions: string[];
  answer: string;
  category: string;
}

export const CHATBOT_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // Greeting
  {
    questions: ["hello", "hi", "hey", "greetings"],
    answer: "👋 Hello! Welcome to DataPlug.Store! I'm here to help with data packages, AFA bundles, agent program, and more. What can I help you with?",
    category: "greeting"
  },

  // DATA PACKAGES
  {
    questions: ["what packages", "data packages", "which packages"],
    answer: "We offer data packages for MTN, AirtelTigo, and Telecel networks in Ghana. Go to 'Packages' page to see exact prices and sizes. All packages include instant delivery!",
    category: "packages"
  },
  {
    questions: ["price", "cost", "how much"],
    answer: "Prices vary by network and package size. Visit the 'Packages' page to see all current prices for MTN, AirtelTigo, and Telecel. Prices are updated daily and competitive!",
    category: "packages"
  },
  {
    questions: ["mtn", "mtn data"],
    answer: "📱 MTN Data Packages - Go to 'Packages' page, select MTN, and see all available sizes and prices. Instant delivery!",
    category: "packages"
  },
  {
    questions: ["airtel", "airteltigo", "tigo"],
    answer: "📱 AirtelTigo Data Packages - Go to 'Packages' page, select AirtelTigo, and see all available sizes and prices. Instant delivery!",
    category: "packages"
  },
  {
    questions: ["telecel", "vodafone"],
    answer: "📱 Telecel Data Packages - Go to 'Packages' page, select Telecel, and see all available sizes and prices. Instant delivery!",
    category: "packages"
  },
  {
    questions: ["buy data", "purchase"],
    answer: "1. Go to 'Packages' page\n2. Choose network & size\n3. Pay (Mobile Money, Bank, Card)\n4. Get data instantly!\nNeed help? Contact WhatsApp support 24/7!",
    category: "packages"
  },
  {
    questions: ["delivery", "how long", "instant"],
    answer: "⚡ Data delivered in 30 seconds after payment! If delayed, wait 5-10 minutes. No data after 15 minutes? Contact WhatsApp support - we resolve in 2 minutes!",
    category: "packages"
  },

  // ORDER TRACKING
  {
    questions: ["track", "order status", "where order"],
    answer: "📍 Go to 'Track Your Order' on homepage. Enter your phone number or order ID to see status, delivery time, and details!",
    category: "orders"
  },
  {
    questions: ["data not received", "no data"],
    answer: "⚠️ Check balance, restart phone, wait 5 minutes. Still nothing? Contact WhatsApp support immediately with your phone number - we resolve in 2 minutes!",
    category: "orders"
  },

  // PAYMENT
  {
    questions: ["payment", "how to pay"],
    answer: "💳 We accept: Mobile Money (MTN, Vodafone, AirtelTigo), Bank Transfers, Card Payments. All payments are encrypted, secure, and processed instantly!",
    category: "payment"
  },
  {
    questions: ["safe", "secure"],
    answer: "🔒 100% Safe! 256-bit encryption, PCI DSS certified, Paystack gateway. 72K+ safe transactions, zero breaches. Your money is completely safe!",
    category: "payment"
  },
  {
    questions: ["refund", "money back"],
    answer: "💰 Failed transactions refund automatically in 24-48 hours. Check payment history. If not refunded, contact WhatsApp support with order ID and we resolve immediately!",
    category: "payment"
  },

  // AFA PROGRAM
  {
    questions: ["afa", "agricultural", "farmers"],
    answer: "👨‍🌾 AFA is a government program for farmers with subsidized data bundles. Get affordable data for farming knowledge. Approval in 24-72 hours! Click 'AFA Bundles' to register.",
    category: "afa"
  },
  {
    questions: ["afa registration", "register afa"],
    answer: "📋 1. Click 'AFA Bundles'\n2. Click 'Register for AFA'\n3. Fill form (name, phone, region, crop)\n4. Pay GH₵15\n5. Wait 24-72 hours for MTN approval\n6. Receive SMS & activate!\nKeep phone available during approval!",
    category: "afa"
  },
  {
    questions: ["afa approval", "how long afa", "72 hours"],
    answer: "⏱️ AFA Approval: 24-72 HOURS (usually 48 hours). You register, pay GH₵15, MTN reviews your application, you get SMS, data activated! Check SMS regularly. No approval after 72 hours? Contact us!",
    category: "afa"
  },
  {
    questions: ["afa fee", "afa cost"],
    answer: "💵 AFA Registration Fee: GH₵15 (one-time only). Includes full registration, MTN verification, and membership. Pay via Mobile Money, Bank, or Card.",
    category: "afa"
  },
  {
    questions: ["afa eligible", "who can afa"],
    answer: "✅ You need: 18+ years old, valid phone, actively farming, Ghana-based. Provide name, phone, region, crop type. All farmers welcome!",
    category: "afa"
  },

  // AGENT PROGRAM
  {
    questions: ["become agent", "agent program"],
    answer: "🤝 1. Click 'Become an Agent'\n2. Fill application\n3. Verify phone\n4. Wait 24-48 hours\n5. Start selling!\nNo startup cost! Earn 5-10% commission on every sale.",
    category: "agent"
  },
  {
    questions: ["commission", "how much earn"],
    answer: "💰 Starter: 5% (day 1)\nRegular: 7.5% (after 100+ sales)\nElite: 10% (500+ monthly sales)\nUnlimited earning potential!",
    category: "agent"
  },
  {
    questions: ["agent benefits", "why agent"],
    answer: "✓ Earn commission on every sale\n✓ Custom storefront\n✓ Sales dashboard\n✓ Create subagents\n✓ Earn on subagent sales\n✓ 24/7 support\n✓ No inventory costs\n✓ Unlimited earning!",
    category: "agent"
  },
  {
    questions: ["startup cost", "agent fee"],
    answer: "✅ NO STARTUP COST! FREE to register. No monthly fees, no hidden costs. Start selling immediately and earn commission!",
    category: "agent"
  },

  // WITHDRAWAL
  {
    questions: ["withdraw", "cash out", "get paid"],
    answer: "💸 1. Go to Withdrawals\n2. Enter amount (min GH₵16)\n3. Choose method (Mobile Money, Bank, Wallet)\n4. Select recipient\n5. Confirm\n6. Money arrives in LESS THAN 2 MINUTES!",
    category: "withdrawal"
  },
  {
    questions: ["minimum withdrawal", "min amount"],
    answer: "💵 Minimum: GH₵16. No maximum. Can withdraw anytime, unlimited times. Withdraw daily if you want!",
    category: "withdrawal"
  },
  {
    questions: ["withdrawal time", "how long withdraw", "less than 2 minutes"],
    answer: "⚡ LESS THAN 2 MINUTES! Money is in your account almost instantly. The fastest withdrawal in Ghana!",
    category: "withdrawal"
  },
  {
    questions: ["subagent", "create subagent"],
    answer: "🌳 Recruit someone to be your subagent. They sell data, you earn commission on their sales. Go to Agent Dashboard > Manage Subagents. Build a network and earn more!",
    category: "agent"
  },

  // BUTTONS & NAVIGATION
  {
    questions: ["button", "what button", "menu"],
    answer: "🔘 Main Buttons:\n📦 Data Bundles - Buy data\n👨‍🌾 AFA Bundles - For farmers\n🎟️ Vouchers - Gift codes\n🚀 Bulk Orders - For businesses\n🤝 Become an Agent - Earn money\n📍 Track Order - Check status",
    category: "navigation"
  },
  {
    questions: ["voucher", "gift code"],
    answer: "🎟️ Gift card for data! Buy voucher, get code, share with friend, they redeem for data instantly. Perfect gift for anyone!",
    category: "navigation"
  },
  {
    questions: ["bulk", "business order"],
    answer: "📦 Bulk Orders for businesses! Discounted rates, large quantities. Contact WhatsApp: tell us quantity & network, get quote, arrange delivery!",
    category: "navigation"
  },

  // SUPPORT
  {
    questions: ["contact", "support", "help"],
    answer: "📞 WhatsApp Support - 24/7 available! Usually responds in 5 minutes. Click WhatsApp button on site. Include phone number and order ID if needed.",
    category: "support"
  },
  {
    questions: ["support hours", "24/7"],
    answer: "✅ 24/7 SUPPORT! WhatsApp always open, day & night, weekends & holidays. We never sleep! Average response time: 5 minutes.",
    category: "support"
  },
  {
    questions: ["problem", "error", "issue"],
    answer: "⚠️ Try: Check internet, refresh page, clear cache, restart phone. Still stuck? Contact WhatsApp support - we fix it in minutes! 24/7 available.",
    category: "support"
  },

  // GENERAL
  {
    questions: ["how it works", "about"],
    answer: "🌟 3 Easy Steps:\n1. Choose package (go to Packages)\n2. Pay securely (Mobile Money, Bank, Card)\n3. Get data instantly!\n✓ 72K+ happy customers ✓ Instant delivery ✓ 24/7 support ✓ Affordable prices",
    category: "general"
  },
  {
    questions: ["security", "safe data"],
    answer: "🔒 Completely safe! 256-bit encryption, PCI certified, Paystack gateway. 72K+ transactions, zero breaches. Your data & money are protected!",
    category: "support"
  },
  {
    questions: ["free", "cost", "charges"],
    answer: "✅ FREE: Site access, account, tracking, WhatsApp support\n💵 YOU PAY FOR: Data bundles, AFA (GH₵15 one-time), minimal withdrawal fees\n🎁 NO hidden fees!",
    category: "general"
  },
];

// Frequently Asked Questions for UI display
export const FREQUENT_QUESTIONS = [
  "How do I buy data?",
  "How long does delivery take?",
  "What payment methods do you accept?",
  "How do I track my order?",
  "Is it safe to pay online?",
  "What data sizes are available?",
  "Which networks do you support?",
  "What is AFA?",
  "How long does AFA approval take?",
  "How do I become an agent?",
  "How much commission do agents earn?",
  "How do I withdraw my earnings?",
  "What is the minimum withdrawal amount?",
  "How long does withdrawal take?",
  "Can I create subagents?",
  "Is there a startup cost?",
  "What is a voucher?",
  "What are bulk orders?",
  "How can I contact support?",
  "Are payments secure?",
  "What if I don't receive data?",
  "Who is eligible for AFA?",
  "What is the AFA fee?",
];

// Q&A Matching Function
export function findAnswer(userQuestion: string): { answer: string; category: string } | null {
  const q = userQuestion.toLowerCase().trim();

  // Exact match
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    if (entry.questions.includes(q)) {
      return { answer: entry.answer, category: entry.category };
    }
  }

  // Keyword matching
  for (const entry of CHATBOT_KNOWLEDGE_BASE) {
    for (const question of entry.questions) {
      if (q.includes(question)) {
        return { answer: entry.answer, category: entry.category };
      }
    }
  }

  // Partial word matching
  const words = q.split(' ').filter(w => w.length > 2);
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
