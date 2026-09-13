import { useState } from "react";
import KorbaPurchasePanel from "@/components/KorbaPurchasePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";

export default function DashboardPurchaseTabs({ walletBalance, ownerType, ownerId }: { walletBalance: number; ownerType: string; ownerId?: string }) {
  const [tab, setTab] = useState("instant");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Wallet-only dashboard payments</span></div>
        <span className="font-display font-bold text-primary">GHC {Number(walletBalance || 0).toFixed(2)}</span>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="instant">Instant Data</TabsTrigger><TabsTrigger value="services">Services</TabsTrigger></TabsList>
        <TabsContent value="instant"><KorbaPurchasePanel mode="instant" walletOnly walletBalance={walletBalance} ownerType={ownerType} ownerId={ownerId} /></TabsContent>
        <TabsContent value="services"><KorbaPurchasePanel mode="services" walletOnly walletBalance={walletBalance} ownerType={ownerType} ownerId={ownerId} /></TabsContent>
      </Tabs>
    </div>
  );
}
