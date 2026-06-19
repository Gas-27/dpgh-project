import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, ChevronRight, AlertCircle, Ban, CheckCircle, ExternalLink, Wallet, ShoppingCart, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DOMAINS } from "@/config/domains";

interface SubSubagentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  momo_name: string;
  momo_number: string;
  momo_network: string;
  wallet_balance: number;
  top_reference: string;
  approved: boolean;
  suspended?: boolean;
  calculated_balance?: number;
}

interface SubSubagentStoreWithOrders extends SubSubagentStore {
  orders?: any[];
  withdrawals?: any[];
  topups?: any[];
}

interface SubSubagentsListProps {
  subagentStoreId: string;
  subSubagents: SubSubagentStore[];
  onRefresh?: () => void;
}

export default function SubSubagentsList({ subagentStoreId, subSubagents, onRefresh }: SubSubagentsListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubSubagent, setSelectedSubSubagent] = useState<SubSubagentStoreWithOrders | null>(null);
  const [loading, setLoading] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState<string | null>(null);

  const filtered = subSubagents.filter(s =>
    s.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.whatsapp_number.includes(searchTerm) ||
    s.top_reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = async (subSubagent: SubSubagentStore) => {
    try {
      setLoading(true);
      const [ordersResult, withdrawalsResult, topupsResult] = await Promise.all([
        supabase.from("orders").select("*").eq("sub_subagent_store_id", subSubagent.id),
        supabase.from("withdrawal_requests").select("*").eq("sub_subagent_store_id", subSubagent.id),
        supabase.from("wallet_topups").select("*").eq("sub_subagent_store_id", subSubagent.id)
      ]);
      
      const orders = ordersResult.data || [];
      const withdrawals = withdrawalsResult.data || [];
      const topups = topupsResult.data || [];
      
      const customerOrders = orders.filter((o: any) => o.payment_method !== "wallet");
      const totalProfit = customerOrders.reduce((sum: number, order: any) => {
        if (order.status !== "completed" && order.status !== "paid") return sum;
        if (order.profit) return sum + Number(order.profit);
        const baseCost = order.base_price || 0;
        return sum + (Number(order.selling_price || order.amount) - baseCost);
      }, 0);
      const walletPurchases = orders.filter((o: any) => o.payment_method === "wallet").reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);
      const totalTopups = topups.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
      const completedWithdrawals = withdrawals.filter((w: any) => w.status === "completed").reduce((sum: number, w: any) => sum + Number(w.amount), 0);
      const calculatedBalance = totalProfit + totalTopups - completedWithdrawals - walletPurchases;
      
      setSelectedSubSubagent({
        ...subSubagent,
        orders,
        withdrawals,
        topups,
        calculated_balance: calculatedBalance,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load sub-subagent details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (id: string, currentSuspended: boolean) => {
    try {
      setSuspendLoading(id);
      const { error } = await supabase
        .from("sub_subagent_stores")
        .update({ suspended: !currentSuspended })
        .eq("id", id);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: currentSuspended ? "Sub-subagent account has been unsuspended" : "Sub-subagent account has been suspended",
      });
      
      setSelectedSubSubagent(null);
      onRefresh?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update suspension status",
        variant: "destructive",
      });
    } finally {
      setSuspendLoading(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by store name, phone, or reference..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                {subSubagents.length === 0 ? "No sub-subagents yet" : "No sub-subagents match your search"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((subSubagent) => (
              <Card key={subSubagent.id} className={`border-border hover:bg-card/80 transition-colors cursor-pointer ${subSubagent.suspended ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{subSubagent.store_name}</h3>
                        <Badge variant={subSubagent.approved ? "default" : "secondary"}>
                          {subSubagent.approved ? "Active" : "Pending"}
                        </Badge>
                        {subSubagent.suspended && <Badge variant="destructive">Suspended</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Ref: {subSubagent.top_reference}</p>
                      <p className="text-xs text-muted-foreground">{subSubagent.whatsapp_number} • {subSubagent.support_number}</p>
                      <p className="text-sm mt-2 font-semibold text-cyan-400">Wallet: GH₵ {(subSubagent.wallet_balance || 0).toFixed(2)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(subSubagent)} disabled={loading}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedSubSubagent} onOpenChange={() => setSelectedSubSubagent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSubSubagent?.store_name} - Details</DialogTitle>
            <DialogDescription>View orders, withdrawals, and wallet activity</DialogDescription>
          </DialogHeader>

          {selectedSubSubagent && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-border">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Wallet Balance</p>
                    <p className="text-lg font-bold text-cyan-400">GH₵ {(selectedSubSubagent.calculated_balance || 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                    <p className="text-lg font-bold">{selectedSubSubagent.orders?.length || 0}</p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Total Profit</p>
                    <p className="text-lg font-bold text-green-400">
                      GH₵ {(selectedSubSubagent.orders?.reduce((sum: number, o: any) => {
                        if (o.profit) return sum + Number(o.profit);
                        const baseCost = o.base_price || 0;
                        return sum + (Number(o.selling_price || o.amount) - baseCost);
                      }, 0) || 0).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedSubSubagent.orders && selectedSubSubagent.orders.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedSubSubagent.orders.slice(0, 10).map((order: any) => (
                        <div key={order.id} className="text-xs border-b pb-2 flex justify-between">
                          <span>{order.customer_number} - {order.size_gb}GB</span>
                          <span className="font-semibold">GH₵ {(order.amount || order.selling_price || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No orders yet</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant={selectedSubSubagent.suspended ? "default" : "destructive"}
                  className="flex-1"
                  onClick={() => handleSuspend(selectedSubSubagent.id, selectedSubSubagent.suspended || false)}
                  disabled={suspendLoading === selectedSubSubagent.id}
                >
                  {suspendLoading === selectedSubSubagent.id ? "Updating..." : (selectedSubSubagent.suspended ? "Unsuspend" : "Suspend")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
