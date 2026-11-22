import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TabIntro {
  title: string;
  body: string;
  steps: string[];
}

const INTROS: Record<string, TabIntro> = {
  buy: { title: "Buy Data", body: "Buy data bundles for any number straight from your wallet.", steps: ["Pick a network and bundle size.", "Enter the phone number to receive the data.", "Confirm and the cost is taken from your wallet."] },
  bulk: { title: "Bulk Orders", body: "Send many data orders in one go.", steps: ["Paste numbers with their bundle sizes.", "Check the total cost against your wallet.", "Submit and the orders are processed together."] },
  "instant-data": { title: "Instant Data", body: "Instant delivery data bundles bought from your wallet.", steps: ["Choose a network and package.", "Enter the recipient number.", "Pay from your wallet and the data is sent right away."] },
  subscription: { title: "Subscription", body: "Long-validity subscription bundles.", steps: ["Choose a subscription package.", "Enter the recipient number.", "Pay from your wallet to activate it."] },
  "subscription-price": { title: "Subscription Prices", body: "Set the prices your customers pay for subscriptions.", steps: ["Enter your selling price next to each package.", "Your profit is the difference between your price and your cost.", "Save to publish the new prices."] },
  store: { title: "Store Prices", body: "Set what your customers pay for each data package in your store.", steps: ["Enter your selling price per package.", "Keep it above your cost so you make a profit.", "Save and your storefront updates."] },
  pricing: { title: "Pricing", body: "Control the selling prices in your store.", steps: ["Edit the price of each package.", "Your profit is price minus cost.", "Save to apply the changes."] },
  topup: { title: "Top Up", body: "Add money to your wallet so you can buy data and services.", steps: ["Enter the amount you want to add.", "Pay with Mobile Money.", "The balance appears in your wallet when payment completes."] },
  withdraw: { title: "Withdraw", body: "Cash out your earnings to Mobile Money.", steps: ["Enter the amount and your Mobile Money details.", "Submit the request.", "It shows as pending until it is paid out."] },
  promo: { title: "Promo Codes", body: "Create discount codes for your customers.", steps: ["Create a code and set its discount.", "Share the code with customers.", "Track how many times it has been used."] },
  domains: { title: "Domains", body: "Connect your own domain to your store.", steps: ["Search for the domain you want.", "Pay from your wallet to register it.", "Your store opens on your own web address."] },
  sms: { title: "Bulk SMS", body: "Send text messages to many people at once.", steps: ["Write your message and add recipients.", "Send now or schedule it for later.", "Check the History tab for delivery."] },
  "social-boost": { title: "Social Boost", body: "Grow followers, likes and views on social media.", steps: ["Pick a service and paste your link.", "Enter the quantity.", "Pay from your wallet and track the order."] },
  subagents: { title: "Subagents", body: "Manage the agents who sell under you.", steps: ["Share your subagent link so people can register.", "Approve or manage their accounts.", "You earn profit from their sales."] },
  "sub-subagents": { title: "Sub-subagents", body: "Manage the agents who sell under your subagents.", steps: ["Share your invite link.", "Review who has joined.", "Earn commission on their activity."] },
  "subagent-prices": { title: "Subagent Prices", body: "Set the price your subagents pay for each package.", steps: ["Enter a price for every package.", "Your profit is what they pay minus your cost.", "Save to apply the prices."] },
  afa: { title: "AFA Registration", body: "Register customers for AFA.", steps: ["Fill in the customer details.", "Submit the registration.", "Follow its progress in the status list."] },
  "afa-registrations": { title: "AFA Registrations", body: "See the AFA registrations you have submitted.", steps: ["Browse your submissions.", "Check each status.", "Contact support if one is stuck."] },
  orders: { title: "Orders", body: "All orders made through your store.", steps: ["Search or filter your orders.", "Check the delivery status.", "Report problems from here."] },
  history: { title: "History", body: "A record of your past activity and transactions.", steps: ["Scroll or filter to find a transaction.", "Check amounts and statuses.", "Use it to confirm payments."] },
  refunds: { title: "Refunds", body: "Track refunds for failed orders.", steps: ["See which orders were refunded.", "Refunded money returns to your wallet.", "Contact support if something looks wrong."] },
  reports: { title: "Reports", body: "Summaries of your sales and profit.", steps: ["Pick a date range.", "Review revenue and profit.", "Use it to see how your store is doing."] },
  marketplace: { title: "Marketplace", body: "Browse products posted by other sellers.", steps: ["Scroll through the listings.", "Open one to see the details.", "Contact the seller to buy."] },
  products: { title: "My Products", body: "Post and manage your own products.", steps: ["Add a product with photos and a price.", "Edit or remove it any time.", "Buyers can find it in the marketplace."] },
  marketing: { title: "Marketing", body: "Tools to promote your store.", steps: ["Pick a tool or template.", "Customise it with your store details.", "Share it with your customers."] },
  flyer: { title: "Flyer", body: "Make a flyer for your store.", steps: ["Choose a design.", "Add your store details.", "Download and share it."] },
  "mashup-flyer": { title: "Mashup Flyer", body: "Combine your store into a ready-made flyer.", steps: ["Pick a layout.", "Add your details.", "Download and share it."] },
  appearance: { title: "Appearance", body: "Change how your storefront looks.", steps: ["Edit colours, logo and layout.", "Preview your changes.", "Save to update the live store."] },
  settings: { title: "Settings", body: "Manage your account and store details.", steps: ["Update your profile and payout details.", "Change your store information.", "Save your changes."] },
  notifications: { title: "Notifications", body: "Messages and alerts about your account.", steps: ["Read new updates here.", "Open one for details.", "Turn on push alerts to never miss one."] },
  "api-key": { title: "API Key", body: "Connect your own website or app to our data service.", steps: ["Create your API key and keep it secret.", "Use it in your app to place orders.", "Top up your API wallet to cover orders."] },
  "api-docs": { title: "API Docs", body: "How to use the API.", steps: ["Read the endpoints.", "Copy the example requests.", "Test with your API key."] },
  "api-orders": { title: "API Orders", body: "Orders placed through your API key.", steps: ["See every API order.", "Check its status.", "Contact support if one failed."] },
  approvals: { title: "Approvals", body: "Requests waiting for your decision.", steps: ["Review each request.", "Approve or decline.", "Approved items go live right away."] },
  complaints: { title: "Complaints", body: "Report and track order problems.", steps: ["Submit a complaint with the order details.", "Wait for our team to respond.", "Check back here for the outcome."] },
  registrations: { title: "Registrations", body: "People who registered under you.", steps: ["See who has joined.", "Check their status.", "Follow up where needed."] },
  schedule: { title: "Schedule", body: "Plan messages to go out later.", steps: ["Write your message.", "Choose the date and time.", "It sends automatically."] },
  send: { title: "Send SMS", body: "Send a message right now.", steps: ["Write your message.", "Add the recipients.", "Send and check History."] },
  services: { title: "Services", body: "All the services you can buy from one place.", steps: ["Pick a service.", "Fill in the details.", "Pay from your wallet."] },
  register: { title: "Register", body: "Sign people up under your store.", steps: ["Enter their details.", "Submit the form.", "They appear in your list."] },
  "afa-pricing": { title: "AFA Pricing", body: "Set the AFA registration price for your store.", steps: ["Enter your price.", "Your profit is price minus cost.", "Save to apply."] },
  "afa-reg-status": { title: "AFA Status", body: "Check where your AFA registrations are.", steps: ["Find a registration.", "Read its status.", "Contact support if it is stuck."] },
  "sub-subagent-pricing": { title: "Sub-subagent Prices", body: "Set the prices your sub-subagents pay.", steps: ["Enter a price per package.", "Your profit is the gap above your cost.", "Save to apply."] },
};

interface TabIntroDialogProps {
  activeTab: string;
  storageKey: string;
}

export default function TabIntroDialog({ activeTab, storageKey }: TabIntroDialogProps) {
  const [shownTab, setShownTab] = useState<string | null>(null);

  useEffect(() => {
    if (!INTROS[activeTab]) return;
    try {
      const seen: string[] = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
      if (seen.includes(activeTab)) return;
    } catch {
      return;
    }
    setShownTab(activeTab);
  }, [activeTab, storageKey]);

  const dismiss = () => {
    if (shownTab) {
      try {
        const seen: string[] = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
        window.localStorage.setItem(storageKey, JSON.stringify([...new Set([...seen, shownTab])]));
      } catch {
        // storage unavailable; the intro may show again next time
      }
    }
    setShownTab(null);
  };

  const intro = shownTab ? INTROS[shownTab] : null;

  return (
    <Dialog open={intro !== null} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="max-w-sm">
        {intro && (
          <>
            <DialogHeader>
              <DialogTitle>{intro.title}</DialogTitle>
              <DialogDescription>{intro.body}</DialogDescription>
            </DialogHeader>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              {intro.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <DialogFooter>
              <Button onClick={dismiss}>Got it</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
