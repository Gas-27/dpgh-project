import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface TutorialStep {
  title: string;
  description: string;
  image: string;
  tabId?: string;
}

export const USER_TUTORIAL: TutorialStep[] = [
  { title: "Welcome to your dashboard", description: "Overview shows your wallet balance, recent orders and quick actions. Use the Menu at the top left to move between sections.", image: "/tutorial/overview.png", tabId: "overview" },
  { title: "Top up your wallet", description: "Open Top Up to add money to your wallet with Mobile Money. Your balance is used whenever you buy data, airtime or services.", image: "/tutorial/topup.png", tabId: "topup" },
  { title: "Buy data", description: "Open Buy Data, choose a network and bundle, enter the phone number and pay from your wallet.", image: "/tutorial/buy-data.png", tabId: "buy-data" },
  { title: "Track your orders", description: "Orders lists everything you have bought, with live status. If something goes wrong, use Refunds or Report an Issue.", image: "/tutorial/orders.png", tabId: "orders" },
  { title: "Connect with the API", description: "Need to sell from your own website? Generate your key in API Key, then follow the step-by-step guides in API Docs.", image: "/tutorial/api.png", tabId: "api-key" },
  { title: "Become an agent", description: "Want to resell and earn? Open Become an Agent to get your own store with prices you control.", image: "/tutorial/subagents.png", tabId: "become-agent" },
];

export const AGENT_TUTORIAL: TutorialStep[] = [
  { title: "Welcome, agent", description: "This dashboard runs your store. Four quick steps will show you how it all works.", image: "/tutorial/overview.png", tabId: "overview" },
  { title: "1. Set your store prices", description: "Go to Store Prices and set the price your customers pay for each bundle. Save, and your store updates straight away.", image: "/tutorial/store-prices.png", tabId: "store" },
  { title: "2. Set prices for your subagents", description: "Go to Subagent Prices and set what your subagents pay you for each bundle. Remember to save.", image: "/tutorial/subagents.png", tabId: "subagent-prices" },
  { title: "3. Buy data from your wallet", description: "Open Buy Data to buy bundles for any customer using your wallet balance. Top up first if your balance is low.", image: "/tutorial/buy-data.png", tabId: "buy" },
  { title: "4. Manage your subagents", description: "Open Subagents to add and manage your team. They sell under your store and you earn from every sale.", image: "/tutorial/subagents.png", tabId: "subagents" },
];

export const SUBAGENT_TUTORIAL: TutorialStep[] = [
  { title: "Welcome, subagent", description: "This dashboard runs your own store under your agent. Here is how it works.", image: "/tutorial/overview.png", tabId: "overview" },
  { title: "1. Set your store prices", description: "Go to Store Prices and set the price your customers pay for each bundle. Save your changes.", image: "/tutorial/store-prices.png", tabId: "store" },
  { title: "2. Set prices for your team", description: "Go to Subagent Pricing to set what your own subagents pay you. Save when you are done.", image: "/tutorial/subagents.png", tabId: "sub-subagent-pricing" },
  { title: "3. Buy data from your wallet", description: "Open Buy Data to buy bundles using your wallet. Top up first if your balance is low.", image: "/tutorial/buy-data.png", tabId: "buy" },
  { title: "4. Track orders", description: "Open Orders to see every sale and its status.", image: "/tutorial/orders.png", tabId: "orders" },
];

export const SUBSUBAGENT_TUTORIAL: TutorialStep[] = [
  { title: "Welcome", description: "This dashboard runs your own store. Here is how it works.", image: "/tutorial/overview.png", tabId: "overview" },
  { title: "1. Set your store prices", description: "Go to Store Prices and set the price your customers pay for each bundle. Save your changes.", image: "/tutorial/store-prices.png", tabId: "store" },
  { title: "2. Buy data from your wallet", description: "Open Buy Data to buy bundles using your wallet. Top up first if your balance is low.", image: "/tutorial/buy-data.png", tabId: "buy" },
  { title: "3. Track orders", description: "Open Orders to see every sale and its status.", image: "/tutorial/orders.png", tabId: "orders" },
];

interface Props {
  storageKey: string;
  userId?: string | null;
  steps: TutorialStep[];
  onNavigate?: (tabId: string) => void;
}

export default function DashboardTutorial({ storageKey, userId, steps, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const key = userId ? `tutorial-seen:${storageKey}:${userId}` : null;

  useEffect(() => {
    if (!key) return;
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      setOpen(false);
    }
  }, [key]);

  const finish = () => {
    if (key) {
      try {
        localStorage.setItem(key, "1");
      } catch {
        // storage unavailable; tutorial will show again next visit
      }
    }
    setOpen(false);
    onNavigate?.(steps[0].tabId ?? "overview");
  };

  const goTo = (next: number) => {
    setIndex(next);
    const tab = steps[next].tabId;
    if (tab) onNavigate?.(tab);
  };

  const step = steps[index];
  const last = index === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) finish(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <img src={step.image} alt="" className="aspect-video w-full object-cover" />
        <div className="space-y-3 p-5">
          <p className="text-xs font-medium text-muted-foreground">Step {index + 1} of {steps.length}</p>
          <DialogTitle className="text-xl">{step.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{step.description}</DialogDescription>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={finish}>Skip</Button>
            <div className="flex gap-2">
              {index > 0 && <Button type="button" variant="outline" size="sm" onClick={() => goTo(index - 1)}>Back</Button>}
              <Button type="button" size="sm" onClick={() => (last ? finish() : goTo(index + 1))}>{last ? "Get started" : "Next"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
