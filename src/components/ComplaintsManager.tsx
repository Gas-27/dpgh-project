import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Complaint {
  id: string;
  complaint_type: "storefront" | "agent";
  order_id: string;
  agent_store_id: string;
  subagent_store_id: string;
  customer_number: string;
  complaint_title: string;
  complaint_details: string;
  status: "pending" | "in-progress" | "resolved";
  created_at: string;
  orders?: {
    network: string;
    size_gb: number;
    amount: number;
    fulfillment_status: string;
    created_at: string;
  };
  agent_stores?: {
    store_name: string;
    phone_number: string;
  };
  subagent_stores?: {
    store_name: string;
    whatsapp_number: string;
  };
}

export const ComplaintsManager = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [complaintType, setComplaintType] = useState<"storefront" | "agent">("storefront");
  const { toast } = useToast();

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("complaints")
        .select(
          `*,
           orders(network, size_gb, amount, fulfillment_status, created_at),
           agent_stores(store_name, phone_number),
           subagent_stores(store_name, whatsapp_number)`
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComplaints((data as Complaint[]) || []);
    } catch (error) {
      console.error("Error fetching complaints:", error);
      toast({ title: "Error", description: "Failed to load complaints", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredComplaints = complaints.filter(
    (c) =>
      c.complaint_type === complaintType &&
      (c.complaint_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customer_number.includes(searchTerm) ||
        c.agent_stores?.store_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const updateComplaintStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("complaints")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      setComplaints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus as any } : c))
      );
      toast({ title: "Success", description: "Complaint status updated" });
    } catch (error) {
      console.error("Error updating complaint:", error);
      toast({ title: "Error", description: "Failed to update complaint", variant: "destructive" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "in-progress":
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "resolved":
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Resolved</Badge>;
      case "in-progress":
        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">In Progress</Badge>;
      default:
        return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={complaintType} onValueChange={(v: any) => setComplaintType(v)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="storefront">Storefront Complaints</TabsTrigger>
          <TabsTrigger value="agent">Agent Store Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value={complaintType} className="space-y-4 mt-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, customer number or store..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Loading complaints...</CardContent></Card>
          ) : filteredComplaints.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No complaints found</CardContent></Card>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Order Info</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComplaints.map((complaint) => (
                    <TableRow key={complaint.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm">{complaint.complaint_title}</p>
                          <p className="text-xs text-muted-foreground max-w-xs truncate">
                            {complaint.complaint_details}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{complaint.customer_number}</TableCell>
                      <TableCell className="text-sm">
                        {complaint.agent_stores?.store_name || complaint.subagent_stores?.store_name || "N/A"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {complaint.orders && (
                          <div className="space-y-1">
                            <p>{complaint.orders.network} - {complaint.orders.size_gb}GB</p>
                            <p>GH₵{complaint.orders.amount}</p>
                            <p className="text-muted-foreground">{complaint.orders.fulfillment_status}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(complaint.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {complaint.status !== "in-progress" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateComplaintStatus(complaint.id, "in-progress")}
                            >
                              In Progress
                            </Button>
                          )}
                          {complaint.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="hero"
                              onClick={() => updateComplaintStatus(complaint.id, "resolved")}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComplaintsManager;
