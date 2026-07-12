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
  approved: boolean;
  suspended?: boolean;
  // Calculated fields
  calculated_balance?: number;
}

interface SubSubagentStoreWithOrders extends SubSubagentStore {
  orders?: any[];
  withdrawals?: any[];
  topups?: any[];
}

interface SubSubagentsListProps {
  subagentStoreId: string;
  subagentStoreName: string;
  subSubagents: SubSubagentStore[];
  onRefresh?: () => void;
}

export default function SubSubagentsList({ subagentStoreId, subagentStoreName, subSubagents, onRefresh }: SubSubagentsListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubSubagent, setSelectedSubSubagent] = useState<SubSubagentStoreWithOrders | null>(null);
  const [loading, setLoading] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState<string | null>(null);

  const filtered = subSubagents.filter(s =>
    s.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.whatsapp_number.includes(searchTerm)
  );

  const handleViewDetails = async (subSubagent: SubSubagentStore) => {
    try {
      setLoading(true);
      // Fetch orders, withdrawals, and topups in parallel
      const [ordersResult, withdrawalsResult, topupsResult] = await Promise.all([
        supabase.from("orders").select("*").eq("sub_subagent_store_id", subSubagent.id),
        supabase.from("withdrawal_requests").select("*").eq("sub_subagent_store_id", subSubagent.id),
        supabase.from("sub_subagent_wallet_topups").select("*").eq("sub_subagent_store_id", subSubagent.id)
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{subSubagent.store_name}</h3>
                        {subSubagent.suspended && (
                          <Badge variant="destructive" className="text-xs">Suspended</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{subSubagent.whatsapp_number}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(subSubagent)}
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

      <Dialog open={!!selectedSubSubagent} onOpenChange={(open) => !open && setSelectedSubSubagent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSubSubagent?.store_name}</DialogTitle>
            <DialogDescription>View sub-subagent details, wallet balance, and orders</DialogDescription>
          </DialogHeader>
          
          {selectedSubSubagent && (
            <div className="space-y-6">
              {/* View Shop Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(DOMAINS.getSubSubagentStoreUrl(subagentStoreName, selectedSubSubagent.store_name), "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" /> View Shop
              </Button>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">WhatsApp</p>
                  <p className="font-semibold">{selectedSubSubagent.whatsapp_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Support</p>
                  <p className="font-semibold">{selectedSubSubagent.support_number}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">MoMo Account</p>
                  <p className="font-semibold">
                    {selectedSubSubagent.momo_name} • {selectedSubSubagent.momo_number} • {selectedSubSubagent.momo_network.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Wallet & Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-green-500/30 bg-green-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-green-400" />
                      <p className="text-sm text-muted-foreground">Wallet Balance</p>
                    </div>
                    <p className="text-2xl font-bold text-green-400">GHC {(selectedSubSubagent.calculated_balance ?? 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-500/30 bg-blue-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingCart className="h-4 w-4 text-blue-400" />
                      <p className="text-sm text-muted-foreground">Total Orders</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{selectedSubSubagent.orders?.length || 0}</p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-500/30 bg-yellow-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-yellow-400" />
                      <p className="text-sm text-muted-foreground">Status</p>
                    </div>
                    {selectedSubSubagent.suspended ? (
                      <Badge className="bg-red-600/20 text-red-400 border-red-600/30 mt-1">Suspended</Badge>
                    ) : (
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/30 mt-1">Active</Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Orders List */}
              <div>
                <h4 className="font-semibold mb-3">Orders ({selectedSubSubagent.orders?.length || 0})</h4>
                {selectedSubSubagent.orders && selectedSubSubagent.orders.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedSubSubagent.orders.map((order: any) => (
                      <div key={order.id} className="text-sm p-3 rounded border border-border flex items-center justify-between">
                        <div>
                          <p className="font-medium">{order.network.toUpperCase()} - {order.size_gb}GB</p>
                          <p className="text-xs text-muted-foreground">{order.customer_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">GHC {Number(order.selling_price || order.amount).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30 ml-2" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30 ml-2"}>
                          {order.status === "paid" ? "completed" : order.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No orders yet</p>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                {selectedSubSubagent.suspended ? (
                  <Button
                    variant="default"
                    onClick={() => handleSuspend(selectedSubSubagent.id, true)}
                    disabled={suspendLoading === selectedSubSubagent.id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> 
                    {suspendLoading === selectedSubSubagent.id ? "Processing..." : "Unsuspend Account"}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => handleSuspend(selectedSubSubagent.id, false)}
                    disabled={suspendLoading === selectedSubSubagent.id}
                    className="flex-1"
                  >
                    <Ban className="h-4 w-4 mr-2" /> 
                    {suspendLoading === selectedSubSubagent.id ? "Processing..." : "Suspend Account"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setSelectedSubSubagent(null)}
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
