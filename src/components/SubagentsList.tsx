import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ChevronRight, AlertCircle } from "lucide-react";
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
}

interface SubagentStoreWithOrders extends SubagentStore {
  orders?: any[];
}

interface SubagentsListProps {
  agentStoreId: string;
  subagents: SubagentStore[];
  onSuspend: (id: string) => Promise<void>;
}

export default function SubagentsList({ agentStoreId, subagents, onSuspend }: SubagentsListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubagent, setSelectedSubagent] = useState<SubagentStoreWithOrders | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = subagents.filter(s =>
    s.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.whatsapp_number.includes(searchTerm)
  );

  const handleViewDetails = async (subagent: SubagentStore) => {
    try {
      setLoading(true);
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("subagent_store_id", subagent.id);
      
      setSelectedSubagent({
        ...subagent,
        orders: orders || [],
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

  const handleSuspend = async (id: string) => {
    try {
      await onSuspend(id);
      setSelectedSubagent(null);
      toast({
        title: "Success",
        description: "Subagent account has been suspended",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to suspend account",
        variant: "destructive",
      });
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
              <Card key={subagent.id} className="border-border hover:bg-card/80 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{subagent.store_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{subagent.whatsapp_number}</p>
                      <p className="text-sm font-bold text-green-400 mt-2">GH₵ {Number(subagent.wallet_balance).toFixed(2)}</p>
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
                    <p className="text-sm text-muted-foreground">Total Profit</p>
                    <p className="text-2xl font-bold text-green-400">GH₵ {Number(selectedSubagent.wallet_balance).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold text-blue-400">{selectedSubagent.orders?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className="bg-green-600/20 text-green-400 border-green-600/30 mt-1">Active</Badge>
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
                <Button
                  variant="destructive"
                  onClick={() => handleSuspend(selectedSubagent.id)}
                  className="flex-1"
                >
                  <AlertCircle className="h-4 w-4 mr-2" /> Suspend Account
                </Button>
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
