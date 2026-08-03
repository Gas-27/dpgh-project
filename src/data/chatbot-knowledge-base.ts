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
  complaint: "dispute", wrong: "dispute", issue: "dispute",
  refund: "refund_how", "money back": "refund_how", "get my money back": "refund_how",
  "mtn express": "mtn_express_info", express: "mtn_express_info",
  "*124": "mtn_bundle_location", "124#": "mtn_bundle_location", "master beneficiary": "mtn_bundle_location",
  "owing": "owing_debt_issue", debt: "owing_debt_issue",
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
    answer: "Hello! How are you doing? I'm your support assistant — here to help with data packages, buying, delivery, AFA, agent and subagent accounts, dashboards, storefronts, withdrawals, order tracking, and more. What can I help you with today?",
    category: "greeting",
  },
  {
    id: "thanks",
    questions: ["thanks", "thank you", "ok thanks", "great", "cool", "appreciate it"],
    answer: "You're welcome! Happy to help. Let me know if anything else comes up.",
    category: "greeting",
  },
  {
    id: "human_agent",
    questions: ["talk to human", "real person", "customer care", "contact support", "speak to someone"],
    answer: "Sure. Use the **Support** link in your dashboard menu and the team will pick it up during business hours. For urgent order issues, try tracking and reporting directly in this chat first — it is usually the fastest route.",
    category: "support",
  },

  // ───────────────────────── Login / Signup / Account ─────────────────────────
  {
    id: "signup",
    questions: ["sign up", "register", "create account", "how to register", "join", "new account", "open account"],
    answer: "To create an account:\n1. Click **Sign Up** at the top of the page\n2. Enter your name, phone number, and a password\n3. Verify your phone number with the OTP sent to you\n4. Your account is ready — you can start buying data immediately\n\nIf you want to sell data, look for the **Become an Agent** option during or after signup.",
    category: "account",
    relatedIds: ["become_agent"],
  },
  {
    id: "login",
    questions: ["login", "log in", "sign in", "how to login", "cant login", "login problem", "access my account"],
    answer: "To log in:\n1. Click **Log In** at the top of the page\n2. Enter your registered phone number and password\n3. Tap **Log In**\n\nIf you get an error, double-check your phone number format (start with 0 or +233). If the password is wrong, use the **Forgot Password** link just below the login form.",
    category: "account",
    relatedIds: ["forgot_password"],
  },
  {
    id: "forgot_password",
    questions: ["forgot password", "reset password", "lost password", "change password", "password reset", "cant remember password"],
    answer: "No worries — here is how to reset your password:\n1. Go to the login page\n2. Tap **Forgot Password** below the login form\n3. Enter the phone number linked to your account\n4. You will receive an OTP via SMS\n5. Enter the OTP\n6. Set a new password\n7. Log in with your new password\n\nMake sure you enter the exact phone number you used when registering. If you no longer have access to that number, contact support through your dashboard.",
    category: "account",
  },
  {
    id: "change_password",
    questions: ["change password", "update password", "new password", "password settings"],
    answer: "To change your password while logged in:\n1. Go to your dashboard\n2. Tap **Settings**\n3. Find the **Security** or **Password** section\n4. Enter your current password, then your new one\n5. Save\n\nIf you have forgotten your current password, use the **Forgot Password** option on the login page instead.",
    category: "account",
    relatedIds: ["forgot_password"],
  },
  {
    id: "account_locked",
    questions: ["account locked", "account suspended", "account blocked", "account disabled"],
    answer: "If your account has been locked or suspended, it is usually due to too many failed login attempts or a security flag. Contact support through the Help link in your dashboard or via the WhatsApp contact shown there to get it reviewed.",
    category: "account",
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
    answer: "Supported networks:\n✓ MTN — bundle lands under 'Master Beneficiary Data Bundle' (check with *124#)\n✓ MTN Express — faster MTN delivery route, same bundle location as MTN\n✓ AirtelTigo — check balance in AirtelTigo app\n✓ Telecel — check balance in Telecel app\n\nAll networks have multiple package sizes with fast delivery.",
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
    questions: ["afa", "what is afa", "afa bundle", "afa data", "afa cheap data"],
    answer: "**AFA (Affordable Farmer Access)** is a heavily discounted MTN data program — and you do **NOT** need to be a farmer to join, despite the name. It was launched by MTN Ghana to provide cheap internet access.\n\n**Key facts:**\n- Registration fee: **GHC 15** (one-time)\n- Approval time: **24–72 hours** (MTN reviews it)\n- Once approved, you unlock much cheaper bundle rates — often 50–70% cheaper than standard MTN rates\n- Your AFA status stays active as long as your MTN line is active\n- Check status any time: dial **\\*1848#** on your MTN line\n\n**Who can register?**\nAnyone with an active MTN Ghana SIM card. You do not need a farm, a farmer ID, or any special documentation.",
    category: "afa",
    relatedIds: ["afa_register", "afa_status", "afa_approval"],
  },
  {
    id: "afa_register",
    questions: ["afa register", "register afa", "join afa", "how to register afa", "how to get afa"],
    answer: "**How to register for AFA:**\n1. Go to the **AFA Bundles** section\n2. Tap **Register for AFA**\n3. Fill in the registration form (name, phone, ID details)\n4. Pay the **GHC 15** registration fee via Mobile Money\n5. Wait **24–72 hours** for MTN to review and approve\n6. You will receive an **SMS from MTN** once approved\n7. Come back and your AFA bundle prices will be unlocked\n\n**Important notes:**\n- Use the exact name and ID details on your MTN SIM registration\n- A mismatch is the most common reason for rejection\n- If rejected, you can re-register with corrected details",
    category: "afa",
    relatedIds: ["afa_approval", "afa_status", "afa_rejected"],
  },
  {
    id: "afa_approval",
    questions: ["afa approval", "how long afa", "afa waiting", "afa pending", "afa not approved yet"],
    answer: "AFA approval is handled entirely by MTN Ghana — it takes **24 to 72 hours** from when you submit the registration.\n\n**What happens during this time:**\n- MTN verifies the details you submitted against their records\n- If everything matches, your registration is approved automatically\n- You get a confirmation SMS from MTN\n\n**To check progress:**\n- Dial **\\*1848#** on your MTN line at any time\n- If it says 'not registered', your application is still pending or was rejected\n\n**If it has been more than 72 hours with no SMS:** your details likely didn't match. Re-register with corrected information.",
    category: "afa",
    relatedIds: ["afa_status", "afa_rejected"],
  },
  {
    id: "afa_status",
    questions: ["*1848", "check afa status", "afa status", "check afa", "how to check afa"],
    answer: "**To check your AFA registration status:**\n1. Dial **\\*1848#** on your MTN line\n2. Follow the menu prompts\n3. It will show if you are registered, pending, or not registered\n\nYou can dial this any time — it is the official MTN check for AFA status. If it shows 'not registered' and you have already paid, your details may not have matched. Contact support.",
    category: "afa",
    relatedIds: ["afa_approval", "afa_rejected"],
  },
  {
    id: "afa_rejected",
    questions: ["afa rejected", "afa denied", "afa failed", "afa not approved", "afa registration failed"],
    answer: "If your AFA registration was not approved, it is almost always because the **name or ID details** you entered did not match what is on your MTN SIM registration.\n\n**What to do:**\n1. Check the exact name MTN has on your SIM (visit an MTN service centre or check your original SIM registration details)\n2. Go to AFA Bundles → Register again\n3. Enter the corrected details that match exactly\n4. Pay the GHC 15 fee again\n5. Wait another 24–72 hours\n\nIf you paid but were rejected and want a refund of the registration fee, contact support through your dashboard.",
    category: "afa",
    relatedIds: ["afa_register", "afa_status"],
  },
  {
    id: "afa_prices",
    questions: ["afa prices", "afa bundle prices", "afa rates", "how cheap is afa", "afa vs normal data"],
    answer: "AFA bundles are significantly cheaper than standard data rates — typically **50–70% cheaper** than buying regular MTN data.\n\nExact prices are shown on the AFA Bundles page once your registration is approved. The savings make AFA bundles one of the best value options on the platform, especially for high-volume users and agents selling to students.\n\nTo see the prices, go to **AFA Bundles** in your dashboard — prices display once your AFA status is active.",
    category: "afa",
    relatedIds: ["afa_register", "afa_info"],
  },

  // ───────────────────────── Agent Program ─────────────────────────
  {
    id: "become_agent",
    questions: ["become agent", "how to be agent", "join as agent", "agent signup", "agent fee", "agent cost"],
    answer: "To become an agent:\n1. Click 'Become an Agent' on the top menu or homepage\n2. Fill in the registration form with your details\n3. Pay the agent registration fee (if applicable — check the signup page for the current fee)\n4. Your account is activated immediately — no waiting period or approval required\n5. Log in to your Agent Dashboard and start selling right away\n\nOnce registered you get your own dashboard, storefront URL, and full pricing control.",
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
    answer: "Your API Key is in your dashboard under Settings. With it you can:\n• Fetch available packages\n• Create orders programmatically\n• Check order status\n�� Manage your resale prices\n\nCheck the API documentation link in your dashboard for endpoint details and authentication.",
    category: "api",
  },
  {
    id: "api_rate_limit",
    questions: ["api rate limit", "api errors", "api not working"],
    answer: "If API calls are failing, verify you're sending your key in the correct header and that you haven't exceeded your rate limit. If it persists after checking documentation, contact support with the error response you're seeing.",
    category: "api",
  },

  // ───────────────────────── Order Tracking & Status ─────────────────────────
  {
    id: "track_order",
    questions: ["track order", "where order", "order status", "check my order", "track my order", "where is my order", "find my order"],
    answer: "You can track your order **right here in this chat** or from your dashboard.\n\n**Track in this chat (fastest):**\nJust send me the phone number used when placing the order and I will pull up all your recent orders with live status — right here in the conversation. If any order shows **Delivered**, a **Report** button appears directly on that order card so you can report it without leaving the chat.\n\n**Track from your dashboard:**\n1. Go to the **Track Order** tab in the menu\n2. Your orders are listed with the current status\n3. For any **Delivered** order where data has not arrived, tap the **Report** button on that row\n\nWould you like me to look up your orders now? Send me your phone number.",
    category: "tracking",
    relatedIds: ["order_status_meanings", "report_order", "dispute"],
  },
  {
    id: "order_status_meanings",
    questions: ["what does order status mean", "order status meaning", "what is pending order", "what is processing", "what is delivered", "what is failed", "order status explained", "status pending processing delivered failed"],
    answer: "**What each order status means:**\n\n- **Pending** — Your payment was received and the order is queued. It has not been sent to the network yet. Usually moves within a few minutes.\n\n- **Processing** — The order has been submitted to the network provider and is actively being delivered. Most orders complete at this stage within 5–30 minutes.\n\n- **Delivered** — The network confirmed successful delivery. Your data should be on the recipient's line. For MTN/MTN Express, dial \\*124# and check under **Master Beneficiary Data Bundle**.\n\n- **Failed** — The delivery attempt did not go through. This could be due to a network issue, wrong number, or provider downtime. A refund is usually processed automatically back to your wallet.\n\n- **Refunded** — The order was not delivered and the amount has been credited back to your platform wallet. You can retry the order or use the balance for another purchase.\n\n**Still not sure?** If it says Delivered but you do not see the data, tap the **Report** button on that order.",
    category: "tracking",
    relatedIds: ["report_order", "mtn_bundle_location", "owing_debt_issue"],
  },
  {
    id: "report_order",
    questions: ["report order", "report not received", "report button", "report delivered not received", "report issue with order", "data not received how to report", "how to report"],
    answer: "You can only report an order when its delivery status shows as **Delivered**. Here's how:\n\n**To report in this chat:**\n1. Enter your phone number (so we can track your case)\n2. I'll pull up your orders\n3. Find the **Delivered** order\n4. Tap the orange **Report** button\n5. Answer pre-check questions and upload screenshots\n6. Submit — we'll follow up with you directly\n\n**To report from your dashboard:**\n1. Go to **Track Order** tab\n2. Find the order with **Delivered** status\n3. Click **Report** — you'll be asked for your phone number to track the case\n4. Complete the form and submit\n\n**Important before reporting:**\n- Dial **\\*124#** on MTN (or check your app on other networks)\n- Look for **Master Beneficiary Data Bundle** — that's where our bundle shows\n- Check if your SIM owes airtime, bundles, or MoMo — network debts can hold bundles\n\n**Report button rules:** Only appears on orders with **Delivered** status. Other statuses (Pending, Processing, Failed) are handled by our system automatically.",
    category: "tracking",
    relatedIds: ["order_status_meanings", "mtn_bundle_location", "owing_debt_issue", "refund_how"],
  },
  {
    id: "wrong_order",
    questions: ["wrong number", "wrong order", "sent to wrong number", "entered wrong phone", "made mistake ordering", "wrong network", "ordered wrong package", "wrong package ordered"],
    answer: "I understand how frustrating that is — unfortunately, once an order has been submitted and processed to a phone number, **it cannot be cancelled, reversed, or redirected**. The data has already been delivered to that number by the network.\n\n**Why this cannot be changed:**\nOnce the network provider confirms delivery, the transaction is final. There is no way to retrieve data from a phone number — not even from our side.\n\n**What you should do going forward:**\n- Always double-check the phone number before confirming an order\n- For agents buying for customers, confirm the number verbally before processing\n\n**If the order is still Pending or Processing** (not yet delivered), contact support immediately through your dashboard — there may be a small window to cancel before network submission.",
    category: "support",
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

  // ───────────────────────── Networks & Bundle Details ─────────────────────────
  {
    id: "mtn_bundle_location",
    questions: ["master beneficiary", "where is my bundle", "where is mtn bundle", "mtn bundle location", "where to find data mtn", "124", "*124#"],
    answer: "For MTN and MTN Express orders, your bundle lands under 'Master Beneficiary Data Bundle' — NOT under Mashup Data or any other section.\n\nTo check:\n1. Dial *124# on your MTN line\n2. Select 'Data Balance'\n3. Look at the 'Balance Breakdown' section\n4. Find 'Master Beneficiary Data Bundle'\n\nIf you see it there, your data was delivered successfully. The GB amount shown is your current remaining balance from our bundle.",
    category: "packages",
    relatedIds: ["mtn_express_info", "delivery_time"],
  },
  {
    id: "mtn_express_info",
    questions: ["mtn express", "what is mtn express", "mtn express vs mtn", "express bundle"],
    answer: "MTN Express is our faster MTN delivery route. Like standard MTN, the bundle lands under 'Master Beneficiary Data Bundle' in your MTN app balance (dial *124# → Data Balance → Balance Breakdown).\n\nBoth MTN and MTN Express use the same delivery location — 'Master Beneficiary Data Bundle' — so always check there first if you think your data hasn't arrived.",
    category: "packages",
    relatedIds: ["mtn_bundle_location", "delivery_time"],
  },
  {
    id: "telecel_balance_check",
    questions: ["telecel balance", "check telecel data", "telecel app", "telecel bundle location"],
    answer: "For Telecel orders, check your data balance in the official Telecel Ghana app:\n1. Open the Telecel app\n2. Go to your data balance or account section\n3. Your bundle should appear there\n\nIf you don't see it after 2 hours, use 'Track Order' first, then report if still unresolved.",
    category: "packages",
  },
  {
    id: "airteltigo_balance_check",
    questions: ["airteltigo balance", "check airteltigo data", "airteltigo app", "airtel tigo bundle"],
    answer: "For AirtelTigo orders, check your data balance in the official AirtelTigo Ghana app:\n1. Open the AirtelTigo app\n2. Go to Balance or My Account\n3. Your bundle should appear there\n\nIf you don't see it after 2 hours, use 'Track Order' first, then report if still unresolved.",
    category: "packages",
  },

  // ───────────────────────── Refunds ─────────────────────────
  {
    id: "refund_how",
    questions: ["refund", "how does refund work", "refund process", "get refund", "money back", "refund policy", "where do refunds go", "refund wallet", "storefront refund"],
    answer: "**COMPLETE REFUND SYSTEM** — Refunds flow down the network chain based on order source:\n\n🔷 **DIRECT CUSTOMERS** (bought from Packages page with their own account):\n→ Refund lands in their **User Dashboard Wallet**\n→ They can use it to buy data again or withdraw it\n\n🔷 **AGENTS** (created an account as an Agent, buy from Packages page themselves):\n→ Refund lands in their **Agent Wallet** (not the user dashboard)\n→ They use this to resell or support subagents\n\n🔷 **AGENT STOREFRONT ORDERS** (customers buy from an Agent's storefront):\n→ Refund goes to the **Agent's wallet** (at the base price the agent bought at)\n→ Agent can then:\n   • Send the money back to the customer via MoMo (direct refund)\n   • Retry the order for the customer using wallet balance\n   • Use it for other inventory\n\n🔷 **SUBAGENT ORDERS** (when an Agent created a Subagent):\n→ When Admin refunds: money goes to **Agent's wallet**\n→ Agent can then refund to the **Subagent's wallet** using the refund tab\n→ Subagent receives the credit and can retry or withdraw\n\n🔷 **SUB-SUBAGENT ORDERS** (when a Subagent created a Sub-Subagent):\n→ Admin refunds → **Subagent's wallet**\n→ Subagent refunds → **Sub-Subagent's wallet**\n→ Sub-Subagent can retry or withdraw\n\n**KEY RULES:**\n✓ Each order can ONLY be refunded once — system blocks double-refunds\n✓ Refunds land in **platform wallets** (not Mobile Money)\n✓ Wallet balance is shown in the dashboard Overview\n✓ From wallet you can buy, retry orders, or withdraw\n✓ Minimum withdrawal: GHC15\n✓ Withdrawals process in under 2 minutes",
    category: "support",
    relatedIds: ["refund_same_number", "dispute", "wallet_topup", "storefront_info", "withdraw"],
  },
  {
    id: "storefront_refund",
    questions: ["storefront refund", "customer refund", "how to handle refund", "send money back customer", "refund customer momo"],
    answer: "**STOREFRONT REFUND WORKFLOW** — When a storefront customer's order is refunded:\n\n1. **Admin refunds the order** → You receive credit in your **Agent Wallet**\n2. **You have 2 choices:**\n   \n   **Option A: Send money back to customer (MoMo)**\n   • Go to your Agent Dashboard\n   • Check your wallet balance (shows the refund amount)\n   • Send the amount to the customer via MoMo directly\n   • The customer receives their money back\n   \n   **Option B: Retry the order**\n   • Use the refund amount from your wallet\n   • Go to Buy Data or your Refunds tab\n   • Select the customer's phone number and reorder the same package\n   • Pay with your wallet balance\n   • The new order processes immediately\n   • Customer gets their data on retry\n\n3. **Notification**\n   • Your storefront customers see the refund status in their order history\n   • They can track if you've retried their order\n\nChoose whichever option works best for your business — the wallet balance gives you the flexibility to decide on a per-order basis.",
    category: "agent",
    relatedIds: ["refund_how", "storefront_info", "wallet_topup"],
  },
  {
    id: "refund_same_number",
    questions: ["buy same number after refund", "retry same number", "refund retry", "failed order retry", "buy again after refund"],
    answer: "After receiving a refund, you can buy again for the same phone number immediately using your wallet balance. Here's what to do:\n\n1. Check your wallet balance — the refunded amount will be there\n2. Go to Packages (or Buy Data in your dashboard)\n3. Select the same network and package\n4. Enter the same phone number\n5. Pay with wallet balance\n6. Your new order will be processed\n\nFor MTN and MTN Express: try the other route if one keeps failing. If MTN fails, try MTN Express (or vice versa) — they use different delivery paths.",
    category: "support",
    relatedIds: ["refund_how", "mtn_express_info", "wallet_topup"],
  },
  {
    id: "wallet_topup",
    questions: ["topup wallet", "add money wallet", "fund wallet", "wallet balance low", "top up account"],
    answer: "To add funds to your wallet:\n1. Go to the top-up section in your dashboard\n2. Enter the amount you want to add\n3. Pay via Paystack (Mobile Money)\n4. Funds reflect in your wallet instantly after payment confirms\n\nYou can then use your wallet balance to buy data without going through Paystack each time.",
    category: "payment",
  },
  {
    id: "owing_debt_issue",
    questions: ["owing airtime", "owing bundle", "owing momo", "debt on sim", "sim blocked"],
    answer: "If you are owing airtime, bundles, or MoMo on your SIM card, the network provider may hold or redirect data bundles sent to that number. Before reporting a missing bundle:\n\n1. Check if you owe airtime on the SIM\n2. Check if you owe any bundles or subscriptions\n3. Check if you owe Mobile Money on that number\n4. Clear any outstanding debts first\n5. Then re-check your data balance (dial *124# for MTN)\n\nThis is the most common reason a delivered bundle seems 'missing' — clearing the debt often reveals the data is already there.",
    category: "support",
    relatedIds: ["mtn_bundle_location", "refund_how"],
  },

  // ───────────────────────── Disputes / Support ─────────────────────────
  {
    id: "dispute",
    questions: ["complaint", "wrong package", "charged twice", "double charge", "report issue", "data missing", "data not showing"],
    answer: "Sorry to hear that — let's sort this out. Before submitting a report, please do this first:\n\n1. **Dial \\*124# on MTN** → select Data Balance → check **Master Beneficiary Data Bundle** (that is where MTN/Express bundles land, not Mashup Data)\n2. **Check if you owe** airtime, bundles, or MoMo on that number — this can hide delivered data\n3. **Wait 30 minutes** if it is under 30 minutes — delivery can occasionally be slightly delayed\n\nIf you have done all the above and still nothing:\n1. Go to **Order History**\n2. Find the order showing **Delivered**\n3. Tap the **Report** button\n4. Answer the pre-check questions and upload a screenshot of your data balance\n5. Submit — the team reviews it promptly",
    category: "support",
    relatedIds: ["report_order", "mtn_bundle_location", "owing_debt_issue", "refund_how"],
  },
  {
    id: "help",
    questions: ["help", "support", "question", "what can you do"],
    answer: "Here to help! You can ask me about:\n- Data packages and buying\n- Delivery and order tracking\n- Where to find your MTN bundle (\\*124# → Master Beneficiary Data Bundle)\n- AFA registration and bundles\n- Becoming an agent or subagent\n- Dashboards and storefronts\n- Prices, commissions, and withdrawals\n- API access\n- Refunds and what to do if data seems missing\n- Login, signup, and forgotten passwords\n- What each order status means\n- How to report an undelivered order\n\nJust type your question.",
    category: "support",
  },
  {
    id: "premium_subscription",
    questions: ["premium", "premium subscription", "premium plan", "subscribe premium", "upgrade account"],
    answer: "The **Premium Subscription** gives you access to discounted bundle prices that are not available on the standard plan.\n\n**Benefits:**\n- Lower prices on all packages\n- Priority order processing\n- Access to exclusive bundle sizes\n\nTo subscribe, go to your dashboard and look for the **Premium** or **Subscription** option. The monthly fee and current discounted prices are shown there.",
    category: "features",
  },
];

export const FREQUENT_QUESTIONS = [
  "Show Available Packages",
  "How do I buy data?",
  "How do I track my order?",
  "Where is my MTN bundle? (dial *124#)",
  "What is MTN Express?",
  "How does a refund work?",
  "Can I buy again for the same number after a refund?",
  "My data hasn't arrived, what do I do?",
  "What do I do when a storefront customer is refunded?",
  "What is AFA?",
  "How do I become an agent?",
  "How much commission do agents earn?",
  "What is a subagent?",
  "How do I withdraw money?",
  "How do I set prices?",
  "What payment methods can I use?",
  "How does the Spin-to-Win wheel work?",
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
