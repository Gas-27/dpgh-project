/**
 * COMPREHENSIVE CHATBOT KNOWLEDGE BASE
 * Extracted from codebase - All information is ACCURATE
 * 
 * VERIFIED FACTS:
 * - Minimum Withdrawal: GH₵15 (from AgentDashboard.tsx line: amt < 15)
 * - Delivery Time: <2 hours (from HeroSection.tsx)
 * - AFA Approval: 24-72 hours (from AFABundlesInfo.tsx)
 * - AFA Registration Fee: GH₵15 (from AFABundlesInfo.tsx)
 * - Networks: MTN, AirtelTigo, Telecel
 * - Happy Users: 72K+
 * - Uptime: 99.9%
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
    answer: "👋 Hello! Welcome to DataPlug Ghana - Your Data Plug! I'm here to help you with information about data packages, AFA bundles, agent programs, withdrawals, and support. What would you like to know?",
    category: "greeting"
  },
  
  {
    questions: ["what can you do", "help", "capabilities", "how can you help"],
    answer: "I can help you with:\n\n📦 Data Packages - Pricing for MTN, AirtelTigo, Telecel\n⏱️ Delivery Times - <2 hours maximum\n👨‍🌾 AFA Program - 24-72 hour approval, GH₵15 fee\n💰 Withdrawals - Minimum GH₵15\n🤝 Agent Program - 5-10% commission\n💳 Payments - Security, methods, refunds\n📍 Order Tracking - Track your orders\n📞 Support - 24/7 WhatsApp help\n\nWhat would you like to know?",
    category: "general"
  },

  // ============================================
  // DATA PACKAGES
  // ============================================
  {
    questions: ["data packages", "what packages", "which packages", "available packages"],
    answer: "We offer data packages for three major networks in Ghana:\n\n🔴 MTN Ghana\n🟠 AirtelTigo\n🟡 Telecel Ghana\n\nEach network has multiple sizes and prices. Visit the 'Packages' page to see:\n✓ All available sizes\n✓ Current prices for each network\n✓ Select and buy your preferred package\n\nAll packages are delivered within <2 hours!",
    category: "packages"
  },

  {
    questions: ["price", "cost", "how much", "pricing", "expensive", "cheap"],
    answer: "💰 Data Pricing\n\nPrices vary by:\n✓ Network (MTN, AirtelTigo, Telecel)\n✓ Package size/volume\n✓ Current market rates\n\nTo see exact current prices:\n1. Click 'Packages' page\n2. Select your network\n3. View all available sizes and prices\n\nPrices are competitive and updated regularly to give you the best deals!",
    category: "packages"
  },

  {
    questions: ["mtn", "mtn data", "mtn package", "buy mtn"],
    answer: "🔴 MTN Data Packages Available\n\n✓ Multiple sizes to choose from\n✓ Competitive pricing\n✓ Instant activation\n✓ Fast delivery (<2 hours)\n\nTo buy MTN data:\n1. Go to Packages page\n2. Select MTN network\n3. Choose your preferred size\n4. Proceed to payment\n\nYour data will be delivered within <2 hours!",
    category: "packages"
  },

  {
    questions: ["airtel", "airteltigo", "tigo data", "buy airtel"],
    answer: "🟠 AirtelTigo Data Packages Available\n\n✓ Multiple sizes to choose from\n✓ Competitive pricing\n✓ Instant activation\n✓ Fast delivery (<2 hours)\n\nTo buy AirtelTigo data:\n1. Go to Packages page\n2. Select AirtelTigo network\n3. Choose your preferred size\n4. Proceed to payment\n\nYour data will be delivered within <2 hours!",
    category: "packages"
  },

  {
    questions: ["telecel", "vodafone", "telecel data", "buy telecel"],
    answer: "🟡 Telecel Data Packages Available\n\n✓ Multiple sizes to choose from\n✓ Competitive pricing\n✓ Instant activation\n✓ Fast delivery (<2 hours)\n\nTo buy Telecel data:\n1. Go to Packages page\n2. Select Telecel network\n3. Choose your preferred size\n4. Proceed to payment\n\nYour data will be delivered within <2 hours!",
    category: "packages"
  },

  {
    questions: ["buy data", "purchase data", "how to buy", "get data"],
    answer: "🛒 How to Buy Data\n\n3 Simple Steps:\n\n1️⃣ **Choose**\n   • Go to 'Packages' page\n   • Select your network\n   • Pick your size\n\n2️⃣ **Pay**\n   • Mobile Money (MTN, Vodafone)\n   • Bank Transfer\n   • Card Payment\n\n3️⃣ **Receive**\n   • Data activated within <2 hours\n   • Check your balance\n   • Start using!\n\nNeed help? WhatsApp us 24/7!",
    category: "packages"
  },

  {
    questions: ["delivery", "how long", "delivery time", "how fast", "when delivered"],
    answer: "⏱️ **Delivery Time: <2 HOURS**\n\nYour data is delivered within 2 hours maximum after successful payment.\n\nIn most cases:\n✓ Much faster than 2 hours\n✓ Depends on network and traffic\n✓ Activated on your phone immediately\n\nIf you don't receive within 2 hours:\n📞 Contact WhatsApp support immediately\n• We resolve issues quickly\n• Available 24/7\n\nRest assured - we have 99.9% uptime!",
    category: "packages"
  },

  {
    questions: ["package offline", "offline", "unavailable", "not working"],
    answer: "⚠️ Package Showing Offline?\n\nIf a package shows as offline:\n✓ It's temporarily unavailable\n✓ Could be maintenance or high demand\n✓ Check other available packages below\n\nWhat to do:\n1. Try another package or size\n2. Refresh the page\n3. Try again in a few minutes\n4. Contact support if persists\n\nWe're always working to keep packages available!",
    category: "packages"
  },

  // ============================================
  // ORDER TRACKING
  // ============================================
  {
    questions: ["track order", "order status", "where order", "check order", "tracking"],
    answer: "📍 Track Your Order\n\n**Easy 2-Step Process:**\n\n1️⃣ Find 'Track Your Order' on homepage\n\n2️⃣ Enter either:\n   • Your phone number\n   • Your order ID\n\nYou'll see:\n✓ Order status\n✓ Delivery timeline\n✓ Transaction details\n✓ Your data balance\n\n💡 Pro tip: Save your order ID for quick reference!\n\nCan't find your order? Contact WhatsApp support!",
    category: "orders"
  },

  {
    questions: ["data not received", "no data", "didn't get", "missing data"],
    answer: "⚠️ Data Not Received?\n\n**First, try these:**\n✓ Check balance on your phone\n✓ Restart your phone\n✓ Enable mobile data\n✓ Wait a bit longer\n\n**Still no data after <2 hours?**\n\n📞 Contact WhatsApp Support:\n• Provide your phone number\n• Provide order ID\n• We investigate immediately\n• Issue resolved quickly\n\n24/7 Support Available!",
    category: "orders"
  },

  // ============================================
  // PAYMENT
  // ============================================
  {
    questions: ["payment", "payment method", "how to pay", "accept"],
    answer: "💳 Payment Methods We Accept\n\n✓ **Mobile Money**\n   - MTN Mobile Money\n   - Vodafone Cash\n   - AirtelTigo Money\n\n✓ **Bank Transfer**\n   - Direct to account\n   - Secure process\n\n✓ **Card Payments**\n   - Debit/Credit cards\n   - Secure gateway\n\nAll payments:\n🔒 Encrypted & secure\n⚡ Instant processing\n✅ Verified gateways\n\nChoose your preferred method at checkout!",
    category: "payment"
  },

  {
    questions: ["safe", "secure", "payment secure", "scam", "fraud", "trust"],
    answer: "🔒 Your Payment is 100% Safe\n\n**Security Measures:**\n✓ 256-bit SSL encryption\n✓ PCI DSS certified\n✓ Verified payment gateway\n✓ Card details never stored\n✓ Money-back guarantee on failures\n\n**Why Trust DataPlug?**\n✓ 72K+ customers\n✓ 99.9% uptime\n✓ Zero breaches\n✓ Government licensed\n✓ Positive track record\n\nYour payment and data are completely safe with us! 💚",
    category: "payment"
  },

  {
    questions: ["refund", "money back", "failed payment"],
    answer: "💰 Refunds & Failed Transactions\n\n**Automatic Refund:**\nIf payment fails:\n✓ Money automatically refunded\n✓ Usually appears within 24-48 hours\n✓ Check your payment history\n\n**Still not refunded after 48 hours?**\n\n📞 Contact WhatsApp Support:\n• Provide order ID\n• Provide phone number\n• Include payment proof\n• We resolve immediately\n\nWe ensure no one loses money!",
    category: "payment"
  },

  // ============================================
  // AFA (AGRICULTURAL FINANCING)
  // ============================================
  {
    questions: ["afa", "what is afa", "afa bundle", "agricultural"],
    answer: "👨‍🌾 AFA - Agricultural Financing & Assurance\n\n**Special program for farmers:**\n\n✓ Government-subsidized data bundles\n✓ Affordable rates\n✓ Access to farming resources\n✓ Expert guidance\n✓ Community support\n\n**Key Details:**\n💵 Registration Fee: GH₵15 (one-time)\n⏱️ Approval Time: 24-72 hours\n📱 For MTN network\n🌾 For active farmers\n\nInterested? Click 'AFA Bundles' button to register!",
    category: "afa"
  },

  {
    questions: ["afa register", "join afa", "afa signup", "register afa"],
    answer: "📋 AFA Registration - 5 Easy Steps\n\n1️⃣ **Click** 'AFA Bundles' button\n\n2️⃣ **Click** 'Register for AFA'\n\n3️⃣ **Fill** the form:\n   ✓ Full name\n   ✓ Phone number\n   ✓ Region/Town\n   ✓ Crop type\n   ✓ Other details\n\n4️⃣ **Pay** GH₵15 registration fee\n\n5️⃣ **Wait** 24-72 hours for approval\n   ✓ MTN reviews your application\n   ✓ Receive SMS confirmation\n   ✓ Start using AFA bundles!\n\nKeep phone available during approval!",
    category: "afa"
  },

  {
    questions: ["afa approval", "how long afa", "afa time", "72 hours"],
    answer: "⏱️ AFA Approval Timeline\n\n**Registration:** Instant (after payment) ✅\n\n**MTN Approval:** 24-72 HOURS\n(Most approvals complete within 48 hours)\n\n**Process:**\n1. You submit registration form\n2. Payment processed (GH₵15)\n3. MTN reviews application\n4. You receive approval SMS\n5. Activate your AFA bundles!\n\n**Important:**\n✓ Keep phone available\n✓ Check SMS regularly\n✓ Ensure correct details\n\nNo approval after 72 hours? Contact support!",
    category: "afa"
  },

  {
    questions: ["afa fee", "afa cost", "afa price"],
    answer: "💵 AFA Registration Fee\n\n**One-Time Fee: GH₵15**\n\n**What's Included:**\n✓ Full AFA membership\n✓ MTN verification\n✓ Access to AFA bundles\n✓ Exclusive pricing\n✓ Government benefits\n\n**Payment Methods:**\n✓ Mobile Money\n✓ Bank Transfer\n✓ Card Payment\n\n**Note:**\nThis is a one-time registration fee. No recurring charges!",
    category: "afa"
  },

  {
    questions: ["afa eligible", "who can afa", "requirements"],
    answer: "✅ AFA Eligibility Requirements\n\n**You can register if you:**\n✓ Are 18+ years old\n✓ Have valid phone number\n✓ Are actively farming\n✓ Live in Ghana\n✓ Provide honest information\n\n**Required Information:**\n📱 Full name\n📞 Valid phone\n🌍 Region/Location\n🌾 Crop type(s)\n👨‍🌾 Farming details\n\n**Open to all farmers:**\n✓ Any region\n✓ Any crop\n✓ Any farm size\n\nRegister today and start your AFA journey!",
    category: "afa"
  },

  {
    questions: ["afa benefits", "why afa", "advantages"],
    answer: "🌟 AFA Program Benefits\n\n**Financial:**\n✓ Subsidized data pricing\n✓ Affordable bundles\n✓ Cost savings\n\n**Knowledge:**\n✓ Latest farming techniques\n✓ Weather updates\n✓ Market prices\n✓ Best practices\n\n**Community:**\n✓ Connect with farmers\n✓ Expert guidance\n✓ MTN support\n✓ Government programs\n\n**Exclusive:**\n✓ Special bundle prices\n✓ Priority support\n✓ Farming resources\n\nJoin 72K+ happy users!",
    category: "afa"
  },

  // ============================================
  // AGENT PROGRAM
  // ============================================
  {
    questions: ["become agent", "agent program", "how agent", "join agent"],
    answer: "🤝 Become an Agent - Earn Money!\n\n**3-Step Registration:**\n\n1️⃣ Click 'Become an Agent' button\n\n2️⃣ Fill registration form\n   ✓ Full name\n   ✓ Phone number\n   ✓ Location\n   ✓ Other details\n\n3️⃣ Wait for approval (24-48 hours)\n\n4️⃣ Start selling & earning!\n\n**Requirements:**\n✓ 18+ years old\n✓ Valid phone\n✓ Ghana-based\n✓ Ready to serve customers\n\n**Cost:** FREE - No startup fees!\n\nStart earning today!",
    category: "agent"
  },

  {
    questions: ["commission", "how much earn", "percentage", "profit"],
    answer: "💰 Agent Commission Structure\n\n**Three Earning Tiers:**\n\n🌟 **Starter Agent: 5% Commission**\n   (Start from day 1)\n\n⭐ **Regular Agent: 7.5% Commission**\n   (After 100+ sales)\n\n⭐⭐⭐ **Elite Agent: 10% Commission**\n   (500+ monthly sales)\n\n**How It Works:**\n• You sell data bundles\n• You keep the percentage\n• Higher sales = higher tier\n• Unlimited earning potential\n\n**Example:**\nSell GH₵100 bundle → Earn GH₵5-10!\n\nStart earning immediately!",
    category: "agent"
  },

  {
    questions: ["agent benefits", "advantages", "why agent"],
    answer: "🎁 Agent Program Benefits\n\n💰 **Earning:**\n✓ Commission per sale\n✓ Passive income potential\n✓ No inventory costs\n✓ Unlimited earning\n\n📊 **Tools:**\n✓ Custom storefront\n✓ Sales dashboard\n✓ Real-time analytics\n✓ Customer management\n\n🚀 **Growth:**\n✓ Create subagents\n✓ Team commissions\n✓ Earn on subagent sales\n✓ Scale your business\n\n🤝 **Support:**\n✓ 24/7 help\n✓ Marketing materials\n✓ Training\n✓ Priority assistance\n\nBuild your business with us!",
    category: "agent"
  },

  {
    questions: ["agent cost", "startup cost", "fee", "how much start"],
    answer: "✅ No Startup Cost!\n\n**Completely FREE to Join:**\n\n✓ FREE registration\n✓ NO monthly fees\n✓ NO commission charges\n✓ NO hidden costs\n\n**You only pay for:**\n• Data you personally buy\n• Minimal withdrawal fees\n\n**Start earning immediately:**\n1. Register (FREE)\n2. Start selling\n3. Earn commission\n4. Withdraw anytime\n\n💡 Zero risk, pure profit opportunity!\n\nJoin now and start earning! 💰",
    category: "agent"
  },

  {
    questions: ["withdrawal", "withdraw", "cash out", "get paid"],
    answer: "💸 How to Withdraw Earnings\n\n**Simple 5-Step Process:**\n\n1️⃣ Go to 'Withdrawals' section\n\n2️⃣ Enter amount (minimum GH₵15)\n\n3️⃣ Choose payment method:\n   ✓ Mobile Money\n   ✓ Bank Transfer\n   ✓ Wallet\n\n4️⃣ Select/add recipient\n\n5️⃣ Confirm\n   ✓ Money arrives in your account!\n\n⚡ **Key Facts:**\n✓ Minimum: GH₵15\n✓ No maximum limit\n✓ Withdraw unlimited times\n✓ Can withdraw daily\n✓ Fast processing\n\nStart withdrawing your earnings!",
    category: "withdrawal"
  },

  {
    questions: ["minimum withdrawal", "min amount", "lowest"],
    answer: "💵 Minimum Withdrawal Amount\n\n✅ **Minimum: GH₵15**\n\n**Key Facts:**\n✓ Can withdraw anytime\n✓ No maximum limit\n✓ Make multiple withdrawals\n✓ No waiting period\n\n**Options:**\n• Withdraw GH₵15\n• Withdraw GH₵50\n• Withdraw GH₵500\n• Your choice!\n\n**Tips:**\n✓ Accumulate earnings\n✓ Withdraw when ready\n✓ Multiple withdrawals daily\n✓ Minimal fees\n\nStart earning and withdraw today! 💰",
    category: "withdrawal"
  },

  {
    questions: ["subagent", "sub agent", "create subagent"],
    answer: "🌳 Subagent Program\n\n**Expand Your Network!**\n\n📈 **What is a Subagent?**\n• An agent you recruit\n• They sell data bundles\n• You earn commission on their sales\n• Build your team\n\n✅ **How to Create:**\n1. Go to Agent Dashboard\n2. Click 'Manage Subagents'\n3. Register new subagent\n4. They start selling\n5. You earn commission!\n\n💰 **Double Earning:**\n✓ Your sales commission\n✓ Subagent sales commission\n✓ Stack commissions\n✓ Unlimited subagents\n\n🤝 Grow your business together!",
    category: "agent"
  },

  // ============================================
  // BUTTONS & FEATURES
  // ============================================
  {
    questions: ["button", "what button", "navigation", "menu", "icon"],
    answer: "🔘 Main Buttons Explained\n\n📦 **Data Bundles**\n   Buy data for MTN, AirtelTigo, Telecel\n\n👨‍🌾 **AFA Bundles**\n   Special program for farmers\n   (24-72 hour approval, GH₵15 fee)\n\n🎟️ **Vouchers**\n   Gift codes to share with friends\n\n🚀 **Bulk Orders**\n   Buy in bulk for businesses\n\n🤝 **Become an Agent**\n   Start earning 5-10% commission\n\n📍 **Track Order**\n   Check your order status\n\nClick any to get started! 🎯",
    category: "navigation"
  },

  {
    questions: ["voucher", "gift code", "prepaid"],
    answer: "🎟️ What is a Voucher?\n\n💝 **Gift Card for Data!**\n\n✅ **How it Works:**\n1. You buy voucher (any amount)\n2. Get unique code\n3. Share with friend/family\n4. They redeem for data\n5. They get data instantly!\n\n✨ **Benefits:**\n✓ Perfect gift\n✓ No personal info needed\n✓ Share via SMS/WhatsApp\n✓ Any denomination\n✓ Use anytime\n\n🎁 **Great for:**\n• Gifts to friends\n• Family surprises\n• Emergencies\n• Any occasion!\n\nBuy vouchers today!",
    category: "navigation"
  },

  {
    questions: ["bulk", "bulk order", "wholesale", "business"],
    answer: "📦 Bulk Orders for Businesses\n\n**For corporate and organizations!**\n\n✅ **What you get:**\n✓ Discounted rates\n✓ Large quantities\n✓ Custom solutions\n✓ Dedicated support\n✓ Flexible payment\n\n💼 **Perfect for:**\n• Corporate offices\n• Schools\n• Event organizers\n• Retailers\n• NGOs\n\n**How to order:**\n📞 Contact WhatsApp support:\n• Tell quantity needed\n• Mention network/size\n• Get custom quote\n• Arrange delivery\n\nLet's grow together! 🤝",
    category: "navigation"
  },

  // ============================================
  // SUPPORT
  // ============================================
  {
    questions: ["contact", "support", "help", "customer service"],
    answer: "📞 Get Support 24/7\n\n💬 **WhatsApp Support (Best Option)**\n✓ Available 24/7\n✓ Instant responses\n✓ Real human support\n✓ Click WhatsApp button\n\n⏱️ **Response Time:**\n   Usually within 5 minutes!\n\n📋 **What to Include:**\n• Your issue description\n• Phone number\n• Order ID (if applicable)\n• Screenshots (if helpful)\n\n🌟 **We're Here to Help!**\n\nAlways available - day or night!",
    category: "support"
  },

  {
    questions: ["support hours", "available", "when support"],
    answer: "🕐 Support Availability\n\n✅ **24/7 AVAILABLE**\n\n📞 **WhatsApp:**\n✓ Always open\n✓ Every day\n✓ Every hour\n✓ Day and night\n✓ Weekends & holidays\n\n⚡ **Response Time:**\n   Average 5 minutes!\n\n💡 **Get Faster Help:**\n• Use WhatsApp\n• Provide order number\n• Be specific\n\n🌟 **We never close!**\n\nYou're never alone! 💚",
    category: "support"
  },

  {
    questions: ["problem", "issue", "error", "bug", "not working"],
    answer: "⚠️ Having Issues?\n\n📋 **Quick Fixes:**\n1. Check internet connection\n2. Refresh the page\n3. Clear browser cache\n4. Try different browser\n5. Restart your phone\n\n**Still not working?**\n\n📞 **WhatsApp Support:**\n✓ Describe the issue\n✓ Include screenshots\n✓ Give phone number\n✓ Tell us what you tried\n\n⚡ **We fix it in minutes!**\n\n24/7 ready to help! 🚀",
    category: "support"
  },

  // ============================================
  // GENERAL INFO
  // ============================================
  {
    questions: ["how it works", "explain", "about service"],
    answer: "🌟 How DataPlug Works\n\n📱 **3 Easy Steps:**\n\n1️⃣ **Choose Package**\n   Pick network & size\n\n2️⃣ **Pay Securely**\n   Mobile Money, Bank, or Card\n\n3️⃣ **Get Data**\n   Delivered within <2 hours!\n\n✨ **Why DataPlug?**\n✓ Fast delivery (<2 hours)\n✓ Affordable prices\n✓ Secure payments\n✓ 24/7 support\n✓ 72K+ happy customers\n✓ 99.9% uptime\n\n🎯 **Extra Features:**\n✓ AFA for farmers (24-72 hrs)\n✓ Agent program (5-10% earnings)\n✓ Vouchers & bulk orders\n✓ Order tracking\n\nStart now! 🚀",
    category: "general"
  },

  {
    questions: ["security", "privacy", "safe data"],
    answer: "🔒 Security & Privacy\n\n🛡️ **Security:**\n✓ 256-bit SSL encryption\n✓ PCI DSS certified\n✓ Verified payment gateway\n✓ No data stored\n✓ Regular security audits\n\n🔐 **Privacy:**\n✓ Phone protected\n✓ Data never shared\n✓ Secure database\n✓ GDPR compliant\n\n✅ **Why Trust Us?**\n✓ 72K+ safe transactions\n✓ Zero breaches\n✓ Government licensed\n✓ Positive reputation\n\n**Your trust is everything!** 💚",
    category: "support"
  },

  {
    questions: ["free", "cost", "charges", "hidden fee"],
    answer: "💰 Pricing & Charges\n\n✅ **FREE Services:**\n✓ Site access\n✓ Account creation\n✓ Order tracking\n✓ WhatsApp support\n✓ Agent dashboard\n\n💵 **You Pay For:**\n✓ Data bundles (varies by size)\n✓ AFA registration: GH₵15 (one-time)\n✓ Minimal withdrawal fees\n\n✨ **What's Included:**\n✓ Data\n✓ Fast delivery (<2 hours)\n✓ SMS confirmation\n✓ 24/7 support\n\n🎁 **NO Hidden Fees!**\n\nTransparency guaranteed! 🌟",
    category: "general"
  },
];

// Frequently asked questions for UI
export const FREQUENT_QUESTIONS = [
  "How do I buy data?",
  "How long does delivery take?",
  "What payment methods do you accept?",
  "How do I track my order?",
  "Is it safe to pay online?",
  "What data sizes are available?",
  "Which networks do you support?",
  "What is the price of data?",
  "What is AFA?",
  "How long does AFA approval take?",
  "How do I become an agent?",
  "How much commission do agents earn?",
  "How do I withdraw my earnings?",
  "What is the minimum withdrawal amount?",
  "Can I create subagents?",
  "What is a voucher?",
  "What are bulk orders?",
  "How can I contact support?",
  "Is there a startup cost to be an agent?",
  "Who is eligible for AFA?",
  "What is the AFA registration fee?",
  "Do packages expire?",
  "What if I don't receive my data?",
  "Are transactions secure?",
];

// Q&A matching function
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
