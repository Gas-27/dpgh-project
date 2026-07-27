import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { Search, AlertCircle, CheckCircle, Clock, Image, Download, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface Complaint {
  id: string;
  complaint_type: "storefront" | "agent" | "subagent";
  order_id: string;
  agent_store_id: string;
  subagent_store_id: string;
  customer_number: string;
  complaint_title: string;
  complaint_details: string;
  screenshot_url?: string;
  owing_airtime?: boolean;
  owing_bundle?: boolean;
  owing_momo?: boolean;
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
  const [activeTab, setActiveTab] = useState<"all" | "storefront" | "agent" | "subagent">(isAgent ? "agent" : "all");
  const [tableError, setTableError] = useState(false);
  const [selectedComplaints, setSelectedComplaints] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [page, setPage] = useState(1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const PAGE_SIZE = 50;
  const { toast } = useToast();

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setTableError(false);
      // Simplified query - fetch complaints only without complex joins
      let query = supabase
        .from("complaints")
        .select("id, complaint_type, order_id, agent_store_id, subagent_store_id, customer_number, complaint_title, complaint_details, screenshot_url, owing_airtime, owing_bundle, owing_momo, status, created_at")
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

  const filteredComplaints = complaints.filter((c) => {
    const typeMatch = activeTab === "all" || c.complaint_type === activeTab;
    const searchMatch =
      !searchTerm ||
      c.complaint_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customer_number.includes(searchTerm) ||
      (c.agent_stores?.store_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.subagent_stores?.store_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.order_id || "").toLowerCase().includes(searchTerm.toLowerCase());
    return typeMatch && searchMatch;
  });

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
        <>
          {/* Screenshot preview dialog */}
          <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Customer Screenshot</DialogTitle></DialogHeader>
              {previewImage && <img src={previewImage} alt="Customer screenshot" className="w-full rounded-lg" />}
            </DialogContent>
          </Dialog>

          {/* Complaint detail dialog */}
          <ComplaintDetailDialog
            complaint={selectedComplaint}
            onClose={() => setSelectedComplaint(null)}
            onPreviewImage={setPreviewImage}
            updateComplaintStatus={updateComplaintStatus}
            getStatusBadge={getStatusBadge}
          />

          {/* Tabs — admin sees all types; agents see their own */}
          {!isAgent && (
            <Tabs value={activeTab} onValueChange={(v: any) => { setActiveTab(v); setPage(1); setSelectedComplaints(new Set()); }}>
              <TabsList className="flex flex-wrap gap-1 h-auto">
                <TabsTrigger value="all">All ({complaints.length})</TabsTrigger>
                <TabsTrigger value="storefront">Storefront ({complaints.filter(c => c.complaint_type === "storefront").length})</TabsTrigger>
                <TabsTrigger value="agent">Agent ({complaints.filter(c => c.complaint_type === "agent").length})</TabsTrigger>
                <TabsTrigger value="subagent">Subagent ({complaints.filter(c => c.complaint_type === "subagent").length})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-4 mt-4">
                <ComplaintsTable
                  complaints={filteredComplaints}
                  searchTerm={searchTerm}
                  setSearchTerm={(v) => { setSearchTerm(v); setPage(1); }}
                  selectedComplaints={selectedComplaints}
                  setSelectedComplaints={setSelectedComplaints}
                  selectAll={selectAll}
                  setSelectAll={setSelectAll}
                  bulkUpdating={bulkUpdating}
                  bulkUpdateStatus={bulkUpdateStatus}
                  updateComplaintStatus={updateComplaintStatus}
                  getStatusBadge={getStatusBadge}
                  page={page}
                  setPage={setPage}
                  PAGE_SIZE={PAGE_SIZE}
                  onPreviewImage={setPreviewImage}
                  onSelectComplaint={setSelectedComplaint}
                />
              </TabsContent>
            </Tabs>
          )}

          {isAgent && (
            <div className="space-y-4">
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="py-3 px-4">
                  <p className="text-sm text-yellow-400">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    All complaints from your storefront and subagent stores are automatically forwarded to admin for resolution.
                  </p>
                </CardContent>
              </Card>
              <ComplaintsTable
                complaints={filteredComplaints}
                searchTerm={searchTerm}
                setSearchTerm={(v) => { setSearchTerm(v); setPage(1); }}
                selectedComplaints={selectedComplaints}
                setSelectedComplaints={setSelectedComplaints}
                selectAll={selectAll}
                setSelectAll={setSelectAll}
                bulkUpdating={bulkUpdating}
                bulkUpdateStatus={bulkUpdateStatus}
                updateComplaintStatus={updateComplaintStatus}
                getStatusBadge={getStatusBadge}
                page={page}
                setPage={setPage}
                PAGE_SIZE={PAGE_SIZE}
                onPreviewImage={setPreviewImage}
                onSelectComplaint={setSelectedComplaint}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ComplaintDetailDialog — full complaint detail with download & share
// ---------------------------------------------------------------------------
interface ComplaintDetailDialogProps {
  complaint: Complaint | null;
  onClose: () => void;
  onPreviewImage: (url: string) => void;
  updateComplaintStatus: (id: string, status: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

function ComplaintDetailDialog({ complaint, onClose, onPreviewImage, updateComplaintStatus, getStatusBadge }: ComplaintDetailDialogProps) {
  if (!complaint) return null;

  const networkName = (n: string) =>
    n === "mtn" ? "MTN" : n === "mtn_express" ? "MTN Express" : n === "airteltigo" ? "AirtelTigo" : n === "telecel" ? "Telecel" : (n || "").toUpperCase();

  const boolLabel = (v: boolean | null | undefined) =>
    v == null ? "—" : v ? <span className="text-red-400 font-semibold">Yes</span> : <span className="text-green-400">No</span>;

  const handleDownload = async () => {
    // Build text report
    const lines = [
      "COMPLAINT REPORT",
      "================",
      `Date: ${new Date(complaint.created_at).toLocaleString()}`,
      `Status: ${complaint.status}`,
      `Type: ${complaint.complaint_type}`,
      "",
      "CUSTOMER DETAILS",
      `Number: ${complaint.customer_number}`,
      `Store: ${complaint.agent_stores?.store_name || complaint.subagent_stores?.store_name || "—"}`,
      "",
      "ORDER DETAILS",
      complaint.orders ? `Network: ${networkName(complaint.orders.network)}` : "",
      complaint.orders ? `Package: ${complaint.orders.size_gb}GB` : "",
      complaint.orders ? `Amount: GHC ${Number(complaint.orders.amount).toFixed(2)}` : "",
      complaint.orders ? `Delivery Status: ${complaint.orders.fulfillment_status}` : "",
      "",
      "CHECKLIST",
      `Owing Airtime: ${complaint.owing_airtime == null ? "Not answered" : complaint.owing_airtime ? "YES" : "No"}`,
      `Owing Bundle: ${complaint.owing_bundle == null ? "Not answered" : complaint.owing_bundle ? "YES" : "No"}`,
      `Owing MoMo: ${complaint.owing_momo == null ? "Not answered" : complaint.owing_momo ? "YES" : "No"}`,
      "",
      "COMPLAINT",
      complaint.complaint_title,
      complaint.complaint_details,
      "",
      complaint.screenshot_url ? `Screenshot: ${complaint.screenshot_url}` : "No screenshot attached",
    ].filter(l => l !== undefined).join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `complaint-${complaint.id.slice(0, 8)}-${complaint.customer_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const text = `Complaint Report\nCustomer: ${complaint.customer_number}\nOrder: ${complaint.orders ? `${networkName(complaint.orders.network)} ${complaint.orders.size_gb}GB` : complaint.order_id}\nStatus: ${complaint.status}\nDate: ${new Date(complaint.created_at).toLocaleString()}\n\n${complaint.complaint_details}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Complaint Report", text }); } catch (_) {}
    } else {
      await navigator.clipboard.writeText(text);
      alert("Report copied to clipboard!");
    }
  };

  return (
    <Dialog open={!!complaint} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="text-base">Complaint Details</DialogTitle>
            <div className="flex gap-2">
              <button onClick={handleShare} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              <button onClick={handleDownload} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status + Meta */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {getStatusBadge(complaint.status)}
            <span className="text-xs text-muted-foreground">{new Date(complaint.created_at).toLocaleString()}</span>
          </div>

          {/* Order info */}
          <Card className="border-border">
            <CardContent className="pt-4 pb-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <span className="text-muted-foreground">Customer</span><span className="font-medium">{complaint.customer_number}</span>
              {complaint.orders && <>
                <span className="text-muted-foreground">Network</span><span className="font-medium">{networkName(complaint.orders.network)}</span>
                <span className="text-muted-foreground">Package</span><span className="font-medium">{complaint.orders.size_gb}GB — GHC {Number(complaint.orders.amount).toFixed(2)}</span>
                <span className="text-muted-foreground">Delivery</span><span className="font-medium">{complaint.orders.fulfillment_status}</span>
              </>}
              <span className="text-muted-foreground">Store</span><span className="font-medium">{complaint.agent_stores?.store_name || complaint.subagent_stores?.store_name || "—"}</span>
              <span className="text-muted-foreground">Type</span><span className="capitalize font-medium">{complaint.complaint_type}</span>
            </CardContent>
          </Card>

          {/* Checklist */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pre-submission Checklist</p>
            <div className="grid grid-cols-3 gap-2">
              {[["Owing Airtime", complaint.owing_airtime], ["Owing Bundle", complaint.owing_bundle], ["Owing MoMo", complaint.owing_momo]].map(([label, val]) => (
                <div key={String(label)} className="border border-border rounded-lg p-3 text-center text-xs">
                  <p className="text-muted-foreground mb-1">{String(label)}</p>
                  <p>{boolLabel(val as boolean | null)}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Complaint text */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{complaint.complaint_title}</p>
            <p className="text-sm whitespace-pre-wrap">{complaint.complaint_details}</p>
          </div>

          {/* Screenshot */}
          {complaint.screenshot_url ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Screenshot</p>
              <img
                src={complaint.screenshot_url}
                alt="Customer screenshot"
                className="w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onPreviewImage(complaint.screenshot_url!)}
              />
              <div className="flex gap-2 mt-2">
                <a
                  href={complaint.screenshot_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Save Image
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No screenshot attached</p>
          )}

          {/* Actions */}
          {complaint.status !== "resolved" && (
            <div className="flex gap-2 pt-2">
              {complaint.status !== "in-progress" && (
                <Button size="sm" variant="outline" onClick={() => { updateComplaintStatus(complaint.id, "in-progress"); onClose(); }}>Mark In Progress</Button>
              )}
              <Button size="sm" variant="hero" onClick={() => { updateComplaintStatus(complaint.id, "resolved"); onClose(); }}>Mark Resolved</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ComplaintsTable — reusable table used in all tabs
// ---------------------------------------------------------------------------
interface ComplaintsTableProps {
  complaints: Complaint[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  selectedComplaints: Set<string>;
  setSelectedComplaints: (s: Set<string>) => void;
  selectAll: boolean;
  setSelectAll: (v: boolean) => void;
  bulkUpdating: boolean;
  bulkUpdateStatus: (status: string) => void;
  updateComplaintStatus: (id: string, status: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  PAGE_SIZE: number;
  onPreviewImage: (url: string) => void;
  onSelectComplaint: (c: Complaint) => void;
}

function ComplaintsTable({
  complaints, searchTerm, setSearchTerm,
  selectedComplaints, setSelectedComplaints,
  selectAll, setSelectAll,
  bulkUpdating, bulkUpdateStatus, updateComplaintStatus,
  getStatusBadge, page, setPage, PAGE_SIZE, onPreviewImage, onSelectComplaint,
}: ComplaintsTableProps) {
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedComplaints(new Set(complaints.filter(c => c.status !== "resolved").map(c => c.id)));
    } else {
      setSelectedComplaints(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedComplaints);
    if (checked) next.add(id); else next.delete(id);
    setSelectedComplaints(next);
    setSelectAll(next.size === complaints.filter(c => c.status !== "resolved").length && next.size > 0);
  };

  const paginated = complaints.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(complaints.length / PAGE_SIZE);

  const typeLabel = (t: string) => {
    if (t === "agent") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Agent</Badge>;
    if (t === "subagent") return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Subagent</Badge>;
    return <Badge className="bg-muted text-muted-foreground text-xs">Storefront</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-10 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search by customer, order ID, store..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {selectedComplaints.size > 0 && (
          <>
            <button
              className="text-xs px-3 py-1.5 rounded border border-border bg-background hover:bg-muted disabled:opacity-50"
              disabled={bulkUpdating}
              onClick={() => bulkUpdateStatus("resolved")}
            >
              Resolve Selected ({selectedComplaints.size})
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded border border-border bg-background hover:bg-muted"
              onClick={() => { setSelectedComplaints(new Set()); setSelectAll(false); }}
            >
              Clear
            </button>
          </>
        )}
      </div>

      {complaints.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No complaints found</CardContent></Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, complaints.length)} of {complaints.length}
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">
                    <input type="checkbox" checked={selectAll} onChange={e => handleSelectAll(e.target.checked)} className="rounded border" />
                  </TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead className="whitespace-nowrap">Reported At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(c => (
                  <TableRow key={c.id} className={`${c.status === "resolved" ? "opacity-60" : ""} cursor-pointer hover:bg-muted/40`} onClick={(e) => { if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return; onSelectComplaint(c); }}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedComplaints.has(c.id)}
                        onChange={e => handleSelect(c.id, e.target.checked)}
                        disabled={c.status === "resolved"}
                        className="rounded border"
                      />
                    </TableCell>
                    <TableCell>{typeLabel(c.complaint_type)}</TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <p className="font-medium">{c.customer_number}</p>
                        <p className="text-xs text-muted-foreground">{c.complaint_title}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.orders ? (
                        <div className="space-y-0.5">
                          <p className="font-medium">{c.orders.network?.toUpperCase()} {c.orders.size_gb}GB</p>
                          <p className="text-muted-foreground">GHC {Number(c.orders.amount).toFixed(2)}</p>
                          <p className="text-muted-foreground">{c.orders.fulfillment_status}</p>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">{c.order_id?.slice(0,8)}…</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{c.agent_stores?.store_name || c.subagent_stores?.store_name || "—"}</p>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        <p>Airtime: <span className={c.owing_airtime ? "text-red-400 font-medium" : "text-green-400"}>{c.owing_airtime == null ? "—" : c.owing_airtime ? "Yes" : "No"}</span></p>
                        <p>Bundle: <span className={c.owing_bundle ? "text-red-400 font-medium" : "text-green-400"}>{c.owing_bundle == null ? "—" : c.owing_bundle ? "Yes" : "No"}</span></p>
                        <p>MoMo: <span className={c.owing_momo ? "text-red-400 font-medium" : "text-green-400"}>{c.owing_momo == null ? "—" : c.owing_momo ? "Yes" : "No"}</span></p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.screenshot_url ? (
                        <button
                          onClick={() => onPreviewImage(c.screenshot_url!)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Image className="h-3.5 w-3.5" />
                          View
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-col">
                        {c.status !== "in-progress" && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateComplaintStatus(c.id, "in-progress")}>
                            In Progress
                          </Button>
                        )}
                        {c.status !== "resolved" && (
                          <Button size="sm" variant="hero" className="text-xs h-7" onClick={() => updateComplaintStatus(c.id, "resolved")}>
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
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ComplaintsManager;
