import KorbaPurchasePanel from "@/components/KorbaPurchasePanel";
import AgentDigitalServicesPricing from "@/components/AgentDigitalServicesPricing";
import DigitalServicesCatalog, { type Service } from "@/components/DigitalServicesCatalog";
import ServicePurchaseDialog from "@/components/ServicePurchaseDialog";
import { Wallet } from "lucide-react";
import { useState } from "react";

type DashboardTab = "instant" | "services" | "subscription" | "subscription-price";

type Props = {
  walletBalance: number;
  ownerType: string;
  ownerId?: string;
  canSetPrices?: boolean;
  initialTab?: DashboardTab;
};

export default function DashboardPurchaseTabs({ walletBalance, ownerType, ownerId, canSetPrices = false, initialTab = "instant" }: Props) {
  const [service, setService] = useState<Service | null>(null);
  const wallet = Number(walletBalance || 0);

  if (initialTab === "subscription-price") {
    return canSetPrices ? <AgentDigitalServicesPricing agentStoreId={ownerId ?? ""} /> : null;
  }

  if (initialTab === "subscription") {
    return (
      <section className="space-y-4">
        <WalletBanner balance={wallet} label="Wallet-only subscription purchases" />
        <DigitalServicesCatalog agentStoreId={ownerId} onBuy={setService} />
        <ServicePurchaseDialog service={service} ownerType={ownerType} ownerId={ownerId} walletBalance={wallet} onOpenChange={(open) => { if (!open) setService(null); }} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <WalletBanner balance={wallet} label="Wallet-only dashboard payments" />
      <KorbaPurchasePanel
        mode={initialTab === "services" ? "services" : "instant"}
        walletOnly
        walletBalance={wallet}
        ownerType={ownerType}
        ownerId={ownerId}
      />
    </section>
  );
}

function WalletBanner({ balance, label }: { balance: number; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{label}</span></div>
      <span className="font-bold text-primary">GHC {balance.toFixed(2)}</span>
    </div>
  );
}
