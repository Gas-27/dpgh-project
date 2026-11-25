// Page-level SEO content for the public JustBuy GH service pages.
// Shared by the React app and the build-time prerender script.
//
// Widgets (rendered live from the database, never hardcoded):
//   "prices1gb"        -> 1GB price per network from public.data_packages
//   "subscriptionList" -> active subscription services from digital_services
//
// Title rule: base title <= 47 chars so "<title> | JustBuy GH" stays <= 60.
// Never mention any upstream payment/utility provider by name.

const USSD = "*365*778#";

export const PAGES = {
  home: {
    path: "/",
    metaTitle: "Cheap Data, Airtime & Bill Payments Ghana",
    description:
      "Buy cheap MTN, Telecel and AirtelTigo data, airtime, DStv, ECG and subscriptions in Ghana. Pay with MoMo and get instant delivery. Order now.",
    keywords: [
      "cheap data Ghana",
      "buy data online Ghana",
      "buy airtime online Ghana",
      "buy electricity online Ghana",
      "DStv subscription Ghana",
      "Netflix subscription Ghana",
      "bulk SMS Ghana",
      "data reseller Ghana",
    ],
    h1: "Cheap Data Bundles, Airtime, Subscriptions & Utility Payments in Ghana",
    intro:
      "JustBuy GH is a Ghanaian platform where you can buy MTN, Telecel and AirtelTigo data bundles, top up airtime, pay for ECG electricity, DStv, GOtv and StarTimes, and get subscriptions such as Netflix, ChatGPT and Canva Pro. Pay with mobile money (MoMo), get your order delivered fast, and use us any time of day.",
    sections: [
      {
        h2: "What you can buy on JustBuy GH",
        p: [
          "Everything below is available from one account. Pick the service you need and follow the steps on the page.",
        ],
        links: [
          { to: "/packages", label: "Cheap data bundles in Ghana", note: "MTN, MTN Express, Telecel and AirtelTigo data at affordable prices." },
          { to: "/subscription", label: "Netflix, ChatGPT, Canva Pro and other subscriptions", note: "Pay for premium apps with mobile money." },
          { to: "/services", label: "Buy ECG electricity, DStv, GOtv and StarTimes online", note: "Pay your utility and TV bills with MoMo." },
          { to: "/social-boost", label: "TikTok, Instagram and YouTube growth services", note: "Social media boost services for creators and businesses." },
          { to: "/bulk-sms", label: "Bulk SMS in Ghana with custom sender ID", note: "Reach many customers at once, with an AI message writer." },
          { to: "/afa-bundles", label: "AFA registration and AFA bundles", note: "Learn what AFA is and how to register." },
          { to: "/products", label: "Marketplace Ghana for digital products", note: "Browse digital products from sellers." },
          { to: "/become-agent", label: "Become a data agent and start a reseller business", note: "Sell data, airtime, DStv, electricity and subscriptions." },
        ],
      },
      {
        h2: "Why buy from JustBuy GH",
        bullets: [
          "Instant delivery for data and airtime orders.",
          "Pay with mobile money (MoMo) - no bank card needed.",
          "All major networks: MTN, Telecel and AirtelTigo.",
          "Open 24/7, so you can top up any time.",
          `Buy data by USSD with no internet: dial ${USSD}.`,
        ],
      },
      {
        h2: "Today's 1GB data prices",
        p: ["These prices are read live from our system, so they match what you pay at checkout."],
        widget: "prices1gb",
      },
    ],
    faqs: [
      {
        q: "Where can I buy cheap data in Ghana?",
        a: "You can buy cheap MTN, Telecel and AirtelTigo data bundles online on JustBuy GH. Open the data packages page, pick your network and bundle size, enter the phone number and pay with mobile money.",
      },
      {
        q: "How fast is data delivery?",
        a: "Data orders are delivered automatically after payment is confirmed. Most orders arrive within minutes. If an order is delayed, contact support from the order tracking section.",
      },
      {
        q: "Can I pay with MoMo?",
        a: "Yes. You can pay with mobile money, so you do not need a bank card.",
      },
      {
        q: "Can I buy data without internet?",
        a: `Yes. Dial ${USSD} on your phone and follow the prompts. Our guide on using ${USSD} explains each step.`,
      },
      {
        q: "Can I buy electricity and pay DStv or GOtv here?",
        a: "Yes. Use the services page to pay for ECG prepaid electricity, DStv, GOtv and StarTimes with mobile money.",
      },
      {
        q: "Which subscriptions can I get?",
        a: "The subscription page lists the services currently available, such as Netflix, ChatGPT, Canva Pro, CapCut Pro, Spotify, Apple Music and YouTube Premium. Availability and prices are shown live on that page.",
      },
      {
        q: "How do I start selling data and make money?",
        a: "Create an agent account, get your own store link, and sell data, airtime, DStv, electricity and subscriptions to your customers. See the become-an-agent page for the steps.",
      },
      {
        q: "Is JustBuy GH only for Ghana?",
        a: "Yes. The service is built for Ghana: Ghana networks, Ghana Cedi pricing and mobile money payment.",
      },
    ],
    related: [
      "how-to-buy-cheap-data-in-ghana",
      "1gb-data-price-ghana-mtn-telecel-airteltigo",
      "how-to-use-ussd-365-778-to-buy-data",
      "how-to-start-a-data-reselling-business-in-ghana",
    ],
    schema: [],
  },

  packages: {
    path: "/packages",
    metaTitle: "Cheap Data Bundles Ghana - MTN, Telecel, AirtelTigo",
    description:
      "Compare cheap MTN, Telecel and AirtelTigo data bundle prices in Ghana. Pay with MoMo and get instant delivery. Buy your data now.",
    keywords: [
      "cheap data Ghana",
      "cheapest data bundle Ghana",
      "1GB data price Ghana",
      "cheap MTN data",
      "MTN bundle prices",
      "Telecel data bundle",
      "AirtelTigo data bundle",
      "non-expiry data",
      "affordable data bundle",
      "buy data online Ghana",
    ],
    h1: "Cheap Data Bundles in Ghana: MTN, Telecel & AirtelTigo",
    intro:
      "Looking for cheap data in Ghana? Choose your network, pick a bundle size and pay with mobile money. Prices on this page are loaded live, and delivery is automatic once payment is confirmed. Non-expiry bundles are marked where available.",
    sections: [
      {
        h2: "1GB data price today",
        p: ["The price of 1GB on each network right now, read from our system:"],
        widget: "prices1gb",
      },
      {
        h2: "Compare MTN, Telecel and AirtelTigo bundles",
        p: [
          "MTN, MTN Express, Telecel and AirtelTigo each have their own bundle sizes and prices. Use the tabs above to switch networks and compare the cost per GB before you pay. If you buy often, a larger bundle usually works out cheaper per GB.",
          "Looking for non-expiry data? Check the bundle name and notes on each package. If you are unsure which bundle suits you, our guide on buying cheap data in Ghana walks you through the choice.",
        ],
      },
      {
        h2: `Buy data by USSD with ${USSD}`,
        p: [
          `No internet? Dial ${USSD} and follow the prompts to buy data directly from your phone. Read the step-by-step guide linked below for the full process.`,
        ],
      },
    ],
    faqs: [
      {
        q: "What is the cheapest 1GB data in Ghana?",
        a: "The cheapest 1GB depends on the network and can change. This page shows the current 1GB price for each network, read live from our system, so you can compare before you buy.",
      },
      {
        q: "How long does data delivery take?",
        a: "Delivery starts automatically after your payment is confirmed. Most orders arrive within minutes. If yours is delayed, use the order tracker or contact support.",
      },
      {
        q: "Is there non-expiry data?",
        a: "Some bundles are non-expiry. Check the bundle details on the package you want. Expiry rules are set by each network, so always read the bundle notes before paying.",
      },
      {
        q: "How do I buy cheap data with USSD?",
        a: `Dial ${USSD} on your phone and follow the prompts. You do not need internet for this. See the full guide for each step.`,
      },
      {
        q: "I searched for cheep data or a data bundel - is this the right place?",
        a: "Yes. Whether you search for cheap data, a data bundle or an MTN, Telecel or AirtelTigo bundle, you can compare prices and buy on this page.",
      },
      {
        q: "Can I buy data for someone else?",
        a: "Yes. Enter the recipient's phone number on the right network when you place the order.",
      },
    ],
    related: [
      "how-to-buy-cheap-data-in-ghana",
      "1gb-data-price-ghana-mtn-telecel-airteltigo",
      "how-to-use-ussd-365-778-to-buy-data",
    ],
    schema: ["data"],
  },

  subscription: {
    path: "/subscription",
    metaTitle: "Netflix, ChatGPT, Canva Pro Subscriptions Ghana",
    description:
      "Get Netflix, ChatGPT, Canva Pro, CapCut Pro, Spotify and more in Ghana. Pay with mobile money (MoMo). See live prices and subscribe today.",
    keywords: [
      "Netflix subscription Ghana",
      "cheap Netflix Ghana",
      "ChatGPT Plus Ghana",
      "ChatGPT Pro Ghana",
      "Canva Pro Ghana",
      "CapCut Pro Ghana",
      "Spotify Premium Ghana",
      "Apple Music Ghana",
      "YouTube Premium Ghana",
      "pay subscriptions with MoMo",
    ],
    h1: "Netflix, ChatGPT, Canva Pro & Premium Subscriptions in Ghana",
    intro:
      "Pay for premium apps with mobile money instead of a foreign card. The list below is loaded live, so you only see services that are currently available and the price you will actually pay.",
    sections: [
      {
        h2: "Available subscriptions and live prices",
        p: ["Prices come directly from our system and update when they change."],
        widget: "subscriptionList",
      },
      {
        h2: "Netflix subscription in Ghana",
        p: [
          "Watch films and series on Netflix without needing an international card. Choose the Netflix option on this page and pay with mobile money.",
        ],
      },
      {
        h2: "ChatGPT Plus and ChatGPT Pro in Ghana",
        p: [
          "ChatGPT helps with writing, studying, coding and business tasks. If a ChatGPT plan is listed above, you can pay for it here in Ghana Cedis using MoMo.",
        ],
      },
      {
        h2: "Canva Pro and CapCut Pro in Ghana",
        p: [
          "Canva Pro and CapCut Pro are popular with designers, content creators and small businesses who make flyers, posts and videos. Check the list above for current availability.",
        ],
      },
      {
        h2: "Spotify Premium, Apple Music and YouTube Premium in Ghana",
        p: [
          "Listen without ads and download music or watch without interruptions. Spotify Premium, Apple Music and YouTube Premium appear in the list above whenever they are available.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I pay for Netflix with mobile money in Ghana?",
        a: "Yes. When Netflix is listed on this page, you can pay for it with mobile money.",
      },
      {
        q: "How do I get ChatGPT Plus or Pro in Ghana?",
        a: "Check the live list on this page. If a ChatGPT plan is available, select it and complete payment with MoMo.",
      },
      {
        q: "Do you offer Canva Pro, CapCut Pro and Spotify Premium?",
        a: "Availability changes, so the live list above is the source of truth. When a service is listed, it can be purchased on this page.",
      },
      {
        q: "Why is a service missing from the list?",
        a: "Only active services are shown. If a service is temporarily unavailable it is hidden until it returns.",
      },
      {
        q: "Are the prices final?",
        a: "The price shown on the page is the price you pay at checkout.",
      },
    ],
    related: [
      "how-to-get-netflix-chatgpt-canva-spotify-in-ghana",
      "how-to-start-a-data-reselling-business-in-ghana",
    ],
    schema: ["subscription"],
  },

  services: {
    path: "/services",
    metaTitle: "Buy ECG Electricity, DStv, GOtv & Airtime Ghana",
    description:
      "Buy ECG prepaid electricity, pay DStv, GOtv and StarTimes, and top up airtime in Ghana with MoMo. Fast and secure. Pay your bills now.",
    keywords: [
      "buy electricity online Ghana",
      "ECG prepaid top up",
      "how to buy ECG credit with MoMo",
      "DStv subscription Ghana",
      "GOtv subscription",
      "StarTimes subscription",
      "pay DStv with mobile money",
      "buy airtime online Ghana",
      "cheap airtime",
    ],
    h1: "Buy ECG Electricity, DStv, GOtv, StarTimes & Airtime Online in Ghana",
    intro:
      "Pay your utility and TV bills in a few taps. Choose a service, enter your meter or smartcard number, and pay with mobile money.",
    sections: [
      {
        h2: "Buy ECG prepaid electricity with MoMo",
        p: [
          "Top up your ECG prepaid meter without queueing. Select ECG, enter your meter number, enter the amount and approve the MoMo prompt on your phone.",
        ],
        bullets: [
          "Choose ECG prepaid on the services page.",
          "Enter your meter number and double-check it.",
          "Enter the amount and confirm the payment on your phone.",
          "Enter the token on your meter once it is delivered.",
        ],
      },
      {
        h2: "Pay DStv subscription online",
        p: [
          "Renew your DStv package using your smartcard number and pay with mobile money. Make sure the smartcard number is correct before you confirm.",
        ],
      },
      {
        h2: "Pay GOtv and StarTimes",
        p: [
          "GOtv and StarTimes can be paid the same way: pick the provider, enter your decoder or smartcard number, choose the package or amount and pay with MoMo.",
        ],
      },
      {
        h2: "Buy airtime online in Ghana",
        p: [
          "Top up airtime for yourself or someone else. Enter the number, choose the amount and pay with mobile money. If you buy airtime often, you can also sell it as a reseller.",
        ],
      },
    ],
    faqs: [
      {
        q: "How do I buy ECG credit with MoMo?",
        a: "Open the services page, select ECG prepaid, enter your meter number and amount, then approve the MoMo prompt. See our guide for the full steps.",
      },
      {
        q: "Can I pay DStv with mobile money?",
        a: "Yes. Enter your DStv smartcard number, choose the package and pay with MoMo.",
      },
      {
        q: "Can I pay GOtv and StarTimes here too?",
        a: "Yes. GOtv and StarTimes are available on the services page.",
      },
      {
        q: "Can I buy cheap airtime online?",
        a: "Yes. You can top up airtime for any supported number and pay with mobile money.",
      },
      {
        q: "Can I sell electricity and DStv as a reseller?",
        a: "Yes. Agents can sell these services to their own customers. See the guide on selling electricity, DStv and GOtv.",
      },
    ],
    related: [
      "how-to-buy-ecg-electricity-with-mobile-money",
      "how-to-pay-dstv-and-gotv-with-momo",
      "how-to-sell-electricity-dstv-gotv-and-make-money",
    ],
    schema: [],
  },

  "social-boost": {
    path: "/social-boost",
    metaTitle: "TikTok, Instagram & YouTube Boost Ghana",
    description:
      "Grow your TikTok, Instagram, YouTube, Facebook and WhatsApp channel in Ghana. Pay with MoMo. No password needed. See services and order now.",
    keywords: [
      "TikTok followers Ghana",
      "TikTok likes",
      "TikTok views",
      "Instagram followers and likes",
      "YouTube subscribers and views",
      "Facebook page likes",
      "WhatsApp channel followers",
      "social media boost Ghana",
    ],
    h1: "Social Media Growth & Boost Services in Ghana",
    intro:
      "Give your profile a boost on the platforms your customers use. Pick the platform, choose the service and pay with mobile money. We never ask for your password.",
    sections: [
      { h2: "TikTok followers, likes and views", p: ["Boost your TikTok profile or a specific video. You only provide your public profile or video link."] },
      { h2: "Instagram followers and likes", p: ["Add followers and likes to a public Instagram profile or post using its public link."] },
      { h2: "YouTube subscribers and views", p: ["Support your channel or a video with more views and subscribers. A public channel or video link is all we need."] },
      { h2: "Facebook page likes", p: ["Grow your Facebook page so more people see your business."] },
      { h2: "WhatsApp channel followers", p: ["Increase followers on your WhatsApp channel using your channel link."] },
      {
        h2: "Boosting and organic growth work together",
        p: ["A boost helps new visitors trust your profile, but consistent, useful content is what keeps them. Read our growth guide for organic tips."],
      },
    ],
    faqs: [
      { q: "Is social media boosting safe?", a: "We only need a public link to your profile or post, never your password. Follow each platform's rules, and use boosting as a supplement to real content." },
      { q: "Do I need to give you my password?", a: "No. Never share your password. You only provide a public profile or post link." },
      { q: "How fast is delivery?", a: "Delivery speed depends on the service and the order size. The service details show what to expect before you pay." },
      { q: "Can I buy TikTok followers in Ghana with MoMo?", a: "Yes, you can pay with mobile money for the services listed on this page." },
      { q: "Does a boost replace posting good content?", a: "No. A boost helps visibility, but consistent content is what keeps an audience." },
    ],
    related: [
      "how-to-grow-on-tiktok-instagram-youtube",
      "how-to-get-more-customers-for-your-online-business-in-ghana",
    ],
    schema: [],
  },

  "bulk-sms": {
    path: "/bulk-sms",
    metaTitle: "Bulk SMS Ghana - Cheap SMS with Sender ID",
    description:
      "Send cheap bulk SMS in Ghana with your own sender ID. Reach all your customers fast and use our AI message writer. Start sending today.",
    keywords: [
      "bulk SMS Ghana",
      "cheap SMS Ghana",
      "sender ID SMS",
      "how to send bulk SMS",
      "SMS marketing Ghana",
      "how to reach more customers",
      "AI SMS writer",
    ],
    h1: "Bulk SMS in Ghana: Cheap SMS Marketing with Sender ID",
    intro:
      "Send one message to hundreds of customers at once. Add your contacts, write your message (or let the AI writer help), pick a sender ID and send.",
    sections: [
      {
        h2: "What is a sender ID?",
        p: [
          "A sender ID is the name shown as the sender of your SMS instead of a phone number, for example your business name. It helps customers recognise you. Sender IDs may need approval before they can be used.",
        ],
      },
      {
        h2: "How SMS pricing works",
        p: [
          "You pay per SMS credit used. A long message can use more than one credit. The exact price is shown in your dashboard before you send, so you always know the cost.",
        ],
      },
      {
        h2: "AI SMS message writer",
        p: [
          "Not sure what to write? Describe your offer and the AI message writer drafts a short, clear SMS you can edit before sending.",
        ],
      },
      {
        h2: "Why SMS marketing works in Ghana",
        p: ["SMS reaches customers even when they have no internet. Use it for promotions, reminders, order updates and announcements."],
      },
    ],
    faqs: [
      { q: "How do I send bulk SMS in Ghana?", a: "Open the bulk SMS section, add your contacts, write your message, choose a sender ID and send." },
      { q: "What is a sender ID?", a: "It is the name that appears as the sender of your SMS, such as your business name." },
      { q: "Is the SMS cheap?", a: "Pricing is shown before you send, so you can compare the cost with your budget." },
      { q: "Can AI write my SMS?", a: "Yes. The AI message writer drafts a message from a short description. You can edit it before sending." },
      { q: "How can bulk SMS help me reach more customers?", a: "It lets you send offers and reminders to many people at once. Our guide explains how to do it well." },
    ],
    related: [
      "how-to-send-bulk-sms-in-ghana-and-reach-more-customers",
      "how-to-get-more-customers-for-your-online-business-in-ghana",
    ],
    schema: ["sms"],
  },

  "afa-bundles": {
    path: "/afa-bundles",
    metaTitle: "AFA Registration & AFA Bundle Ghana Explained",
    description:
      "What is AFA and how does AFA work in Ghana? Learn the registration steps and buy AFA bundles online. Register and buy now.",
    keywords: ["AFA registration", "what is AFA", "how does AFA work", "AFA bundle Ghana"],
    h1: "AFA Registration & AFA Bundles in Ghana: What Is AFA?",
    intro:
      "AFA is an MTN Ghana programme that gives registered SIM cards access to special data bundle rates. This page explains what AFA is, how it works and how to register and buy AFA bundles.",
    sections: [
      {
        h2: "What is AFA and how does AFA work?",
        p: [
          "MTN's Affordable Data For All (AFA) programme gives registered MTN SIM cards access to special bundle pricing that is not available on standard retail plans. You register your SIM once, then buy AFA bundles for that number.",
        ],
      },
      {
        h2: "How to register for AFA",
        // TODO(George): Confirm these registration steps match the real /afa-bundles flow
        // (required details, fees, review time) and update. Do not publish unverified facts.
        bullets: [
          "Open the AFA registration section.",
          "Enter the details requested for the MTN number you want to register.",
          "Submit the form and wait for confirmation.",
          "Once registered, buy AFA bundles for that number.",
        ],
      },
      {
        h2: "AFA bundles for registered numbers",
        // TODO(George): Confirm AFA bundle sizes, prices and any validity details, then add them
        // here (or pull them live from the database).
        p: ["After registration, AFA bundles can be bought for the registered MTN number from the AFA section."],
      },
    ],
    faqs: [
      { q: "What is AFA?", a: "AFA stands for Affordable Data For All, an MTN Ghana programme that gives registered SIM cards access to special bundle rates." },
      { q: "How does AFA work?", a: "You register your MTN SIM for AFA, then you can buy AFA bundles for that number." },
      { q: "How do I register for AFA?", a: "Use the AFA registration form on this page, enter the requested details and submit. See our guide for the steps." },
      { q: "Can I buy an AFA bundle for any number?", a: "AFA bundles are for MTN numbers that have been registered for AFA." },
      // TODO(George): Add a verified answer about registration fees and approval time.
    ],
    related: ["what-is-afa-and-how-to-register", "how-to-buy-cheap-data-in-ghana"],
    schema: [],
  },

  "become-agent": {
    path: "/become-agent",
    metaTitle: "Become a Data Agent in Ghana - Start Selling",
    description:
      "Start selling data, airtime, DStv, electricity and subscriptions in Ghana with your own store. Sign up as an agent and earn today.",
    keywords: [
      "become a data agent",
      "data reseller Ghana",
      "how to sell data bundle in Ghana",
      "airtime reseller",
      "start a reseller business",
      "how to make money online in Ghana",
    ],
    h1: "How to Start Selling Data, Airtime, DStv, Electricity & Subscriptions in Ghana",
    intro:
      "Become an agent and run your own store. Your customers buy from your link, and you earn on every sale. You do not need a shop or stock.",
    sections: [
      {
        h2: "Benefits of becoming an agent",
        bullets: [
          "Sell data, airtime, DStv, GOtv, StarTimes, electricity and subscriptions from one store.",
          "Set your own selling prices within the allowed range.",
          "Get your own store link to share on WhatsApp, TikTok and Instagram.",
          "No stock to buy and no shop to rent.",
        ],
      },
      {
        h2: "How agent, sub-agent and sub-sub-agent levels work",
        p: [
          "An agent can run a store and, where allowed, bring in sub-agents. A sub-agent can in turn have sub-sub-agents. Each level has its own store and sets prices above the level above it, so everyone earns on the sales they make.",
        ],
      },
      {
        h2: "Steps to get started",
        bullets: [
          "Create your account.",
          "Complete the agent sign-up.",
          "Set up your store name and prices.",
          "Share your store link with customers.",
        ],
      },
    ],
    faqs: [
      { q: "How do I become a data agent in Ghana?", a: "Create an account, complete the agent sign-up and set up your store. Then share your store link." },
      { q: "How do I make money selling data?", a: "You set a selling price above your cost. The difference is your profit on each sale." },
      { q: "What can an agent sell?", a: "Data, airtime, DStv, GOtv, StarTimes, electricity and subscriptions, depending on what is enabled for your account." },
      { q: "What is the difference between agent, sub-agent and sub-sub-agent?", a: "They are levels. Each level has its own store and prices, and earns on its own sales." },
      { q: "Do I need a shop?", a: "No. Your store is online and you share the link." },
    ],
    related: [
      "how-to-start-a-data-reselling-business-in-ghana",
      "how-to-sell-electricity-dstv-gotv-and-make-money",
      "how-to-get-more-customers-for-your-online-business-in-ghana",
    ],
    schema: [],
  },

  products: {
    path: "/products",
    metaTitle: "Marketplace Ghana - Digital Products Online",
    description:
      "Browse the JustBuy GH marketplace in Ghana for digital products from sellers. Pay with MoMo and get access fast. Explore products now.",
    keywords: ["marketplace Ghana", "digital products Ghana", "buy digital products online"],
    h1: "Marketplace Ghana: Digital Products from Local Sellers",
    intro:
      "The JustBuy GH marketplace lists digital products from sellers. Choose a product, pay with mobile money and get access once your payment is confirmed.",
    sections: [],
    faqs: [
      { q: "What is the JustBuy GH marketplace?", a: "It is where sellers list digital products that you can buy and receive online." },
      { q: "How do I pay?", a: "You can pay with mobile money." },
    ],
    related: ["how-to-get-more-customers-for-your-online-business-in-ghana"],
    schema: ["marketplace"],
  },

  gamehub: {
    path: "/gamehub",
    metaTitle: "Play Free Games & Win Data in Ghana - GameHub",
    description:
      "Play free games on the JustBuy GH GameHub and win free MTN data. Free to play in Ghana, with a leaderboard and tournaments. Play now.",
    keywords: ["free games Ghana", "play games win free data", "win free MTN data", "GameHub Ghana"],
    h1: "GameHub: Play Free Games and Win MTN Data in Ghana",
    intro:
      "Play free games, climb the leaderboard and compete in tournaments. Eligible players can win free MTN data. Eligibility rules are shown in the game.",
    sections: [],
    faqs: [
      { q: "Is GameHub free to play?", a: "Yes, the games are free to play." },
      { q: "Can I really win free data?", a: "Eligible players can win free MTN data. Check the eligibility rules shown in the game." },
    ],
    related: [],
    schema: [],
  },
};

export const PAGE_BY_PATH = Object.fromEntries(Object.values(PAGES).map((page) => [page.path, page]));

// Extra paths served by the same screens; keep them aligned with the primary pages.
export const PATH_ALIASES = {
  "/signup": "become-agent",
  "/instant-data": "services",
  "/cheap-data": "packages",
  "/marketplace": "products",
  "/airtime-data": "services",
  "/afa-registration": "afa-bundles",
};

export function getPageForPath(pathname) {
  const clean = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  if (PAGE_BY_PATH[clean]) return PAGE_BY_PATH[clean];
  const alias = PATH_ALIASES[clean];
  return alias ? PAGES[alias] : null;
}
