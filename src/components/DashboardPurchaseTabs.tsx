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
  {canSetPrices && <TabsContent value="pricing"><SocialBoostPricingManager ownerId={ownerId} ownerType={ownerType} /></TabsContent>}
  <TabsContent value="purchase"><SocialBoostPurchasePanel walletBalance={wallet} ownerType={ownerType} storeId={ownerId} canSetPrices={false} checkoutMode="wallet" purchaseSource="Dashboard" /></TabsContent>
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
          <TabsContent value="history"><SubscriptionHistory ownerType={ownerType} ownerId={ownerId} /></TabsContent>
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

type SubscriptionHistoryRow = {
  id: string;
  created_at: string;
  source: "dashboard" | "storefront";
  service_name: string | null;
  customer_number: string | null;
  amount: number;
  cost: number;
  profit: number;
  status: string | null;
};

const SUBSCRIPTION_SOURCE_FILTERS = [
  { key: "all", label: "All" },
  { key: "dashboard", label: "Dashboard" },
  { key: "storefront", label: "Store Front" },
] as const;

function SubscriptionHistory({ ownerType, ownerId }: { ownerType: string; ownerId?: string }) {
  const [rows, setRows] = useState<SubscriptionHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<(typeof SUBSCRIPTION_SOURCE_FILTERS)[number]["key"]>("all");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!ownerId) { setLoading(false); return; }
      setLoading(true);
      setFailed(false);
      const { data, error } = await supabase.rpc("get_subscription_history" as any, { p_owner_type: ownerType, p_owner_id: ownerId });
      if (!active) return;
      if (error) {
        console.error("[v0] Subscription history query failed", error);
        setFailed(true);
        setRows([]);
      } else {
        setRows(((data as any[]) || []).map((row) => ({ ...row, amount: Number(row.amount ?? 0), cost: Number(row.cost ?? 0), profit: Number(row.profit ?? 0) })));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [ownerId, ownerType]);

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading purchase history...</p>;
  if (failed) return <p className="rounded-xl border border-dashed border-destructive/40 p-8 text-center text-sm text-destructive">Could not load purchase history. Please refresh and try again.</p>;

  const visible = rows.filter((row) => filter === "all" || row.source === filter);
  const isCompleted = (row: SubscriptionHistoryRow) => String(row.status || "").toLowerCase() === "completed";
  const completed = visible.filter(isCompleted);
  const totalSales = completed.reduce((sum, row) => sum + row.amount, 0);
  const totalProfit = completed.reduce((sum, row) => sum + row.profit, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter subscription purchases by source">
          {SUBSCRIPTION_SOURCE_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === option.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Sales: <strong className="text-foreground">GHC {totalSales.toFixed(2)}</strong></span>
          <span className="text-muted-foreground">Profit: <strong className="text-emerald-600">GHC {totalProfit.toFixed(2)}</strong></span>
        </div>
      </div>

      {!visible.length ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No subscription purchases found for this filter yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Subscription</th>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Recipient</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Cost</th>
                <th className="p-3 text-left">Profit</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.source}-${row.id}`} className="border-t border-border">
                  <td className="p-3">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="p-3">{row.service_name || "Subscription"}</td>
                  <td className="p-3">{row.source === "storefront" ? "Store Front" : "Dashboard"}</td>
                  <td className="p-3">{row.customer_number || "—"}</td>
                  <td className="p-3">GHC {row.amount.toFixed(2)}</td>
                  <td className="p-3">GHC {row.cost.toFixed(2)}</td>
                  <td className="p-3 font-medium text-emerald-600">{row.source === "storefront" && isCompleted(row) ? `GHC ${row.profit.toFixed(2)}` : "—"}</td>
                  <td className="p-3 capitalize">{String(row.status || "pending").replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
      const normalizedOwnerType = ownerType === "sub_subagent" || ownerType === "subsubagent" ? "subsubagent" : ownerType;
      const { data: history, error } = await supabase.rpc("get_korba_history", { p_owner_type: normalizedOwnerType, p_owner_id: ownerId });
      if (!active) return;
      if (error) {
        console.error("[v0] Korba transaction history query failed", error);
        setRows([]);
        setLoading(false);
        return;
      }
      const normalize = (value: unknown) => String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
      // API purchases exist only for agents and customers (users); subagents and sub-subagents have no API wallet.
      const hasApiHistory = normalizedOwnerType === "agent" || normalizedOwnerType === "customer";
      const { data: apiHistory, error: apiHistoryError } = hasApiHistory
        ? await supabase.rpc("get_api_purchase_history" as any, { p_owner_type: normalizedOwnerType, p_owner_id: ownerId })
        : { data: [], error: null };
      if (apiHistoryError) console.error("[v0] API purchase history query failed", apiHistoryError);
      const apiRows = ((apiHistory as any[]) || []).map((row) => ({ ...row, amount: Number(row.amount ?? 0) }));
      const instantServices = ["data", "airtime"];
      const utilityServices = ["ecg", "electricity", "water", "ghanawater", "dstv", "gotv", "startimes"];
      const rows = [
        ...(history || []).filter((row: any) => {
          const product = normalize(row.product_type);
          const source = normalize(row.source);
          // Instant Data & Airtime is the normal retail purchase history. API/cheap-data
          // wallet orders must stay in API history and must not appear in this tab.
          if (category === "instant") {
            return instantServices.includes(product) && !["api", "apiwallet", "partnerapi", "cheapdata"].includes(source);
          }
          if (category === "services") return utilityServices.includes(product);
          return product === "subscription";
        }),
        ...apiRows.filter((row: any) => {
          const product = normalize(row.product_type);
          if (category === "instant") return false;
          if (category === "services") return utilityServices.includes(product);
          return false;
        }),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRows(rows);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [ownerId, ownerType, category]);
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading purchase history...</p>;
  if (!rows.length) return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No purchases found for this section yet.</p>;

  const commissionRate = (row: any) => {
    const product = String(row.product_type || row.service_type || row.network || row.source || "").toLowerCase().replace(/[\s_-]+/g, "");
    if (category === "instant") return 0.013;
    if (product.includes("gotv") || product.includes("dstv")) return 0.0023;
    if (product.includes("startime") || product.includes("startimes")) return 0.0015;
    if (product.includes("ecg") || product.includes("electricity")) return 0.005;
    if (product.includes("water") || product.includes("gwcl") || product.includes("ghanawater")) return 0.0024;
    return 0;
  };
  const isCompleted = (row: any) => String(row.status || row.fulfillment_status || "pending").toLowerCase().replace(/[\s_-]+/g, "") === "completed";
  const commissionFor = (row: any) => isCompleted(row) ? Number(row.amount ?? row.selling_price ?? 0) * commissionRate(row) : 0;

  return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Purchase</th><th className="p-3 text-left">Recipient</th><th className="p-3 text-left">Amount</th><th className="p-3 text-left">Your commission is credited to your wallet</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-3">{new Date(row.created_at).toLocaleString()}</td><td className="p-3">{row.network_code || row.product_type || row.network || row.source || "Purchase"}{row.package_code || row.size_gb_text || row.size_gb ? ` · ${row.package_code || row.size_gb_text || `${row.size_gb}GB`}` : ""}</td><td className="p-3">{row.customer_number || row.phone_number || "—"}</td><td className="p-3">GHC {Number(row.amount ?? row.selling_price ?? 0).toFixed(2)}</td><td className="p-3 font-medium text-emerald-600">{isCompleted(row) ? `GHC ${commissionFor(row).toFixed(2)} · Added to MyWallet` : "—"}</td><td className="p-3 capitalize">{String(row.status || row.fulfillment_status || "pending").replaceAll("_", " ")}</td></tr>)}</tbody></table></div>;
}

function WalletBanner({ balance, label }: { balance: number; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{label}</span></div>
      <span className="font-bold text-primary">GHC {balance.toFixed(2)}</span>
    </div>
  );
}
