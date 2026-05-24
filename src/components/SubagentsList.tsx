import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ChevronRight, AlertCircle, Ban, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  momo_name: string;
  momo_number: string;
  momo_network: string;
  wallet_balance: number;
  approved: boolean;
  suspended?: boolean;
  // Calculated fields
  calculated_balance?: number;
}

interface SubagentStoreWithOrders extends SubagentStore {
  orders?: any[];
  withdrawals?: any[];
  topups?: any[];
}

interface SubagentsListProps {
  agentStoreId: string;
  subagents: SubagentStore[];
  onRefresh?: () => void;
}

export default function SubagentsList({ agentStoreId, subagents, onRefresh }: SubagentsListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubagent, setSelectedSubagent] = useState<SubagentStoreWithOrders | null>(null);
  const [loading, setLoading] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState<string | null>(null);

  const filtered = subagents.filter(s =>
    s.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.whatsapp_number.includes(searchTerm)
  );

  const handleViewDetails = async (subagent: SubagentStore) => {
    try {
      setLoading(true);
      // Fetch orders, withdrawals, and topups in parallel
      const [ordersResult, withdrawalsResult, topupsResult] = await Promise.all([
        supabase.from("orders").select("*").eq("subagent_store_id", subagent.id),
        supabase.from("withdrawal_requests").select("*").eq("subagent_store_id", subagent.id),
        supabase.from("subagent_wallet_topups").select("*").eq("subagent_store_id", subagent.id)
      ]);
      
      const orders = ordersResult.data || [];
      const withdrawals = withdrawalsResult.data || [];
      const topups = topupsResult.data || [];
      
      // Calculate the actual wallet balance
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
      
      setSelectedSubagent({
        ...subagent,
        orders,
        withdrawals,
        topups,
        calculated_balance: calculatedBalance,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load subagent details",
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
        .from("subagent_stores")
        .update({ suspended: !currentSuspended })
        .eq("id", id);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: currentSuspended ? "Subagent account has been unsuspended" : "Subagent account has been suspended",
      });
      
      setSelectedSubagent(null);
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
            placeholder="Search by store name or phone..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                {subagents.length === 0 ? "No subagents yet" : "No subagents match your search"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((subagent) => (
              <Card key={subagent.id} className={`border-border hover:bg-card/80 transition-colors cursor-pointer ${subagent.suspended ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{subagent.store_name}</h3>
                        {subagent.suspended && (
                          <Badge variant="destructive" className="text-xs">Suspended</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{subagent.whatsapp_number}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(subagent)}
                      className="ml-4 flex-shrink-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedSubagent} onOpenChange={(open) => !open && setSelectedSubagent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedSubagent?.store_name}</DialogTitle>
          </DialogHeader>
          
          {selectedSubagent && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">WhatsApp</p>
                  <p className="font-semibold">{selectedSubagent.whatsapp_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Support</p>
                  <p className="font-semibold">{selectedSubagent.support_number}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">MoMo Account</p>
                  <p className="font-semibold">
                    {selectedSubagent.momo_name} • {selectedSubagent.momo_number} • {selectedSubagent.momo_network.toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Wallet Balance</p>
                    <p className="text-2xl font-bold text-green-400">GH₵ {(selectedSubagent.calculated_balance ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold text-blue-400">{selectedSubagent.orders?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {selectedSubagent.suspended ? (
                      <Badge className="bg-red-600/20 text-red-400 border-red-600/30 mt-1">Suspended</Badge>
                    ) : (
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/30 mt-1">Active</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Recent Orders</h4>
                {selectedSubagent.orders && selectedSubagent.orders.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedSubagent.orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="text-sm p-2 rounded border border-border">
                        <p className="font-medium">{order.network.toUpperCase()} - {order.size_gb}GB</p>
                        <p className="text-xs text-muted-foreground">GH₵ {order.amount}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No orders yet</p>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                {selectedSubagent.suspended ? (
                  <Button
                    variant="default"
                    onClick={() => handleSuspend(selectedSubagent.id, true)}
                    disabled={suspendLoading === selectedSubagent.id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> 
                    {suspendLoading === selectedSubagent.id ? "Processing..." : "Unsuspend Account"}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => handleSuspend(selectedSubagent.id, false)}
                    disabled={suspendLoading === selectedSubagent.id}
                    className="flex-1"
                  >
                    <Ban className="h-4 w-4 mr-2" /> 
                    {suspendLoading === selectedSubagent.id ? "Processing..." : "Suspend Account"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setSelectedSubagent(null)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
