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

export const ComplaintsManager = ({ isAgent = false, agentStoreId }: { isAgent?: boolean; agentStoreId?: string } = {}) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [complaintType, setComplaintType] = useState<"storefront" | "agent">("storefront");
  const [tableError, setTableError] = useState(false);
  const [selectedComplaints, setSelectedComplaints] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setTableError(false);
      let query = supabase
        .from("complaints")
        .select(
          `*,
           orders(network, size_gb, amount, fulfillment_status, created_at),
           agent_stores(store_name, phone_number),
           subagent_stores(store_name, whatsapp_number)`
        )
        .order("created_at", { ascending: false });

      // If viewing as agent, only show complaints from their store
      if (isAgent && agentStoreId) {
        query = query.eq("agent_store_id", agentStoreId);
      }

      const { data, error } = await query;

      if (error) {
        if (error.message?.includes("Could not find the table")) {
          setTableError(true);
          return;
        }
        throw error;
      }
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

  const bulkUpdateStatus = async (newStatus: string) => {
    try {
      setBulkUpdating(true);
      const complaintIds = Array.from(selectedComplaints);
      
      if (complaintIds.length === 0) {
        toast({ title: "Error", description: "No complaints selected", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("complaints")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in("id", complaintIds);

      if (error) throw error;
      
      setComplaints((prev) =>
        prev.map((c) => (selectedComplaints.has(c.id) ? { ...c, status: newStatus as any } : c))
      );
      
      setSelectedComplaints(new Set());
      setSelectAll(false);
      toast({ title: "Success", description: `${complaintIds.length} complaint(s) marked as ${newStatus}` });
    } catch (error) {
      console.error("Error bulk updating:", error);
      toast({ title: "Error", description: "Failed to update complaints", variant: "destructive" });
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const pendingIds = new Set(filteredComplaints.filter(c => c.status === "in-progress").map(c => c.id));
      setSelectedComplaints(pendingIds);
    } else {
      setSelectedComplaints(new Set());
    }
  };

  const handleSelectComplaint = (complaintId: string, checked: boolean) => {
    const newSelected = new Set(selectedComplaints);
    if (checked) {
      newSelected.add(complaintId);
    } else {
      newSelected.delete(complaintId);
    }
    setSelectedComplaints(newSelected);
    setSelectAll(newSelected.size === filteredComplaints.filter(c => c.status === "in-progress").length && newSelected.size > 0);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "in-progress":
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
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
      {tableError && (
        <Card className="border-red-600/30 bg-red-600/10">
          <CardContent className="pt-6">
            <p className="text-red-400">Complaints table not yet created in Supabase. Please run the migration SQL code provided.</p>
          </CardContent>
        </Card>
      )}

      {loading && !tableError && (
        <Card className="border-border">
          <CardContent className="py-8 text-center text-muted-foreground">Loading complaints...</CardContent>
        </Card>
      )}

      {!tableError && !loading && (
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
              <div className="mb-4 flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={selectedComplaints.size === 0 || bulkUpdating}
                  onClick={() => bulkUpdateStatus("resolved")}
                >
                  Resolve Selected ({selectedComplaints.size})
                </Button>
                {selectedComplaints.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedComplaints(new Set()); setSelectAll(false); }}>
                    Clear Selection
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border"
                      />
                    </TableHead>
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
                      <TableCell className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedComplaints.has(complaint.id)}
                          onChange={(e) => handleSelectComplaint(complaint.id, e.target.checked)}
                          disabled={complaint.status === "resolved"}
                          className="rounded border"
                        />
                      </TableCell>
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
      )}
    </div>
  );
};

export default ComplaintsManager;
