import { useState } from "react";
import KorbaPurchasePanel from "@/components/KorbaPurchasePanel";
import AgentDigitalServicesPricing from "@/components/AgentDigitalServicesPricing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";

type Props = { walletBalance: number; ownerType: string; ownerId?: string; canSetPrices?: boolean; initialTab?: "instant" | "services" | "subscription" | "subscription-price" };

export default function DashboardPurchaseTabs({ walletBalance, ownerType, ownerId, canSetPrices = false, initialTab = "instant" }: Props) {
  const [tab, setTab] = useState(initialTab);
  const wallet = Number(walletBalance || 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Wallet-only dashboard payments</span></div>
        <span className="font-bold text-primary">GHC {wallet.toFixed(2)}</span>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className={`grid w-full ${canSetPrices ? "grid-cols-4" : "grid-cols-3"}`}>
          <TabsTrigger value="instant">Instant Data</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          {canSetPrices && <TabsTrigger value="subscription-price">Subscription (Price Set)</TabsTrigger>}
        </TabsList>
        <TabsContent value="instant"><KorbaPurchasePanel mode="instant" walletOnly walletBalance={wallet} ownerType={ownerType} ownerId={ownerId} /></TabsContent>
        <TabsContent value="services"><KorbaPurchasePanel mode="services" walletOnly walletBalance={wallet} ownerType={ownerType} ownerId={ownerId} /></TabsContent>
        <TabsContent value="subscription"><KorbaPurchasePanel mode="services" walletOnly walletBalance={wallet} ownerType={ownerType} ownerId={ownerId} /></TabsContent>
        {canSetPrices && <TabsContent value="subscription-price"><AgentDigitalServicesPricing agentStoreId={ownerId ?? ""} /></TabsContent>}
      </Tabs>
    </div>
  );
}
