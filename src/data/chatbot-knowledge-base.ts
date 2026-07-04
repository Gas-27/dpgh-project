// Comprehensive Knowledge Base for ChatBot
// Contains all information about packages, services, pricing, AFA, agents, and more

export const CHATBOT_KNOWLEDGE_BASE = {
  // ============================================
  // SERVICE INFORMATION
  // ============================================
  services: {
    dataBundles: {
      description: "Instant data bundle purchases for MTN, AirtelTigo, and Telecel networks",
      networks: ["MTN", "AirtelTigo", "Telecel"],
      delivery: "Instant - Data is credited immediately after payment",
      availability: "24/7",
      support: "Available on WhatsApp and phone",
    },
    afa: {
      fullName: "Agricultural Financing and Assurance",
      description:
        "AFA is a government-backed agricultural insurance and financing program that provides farmers with subsidized packages and financial support",
      benefits: [
        "Discounted data rates for farmers",
        "Government subsidy on eligible packages",
        "Easy registration process",
        "Support for agricultural activities",
      ],
      eligibility: "Must be a farmer or agricultural worker",
      registrationTime: "15-30 minutes",
      deliveryTime: "1-2 business days",
      requiredInfo: [
        "Full name",
        "Phone number",
        "Date of birth",
        "Region/Town",
        "Occupation/Crop type",
      ],
    },
    agentProgram: {
      description: "Become a reseller and earn commissions on every sale",
      commissionStructure: {
        starter: {
          percentage: 5,
          minSalesPerMonth: 0,
          description: "For new agents starting out",
        },
        regular: {
          percentage: 7.5,
          minSalesPerMonth: 100,
          description: "For agents with consistent sales",
        },
        elite: {
          percentage: 10,
          minSalesPerMonth: 500,
          description: "For top-performing agents",
        },
      },
      requirements: [
        "Valid phone number",
        "WhatsApp account",
        "Willingness to serve customers",
        "Must be 18+ years old",
      ],
      benefits: [
        "Earn 5-10% commission on every sale",
        "Priority customer support",
        "Access to bulk discounts",
        "Build your own customer base",
        "Flexible working hours",
        "No startup costs",
      ],
      paymentMethods: [
        "Mobile Money (MTN, AirtelTigo, Telecel)",
        "Bank Transfer",
        "Wallet Top-up",
      ],
      minimumWithdrawal: "GH₵5",
      withdrawalTime: "Same day or within 24 hours",
    },
  },

  // ============================================
  // PRICING INFORMATION
  // ============================================
  pricing: {
    baseNote: "Prices vary by agent. Check your specific storefront for current prices.",
    packageSizes: ["100MB", "500MB", "1GB", "2GB", "3GB", "4GB", "5GB", "10GB"],
    paymentMethods: [
      "Mobile Money (MTN, AirtelTigo, Telecel)",
      "Bank Transfer",
      "Card Payment",
      "Wallet Top-up",
    ],
    refundPolicy: "Refunds processed within 24-48 hours for failed transactions",
    priceGuarantee:
      "We guarantee competitive prices. Contact support if you find cheaper rates elsewhere.",
  },

  // ============================================
  // DELIVERY & SUPPORT
  // ============================================
  delivery: {
    dataDelivery: {
      normal: "Instant after payment confirmation (usually within 30 seconds)",
      delayed:
        "If you don't receive within 15 minutes, refresh your account or contact support",
      maxWaitTime: "Contact support if no delivery within 30 minutes",
    },
    afaDelivery: {
      processingTime: "1-2 business days",
      approval: "Once approved, data is credited to account",
      tracking: "Agents/Subagents can track AFA status on their dashboard",
    },
    supportChannels: {
      whatsapp: "Instant support via WhatsApp - usually responds within 5 minutes",
      phone: "Call for urgent issues",
      availability: "24/7 support available",
      responseTime: "Usually within 5-15 minutes",
    },
  },

  // ============================================
  // WITHDRAWAL INFORMATION
  // ============================================
  withdrawal: {
    requirements:
      "Only agents and subagents can withdraw. Regular customers cannot withdraw.",
    minimumAmount: "GH₵16",
    paymentMethods: ["Mobile Money", "Bank Transfer", "Wallet"],
    processingTime: "Less than 2 minutes",
    processingTimeDetail: "Money arrives in your account within 2 minutes after confirmation",
    steps: [
      "Go to Withdrawals page (for agents/subagents)",
      "Enter the amount (minimum GH₵16)",
      "Select payment method (Mobile Money, Bank Transfer, or Wallet)",
      "Add recipient if not already saved",
      "Confirm withdrawal",
      "Receive money in less than 2 minutes",
    ],
    fees: "Minimal processing fees apply",
    recipients: {
      description: "Save multiple recipients for faster withdrawals",
      info: "Mobile money number or bank account details",
      limit: "Unlimited recipients can be saved",
    },
  },

  // ============================================
  // AGENT INFORMATION
  // ============================================
  agentSteps: {
    howToJoin: [
      "Click 'Become an Agent' button on homepage",
      "Fill out registration form with your details",
      "Verify your phone number via OTP",
      "Create your store/storefront",
      "Wait for approval (usually 24-48 hours)",
      "Start selling once approved",
    ],
    profileManagement: {
      theme: "Customize your storefront colors and branding",
      pricing: "Set your own selling prices above base price",
      subagents: "Create and manage subagent networks",
      settings: "Manage WhatsApp, phone, notifications",
    },
    subagents: {
      description: "Agents can create subagent networks to expand reach",
      benefits: [
        "Earn commission from subagent sales",
        "Expand your network",
        "Build a team",
      ],
      subagentCommission: "Agents set subagent margins (varies by agent)",
      subsubagents:
        "Subagents can also create their own sub-subagent networks",
    },
  },

  // ============================================
  // BUTTON MEANINGS & NAVIGATION
  // ============================================
  buttons: {
    "Data Bundles": "Browse and buy regular data packages for mobile networks",
    "AFA Bundles":
      "Agricultural Financing and Assurance - special subsidized packages for farmers",
    "Vouchers":
      "Prepaid credits that can be used for future purchases on the platform",
    "Internet Services":
      "Other internet-related services and connectivity packages",
    "Bulk Orders":
      "Purchase large quantities of data bundles at discounted prices",
    "Become an Agent": "Register to become a reseller and earn commissions",
    "Track Your Order":
      "Check the status of your data delivery or order (enter phone number)",
    "Buy data via USSD": "Dial code on your phone to purchase without internet",
  },

  // ============================================
  // FAQ SECTION
  // ============================================
  faq: {
    payment: [
      {
        q: "What payment methods do you accept?",
        a: "We accept Mobile Money (MTN, AirtelTigo, Telecel), Bank Transfers, Card payments, and Wallet top-ups.",
      },
      {
        q: "Are transactions safe and secure?",
        a: "Yes, all transactions are encrypted and processed through secure payment gateways.",
      },
      {
        q: "What if my payment fails?",
        a: "If payment fails, check your balance and try again. If issues persist, contact our support team.",
      },
      {
        q: "Do you accept international payments?",
        a: "Currently, we primarily serve customers in Ghana. International transactions may be limited.",
      },
      {
        q: "Is there a transaction fee?",
        a: "Mobile money transactions may include network provider fees. Bank transfers have minimal fees.",
      },
    ],

    delivery: [
      {
        q: "How long does data delivery take?",
        a: "Data is delivered instantly (within 30 seconds) after successful payment confirmation.",
      },
      {
        q: "I paid but didn't receive my data",
        a: "Wait 5-10 minutes and refresh your account. If still not received, contact support immediately with your phone number.",
      },
      {
        q: "Why is my delivery delayed?",
        a: "Delays can occur due to network issues, high traffic, or service provider problems. We investigate and resolve within 30 minutes.",
      },
      {
        q: "Can I resend data to another phone number?",
        a: "Contact support with the incorrect number and correct number. We'll help transfer the balance.",
      },
    ],

    packages: [
      {
        q: "What networks do you support?",
        a: "We support MTN, AirtelTigo (Airtel), and Telecel (Vodafone) networks.",
      },
      {
        q: "What data sizes are available?",
        a: "We offer packages from 100MB to 10GB+. Sizes vary by network and agent pricing.",
      },
      {
        q: "Do my unused data roll over?",
        a: "Data rollover depends on the specific package. Some packages keep unused data for 30 days. Check package details.",
      },
      {
        q: "What is the validity of data packages?",
        a: "Most packages are valid for 30 days from activation. Check specific package terms for details.",
      },
      {
        q: "Can I combine multiple packages?",
        a: "Yes, you can stack multiple packages. Each will have its own validity period.",
      },
    ],

    afa: [
      {
        q: "What is AFA?",
        a: "AFA (Agricultural Financing and Assurance) is a government-backed program offering subsidized data for farmers.",
      },
      {
        q: "How long does AFA registration take?",
        a: "Registration takes 15-30 minutes. Data delivery happens within 1-2 business days after approval.",
      },
      {
        q: "Who is eligible for AFA?",
        a: "Farmers, agricultural workers, and people involved in farming activities are eligible.",
      },
      {
        q: "What info do I need for AFA registration?",
        a: "Name, phone number, date of birth, region, town, and type of crop/occupation.",
      },
      {
        q: "Are AFA packages cheaper?",
        a: "Yes, AFA packages include government subsidies, making them significantly cheaper than regular packages.",
      },
    ],

    agents: [
      {
        q: "How much commission do agents earn?",
        a: "Commissions are 5% (starter), 7.5% (regular with 100+ sales), or 10% (elite with 500+ sales monthly).",
      },
      {
        q: "How long does it take to become an agent?",
        a: "Registration is instant, but approval takes 24-48 hours after verification.",
      },
      {
        q: "Is there a startup cost?",
        a: "No startup costs. You can start selling immediately with zero upfront investment.",
      },
      {
        q: "How do I withdraw my earnings?",
        a: "Go to your Withdrawals section, enter amount (minimum GH₵16), select payment method, and confirm. Money arrives in less than 2 minutes!",
      },
      {
        q: "What is the minimum withdrawal amount?",
        a: "The minimum withdrawal amount is GH₵16. Any amount below this cannot be withdrawn.",
      },
      {
        q: "How long does withdrawal take?",
        a: "Withdrawals are processed in less than 2 minutes. Once you confirm, money reaches your account almost instantly.",
      },
      {
        q: "Can I create subagents?",
        a: "Yes, agents can create and manage subagent networks to expand their reach and earn additional commissions.",
      },
      {
        q: "What is a subagent?",
        a: "A subagent is someone recruited by an agent to also sell data bundles. The agent earns commission from their subagent's sales.",
      },
    ],

    support: [
      {
        q: "How can I contact support?",
        a: "Contact us via WhatsApp for instant support (usually responds within 5 minutes) or call our support number.",
      },
      {
        q: "What are support hours?",
        a: "We provide 24/7 support for all urgent issues. Response times are usually within 5-15 minutes.",
      },
      {
        q: "How do I report a problem?",
        a: "Use the 'Report Complaint' option in the app, or contact support directly via WhatsApp with details.",
      },
      {
        q: "What if I want to cancel an order?",
        a: "Once payment is confirmed and data is delivered, cancellation is not possible. Contact support for special cases.",
      },
    ],

    technical: [
      {
        q: "The app keeps crashing",
        a: "Clear your app cache, update to the latest version, and restart your phone. Contact support if issue persists.",
      },
      {
        q: "I can't log in",
        a: "Ensure correct phone number/email and password. Use 'Forgot Password' to reset if needed.",
      },
      {
        q: "Prices are not showing",
        a: "Refresh the page, check internet connection, and clear browser cache. Try a different browser if it continues.",
      },
    ],
  },

  // ============================================
  // GENERAL INFORMATION
  // ============================================
  general: {
    companyName: "Data Plug",
    tagline: "Your Data Plug in Ghana",
    slogan: "Instant Delivery • 24/7 Reliable",
    mission: "Provide affordable, instant data bundles to everyone in Ghana",
    availability: "24/7 service with instant delivery",
    networks: "MTN, AirtelTigo (Airtel), Telecel (Vodafone)",
    serviceArea: "Available across Ghana",
    guarantee: "Fast, reliable, and affordable data bundles",
  },
};

// ============================================
// FREQUENTLY ASKED QUESTIONS LIST FOR UI
// ============================================

export const FREQUENT_QUESTIONS = [
  // Quick actions
  "How do I buy data?",
  "How long does delivery take?",
  "What payment methods do you accept?",
  "How do I track my order?",
  "Is it safe to pay online?",
  
  // Packages
  "What data sizes are available?",
  "Which networks do you support?",
  "Do unused data roll over?",
  
  // AFA Program
  "What is AFA?",
  "How long does AFA registration take?",
  "Who is eligible for AFA?",
  
  // Agent Program
  "How do I become an agent?",
  "How much commission do agents earn?",
  "How do I withdraw my earnings?",
  "What is the minimum withdrawal amount?",
  "How long does withdrawal take?",
  "Can I create subagents?",
  
  // Support & Other
  "How can I contact support?",
  "What do the buttons mean?",
  "What is a voucher?",
  "What are bulk orders?",
  "Is there a startup cost to be an agent?",
];

// ============================================
// Q&A MATCHING FUNCTION
// ============================================

interface QAMatch {
  answer: string;
  confidence: number;
}

export function findAnswer(userQuestion: string): QAMatch | null {
  const questionLower = userQuestion.toLowerCase().trim();

  // Direct FAQ matching
  for (const category of Object.values(CHATBOT_KNOWLEDGE_BASE.faq)) {
    if (Array.isArray(category)) {
      for (const item of category) {
        const qLower = item.q.toLowerCase();
        if (
          questionLower.includes(qLower.substring(0, 10)) ||
          qLower.includes(questionLower.substring(0, 10))
        ) {
          return { answer: item.a, confidence: 0.95 };
        }
      }
    }
  }

  // Keyword-based matching
  const keywordMatches: Record<string, string> = {
    // Payment
    "payment method": CHATBOT_KNOWLEDGE_BASE.faq.payment[0].a,
    safe: CHATBOT_KNOWLEDGE_BASE.faq.payment[1].a,
    secure: CHATBOT_KNOWLEDGE_BASE.faq.payment[1].a,
    fail: CHATBOT_KNOWLEDGE_BASE.faq.payment[2].a,

    // Delivery
    "how long": CHATBOT_KNOWLEDGE_BASE.faq.delivery[0].a,
    "didn't receive": CHATBOT_KNOWLEDGE_BASE.faq.delivery[1].a,
    delay: CHATBOT_KNOWLEDGE_BASE.faq.delivery[2].a,

    // Packages
    network: CHATBOT_KNOWLEDGE_BASE.faq.packages[0].a,
    "data size": CHATBOT_KNOWLEDGE_BASE.faq.packages[1].a,
    rollover: CHATBOT_KNOWLEDGE_BASE.faq.packages[2].a,
    validity: CHATBOT_KNOWLEDGE_BASE.faq.packages[3].a,

    // AFA
    afa: CHATBOT_KNOWLEDGE_BASE.services.afa.description,
    farmer: CHATBOT_KNOWLEDGE_BASE.services.afa.description,
    agricultural: CHATBOT_KNOWLEDGE_BASE.services.afa.description,

    // Agents
    agent: CHATBOT_KNOWLEDGE_BASE.agentSteps.howToJoin[0],
    commission: CHATBOT_KNOWLEDGE_BASE.faq.agents[0].a,
    earn: CHATBOT_KNOWLEDGE_BASE.services.agentProgram.benefits[0],
    withdraw: CHATBOT_KNOWLEDGE_BASE.faq.agents[3].a,

    // Support
    contact: CHATBOT_KNOWLEDGE_BASE.faq.support[0].a,
    help: CHATBOT_KNOWLEDGE_BASE.faq.support[0].a,
    problem: CHATBOT_KNOWLEDGE_BASE.faq.support[2].a,
  };

  for (const [keyword, answer] of Object.entries(keywordMatches)) {
    if (questionLower.includes(keyword)) {
      return { answer, confidence: 0.8 };
    }
  }

  // Button meanings
  for (const [button, description] of Object.entries(
    CHATBOT_KNOWLEDGE_BASE.buttons
  )) {
    if (questionLower.includes(button.toLowerCase())) {
      return {
        answer: `"${button}" button: ${description}`,
        confidence: 0.85,
      };
    }
  }

  // Service information
  if (
    questionLower.includes("service") ||
    questionLower.includes("what do you")
  ) {
    return {
      answer: `We offer: 1) Data Bundles - instant delivery for MTN, AirtelTigo, Telecel. 2) AFA - subsidized packages for farmers. 3) Agent Program - earn 5-10% commission. 4) Bulk Orders - discounted prices. 5) Vouchers & Internet Services.`,
      confidence: 0.75,
    };
  }

  return null;
}
