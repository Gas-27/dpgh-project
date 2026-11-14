import type { ApiDocNavItem } from "@/components/ApiDocNav";

export const CHEAP_DATA_NAV: ApiDocNavItem[] = [
  { id: "api-endpoints", label: "Authentication" },
  { id: "cd-delivery", label: "Delivery Progress" },
  { id: "cd-networks", label: "Networks" },
  { id: "cd-get-packages", label: "Get Packages" },
  { id: "cd-check-balance", label: "Check Wallet Balance" },
  { id: "cd-purchase", label: "Purchase" },
  { id: "cd-get-orders", label: "Get Orders" },
  { id: "cd-track-order", label: "Track Order" },
  { id: "cd-statuses", label: "Order Statuses" },
  { id: "webhooks", label: "Webhooks" },
  { id: "cd-errors", label: "Errors" },
  { id: "cd-notes", label: "Notes" },
];

export const SOCIAL_BOOST_NAV: ApiDocNavItem[] = [
  { id: "sb-auth", label: "1. Authentication" },
  { id: "sb-services", label: "2. Services" },
  { id: "sb-order", label: "3. Create Order" },
  { id: "sb-manage", label: "4. Manage Orders" },
  { id: "sb-flow", label: "5. Integration Flow" },
  { id: "sb-errors", label: "Errors" },
];

export const DATA_AIRTIME_NAV: ApiDocNavItem[] = [
  { id: "pd-commission", label: "Commission" },
  { id: "pd-auth", label: "1. Authentication" },
  { id: "pd-catalogue", label: "2. Catalogue" },
  { id: "pd-live-catalogue", label: "3. Live Catalogue" },
  { id: "pd-buy-data", label: "3. Buy Data" },
  { id: "pd-buy-airtime", label: "4. Buy Airtime" },
  { id: "pd-response", label: "5. Response" },
  { id: "pd-flow", label: "6. Integration Flow" },
  { id: "pd-errors", label: "Errors" },
];

export const UTILITIES_NAV: ApiDocNavItem[] = [
  { id: "pd-commission", label: "Commission" },
  { id: "pd-auth", label: "1. Authentication" },
  { id: "pd-lookup", label: "2. Lookup" },
  { id: "pd-fields", label: "3. Required Fields" },
  { id: "pd-pay-bill", label: "4. Pay a Bill" },
  { id: "pd-response", label: "5. Response" },
  { id: "pd-flow", label: "6. Integration Flow" },
  { id: "pd-errors", label: "Errors" },
];

export const BULK_SMS_NAV: ApiDocNavItem[] = [
  { id: "pd-pricing", label: "Pricing" },
  { id: "pd-auth", label: "1. Authentication" },
  { id: "pd-sender", label: "2. Sender ID" },
  { id: "pd-balance", label: "3. Balance" },
  { id: "pd-send", label: "4. Send SMS" },
  { id: "pd-status", label: "5. Check Message" },
  { id: "pd-example", label: "6. Node.js Example" },
  { id: "pd-errors", label: "Errors" },
];

export const AFA_NAV: ApiDocNavItem[] = [
  { id: "afa-auth", label: "Authentication" },
  { id: "afa-register", label: "Register" },
  { id: "afa-examples", label: "Code Examples" },
  { id: "afa-errors", label: "Errors" },
  { id: "afa-webhooks", label: "Webhooks" },
];
