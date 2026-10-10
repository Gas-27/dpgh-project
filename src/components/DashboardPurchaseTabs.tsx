import HubtelPurchasePanel from "@/components/HubtelPurchasePanel";
import AgentDigitalServicesPricing from "@/components/AgentDigitalServicesPricing";
import DigitalServicesCatalog, { type Service } from "@/components/DigitalServicesCatalog";
import ServicePurchaseDialog from "@/components/ServicePurchaseDialog";
import { Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SocialBoostPricingManager from "@/components/SocialBoostPricingManager";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ActiveTabMaintenance from "@/components/ActiveTabMaintenance";
import SocialBoostPurchasePanel from "@/components/SocialBoostPurchasePanel";

type DashboardTab = "instant" | "services" | "subscription" | "subscription-price" | "social-boost";

type Props = {
  walletBalance: number;
  ownerType: string;
  ownerId?: string;
  canSetPrices?: boolean;
  initialTab?: DashboardTab;
  onMaintenanceReturn?: () => void;
};

export default function DashboardPurchaseTabs({ walletBalance, ownerType, ownerId, canSetPrices = false, initialTab = "instant", onMaintenanceReturn }: Props) {
  const [service, setService] = useState<Service | null>(null);
  const wallet = Number(walletBalance || 0);
  const historyCategory = initialTab === "services" ? "services" : initialTab === "subscription" ? "subscription" : "instant";

  if (initialTab === "social-boost") {
    return <section className="relative space-y-4">
      <ActiveTabMaintenance active="social-boost" label="Social Boost" onReturn={onMaintenanceReturn} />
      <Tabs defaultValue="purchase" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        {canSetPrices && <TabsTrigger value="pricing">Set prices</TabsTrigger>}
        <TabsTrigger value="purchase">Purchase Social Boost</TabsTrigger>
      </TabsList>
      {canSetPrices && <TabsContent value="pricing"><SocialBoostPricingManager /></TabsContent>}
      <TabsContent value="purchase"><SocialBoostPurchasePanel walletBalance={wallet} ownerType={ownerType} canSetPrices={false} checkoutMode="wallet" /></TabsContent>
      </Tabs>
    </section>;
  }

  if (initialTab === "subscription-price") {
    return canSetPrices ? <AgentDigitalServicesPricing agentStoreId={ownerId ?? ""} /> : null;
  }

  if (initialTab === "subscription") {
    return (
      <section className="space-y-4">
        <WalletBanner balance={wallet} label="Wallet-only subscription purchases" />
        <Tabs defaultValue="subscription" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="subscription">Subscription</TabsTrigger><TabsTrigger value="history">Purchase History</TabsTrigger></TabsList>
          <TabsContent value="subscription"><DigitalServicesCatalog agentStoreId={ownerId} onBuy={setService} /><ServicePurchaseDialog service={service} ownerType={ownerType} ownerId={ownerId} onOpenChange={(open) => { if (!open) setService(null); }} /></TabsContent>
          <TabsContent value="history"><PurchaseHistory ownerType={ownerType} ownerId={ownerId} category="subscription" /></TabsContent>
        </Tabs>
      </section>
    );
  }

  const maintenanceKey = initialTab === "services" ? "services" : initialTab === "subscription" ? "subscription" : initialTab === "social-boost" ? "social-boost" : "instant";

  return (
  <section className="relative space-y-4">
  <WalletBanner balance={wallet} label="Wallet-only dashboard payments" />
  <ActiveTabMaintenance active={maintenanceKey} label={maintenanceKey === "instant" ? "Data and Airtime" : maintenanceKey === "social-boost" ? "Social Boost" : maintenanceKey} onReturn={onMaintenanceReturn} />
      <Tabs defaultValue="purchase" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="purchase">{initialTab === "services" ? "Utilities" : initialTab === "subscription" ? "Subscription" : "Instant Data & Airtime"}</TabsTrigger>
          <TabsTrigger value="history">Purchase History</TabsTrigger>
        </TabsList>
        <TabsContent value="purchase">
          {initialTab === "services" ? <>
            <HubtelPurchasePanel mode="services" walletOnly walletBalance={wallet} ownerType={ownerType} ownerId={ownerId} />
            <DigitalServicesCatalog agentStoreId={ownerId} onBuy={setService} />
            <ServicePurchaseDialog service={service} ownerType={ownerType} ownerId={ownerId} onOpenChange={(open) => { if (!open) setService(null); }} />
          </> : <HubtelPurchasePanel mode="instant" walletOnly walletBalance={wallet} ownerType={ownerType} ownerId={ownerId} />}
        </TabsContent>
        <TabsContent value="history"><PurchaseHistory ownerType={ownerType} ownerId={ownerId} category={historyCategory} /></TabsContent>
      </Tabs>
    </section>
  );
}

type PurchaseHistoryProps = { ownerType: string; ownerId?: string; category: "instant" | "services" | "subscription" };
function PurchaseHistory({ ownerType, ownerId, category }: PurchaseHistoryProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!ownerId) { setLoading(false); return; }
      setLoading(true);
      const ownerColumn = ownerType === "agent" ? "agent_store_id" : ownerType === "subagent" ? "subagent_store_id" : "sub_subagent_store_id";
      const { data } = await supabase.from("orders").select("id, network, size_gb, size_gb_text, amount, selling_price, status, fulfillment_status, created_at, source, customer_number, package_id").eq(ownerColumn, ownerId).order("created_at", { ascending: false }).limit(100);
      if (active) {
        const filtered = (data || []).filter((row) => {
          const source = String(row.source || "").toLowerCase();
          const network = String(row.network || "").toLowerCase();
          const packageId = String(row.package_id || "").toLowerCase();
          const isService = ["service", "services", "utility", "utilities", "ecg", "water", "tv", "subscription", "subscriptions"].some((value) => source.includes(value) || network.includes(value) || packageId.includes(value));
          if (category === "instant") return !isService && Boolean(row.network || row.size_gb || row.size_gb_text || ["airtime", "data"].some((value) => source.includes(value)));
          return category === "subscription" ? source.includes("subscription") || network.includes("subscription") : isService && !source.includes("subscription") && !network.includes("subscription");
        });
        setRows(filtered);
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [ownerId, ownerType, category]);
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading purchase history...</p>;
  if (!rows.length) return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No purchases found for this section yet.</p>;
  return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Purchase</th><th className="p-3 text-left">Recipient</th><th className="p-3 text-left">Amount</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-3">{new Date(row.created_at).toLocaleString()}</td><td className="p-3">{row.network || row.source || "Purchase"}{row.size_gb_text || row.size_gb ? ` · ${row.size_gb_text || `${row.size_gb}GB`}` : ""}</td><td className="p-3">{row.customer_number || "—"}</td><td className="p-3">GHC {Number(row.selling_price ?? row.amount ?? 0).toFixed(2)}</td><td className="p-3 capitalize">{String(row.fulfillment_status || row.status || "pending").replaceAll("_", " ")}</td></tr>)}</tbody></table></div>;
}

function WalletBanner({ balance, label }: { balance: number; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{label}</span></div>
      <span className="font-bold text-primary">GHC {balance.toFixed(2)}</span>
    </div>
  );
}
