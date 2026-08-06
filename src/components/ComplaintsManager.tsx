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
import { Search, AlertCircle, CheckCircle, Clock, Image, Download, Share2, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ComplaintNotesThread } from "@/components/ComplaintNotesThread";

interface Complaint {
  id: string;
  complaint_type: "storefront" | "agent" | "subagent" | "sub-subagent";
  order_id: string;
  agent_store_id: string;
  subagent_store_id: string;
  customer_number: string;
  complaint_title: string;
  complaint_details: string;
  screenshot_url?: string;
  sms_screenshot_url?: string;
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
    agent_store_id?: string;
    subagent_store_id?: string;
    customer_id?: string;
    customer_number?: string;
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

export const ComplaintsManager = ({ isAgent = false, agentStoreId, readOnly = false }: { isAgent?: boolean; agentStoreId?: string; readOnly?: boolean } = {}) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "storefront" | "agent" | "subagent">(isAgent ? "agent" : "all");
  const [tableError, setTableError] = useState(false);
  const [columnsMissing, setColumnsMissing] = useState(false);
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

      // Three-tier fallback — try most columns first, degrade gracefully
      // Tier 1: all new columns (requires migration)
      // Tier 2: screenshot_url only (may exist without the owing_* columns)
      // Tier 3: base columns only (always works)
      // Keep the complaints query flat. The previous nested PostgREST joins could
      // fail the entire request when an optional relationship/column was missing.
      const TIER1 = "id, complaint_type, order_id, agent_store_id, subagent_store_id, customer_number, complaint_title, complaint_details, screenshot_url, sms_screenshot_url, owing_airtime, owing_bundle, owing_momo, status, created_at";
      const TIER2 = "id, complaint_type, order_id, agent_store_id, subagent_store_id, customer_number, complaint_title, complaint_details, screenshot_url, owing_airtime, owing_bundle, owing_momo, status, created_at";
      const TIER3 = "id, complaint_type, order_id, agent_store_id, subagent_store_id, customer_number, complaint_title, complaint_details, screenshot_url, status, created_at";
      const TIER4 = "id, complaint_type, order_id, agent_store_id, subagent_store_id, customer_number, complaint_title, complaint_details, status, created_at";

      const buildQuery = (select: string) => {
        let q = supabase.from("complaints").select(select).order("created_at", { ascending: false });
        if (isAgent && agentStoreId) q = q.eq("agent_store_id", agentStoreId);
        return q;
      };

      // 42703 = PostgreSQL "undefined_column"; PGRST204 = PostgREST schema error
      const isSchemaErr = (e: { code?: string; message?: string }) =>
        e.code === "PGRST204" || e.code === "42703" || e.code === "400" ||
        (e.message || "").toLowerCase().includes("column") ||
        (e.message || "").toLowerCase().includes("does not exist") ||
        (e.message || "").toLowerCase().includes("could not find");

      let { data, error } = await buildQuery(TIER1);

      if (error && isSchemaErr(error)) {
        setColumnsMissing(true);
        ({ data, error } = await buildQuery(TIER2));
      }
      if (error && isSchemaErr(error)) {
        ({ data, error } = await buildQuery(TIER3));
      }
      if (error && isSchemaErr(error)) {
        ({ data, error } = await buildQuery(TIER4));
      }

      if (error) {
        if ((error.message || "").includes("Could not find the table")) {
          setTableError(true);
          return;
        }
        throw error;
      }

      const baseComplaints = (data as Complaint[]) || [];
      const orderIds = [...new Set(baseComplaints.map((c) => c.order_id).filter(Boolean))];
      const agentIds = [...new Set(baseComplaints.map((c) => c.agent_store_id).filter(Boolean))];
      const subagentIds = [...new Set(baseComplaints.map((c) => c.subagent_store_id).filter(Boolean))];

      const [ordersResult, agentsResult, subagentsResult] = await Promise.all([
        orderIds.length ? supabase.from("orders").select("*").in("id", orderIds) : Promise.resolve({ data: [], error: null }),
        agentIds.length ? supabase.from("agent_stores").select("*").in("id", agentIds) : Promise.resolve({ data: [], error: null }),
        subagentIds.length ? supabase.from("subagent_stores").select("*").in("id", subagentIds) : Promise.resolve({ data: [], error: null }),
      ]);

      const orderById = new Map((ordersResult.data || []).map((row: any) => [row.id, row]));
      const agentById = new Map((agentsResult.data || []).map((row: any) => [row.id, row]));
      const subagentById = new Map((subagentsResult.data || []).map((row: any) => [row.id, row]));
      setComplaints(baseComplaints.map((complaint) => ({
        ...complaint,
        orders: orderById.get(complaint.order_id),
        agent_stores: agentById.get(complaint.agent_store_id),
        subagent_stores: subagentById.get(complaint.subagent_store_id),
      })));
    } catch (error) {
      console.error("Error fetching complaints:", error);
      toast({ title: "Error", description: "Failed to load complaints", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    const typeMatch = activeTab === "all" || c.complaint_type === activeTab;
    const networkMatch =
      networkFilter === "all" ||
      (c.orders?.network || "").toLowerCase() === networkFilter.toLowerCase();
    const searchMatch =
      !searchTerm ||
      c.complaint_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customer_number.includes(searchTerm) ||
      (c.agent_stores?.store_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.subagent_stores?.store_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||

      (c.order_id || "").toLowerCase().includes(searchTerm.toLowerCase());
    return typeMatch && networkMatch && searchMatch;
  });

  const updateComplaintStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/update-complaint-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update');
      }
      setComplaints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus as any } : c))
      );
      toast({ title: "Success", description: "Complaint status updated" });
    } catch (error: any) {
      console.error("Error updating complaint:", error);
      toast({ title: "Error", description: error.message || "Failed to update complaint", variant: "destructive" });
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

      const res = await fetch('/api/admin/update-complaint-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: complaintIds, status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update');
      }
      
      setComplaints((prev) =>
        prev.map((c) => (selectedComplaints.has(c.id) ? { ...c, status: newStatus as any } : c))
      );
      
      setSelectedComplaints(new Set());
      setSelectAll(false);
      toast({ title: "Success", description: `${complaintIds.length} complaint(s) marked as ${newStatus}` });
    } catch (error: any) {
      console.error("Error bulk updating:", error);
      toast({ title: "Error", description: error.message || "Failed to update complaints", variant: "destructive" });
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

      {columnsMissing && !tableError && (
        <Card className="border-yellow-500/30 bg-yellow-500/10">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-yellow-400 font-medium text-sm">Database migration required</p>
            <p className="text-yellow-300/80 text-xs">
              The checklist and screenshot columns are missing from your complaints table.
              Run the SQL below in your Supabase dashboard (SQL Editor) to fix this.
              Complaints are still saving but without checklist answers or screenshots until you apply this migration.
            </p>
            <pre className="text-xs bg-black/40 rounded p-3 overflow-x-auto text-green-300 select-all">
{`-- Complaint checklist & screenshot columns
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS sms_screenshot_url TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_airtime BOOLEAN;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_bundle BOOLEAN;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_momo BOOLEAN;

-- Admin notes/questions on complaints
CREATE TABLE IF NOT EXISTS public.complaint_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  requires_response BOOLEAN DEFAULT FALSE,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.complaint_notes DISABLE ROW LEVEL SECURITY;

-- Sub-admin role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sub_admin';`}
            </pre>
            <p className="text-yellow-300/60 text-xs">
              After running this SQL in Supabase, reload the page. All features will work correctly.
            </p>
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
            readOnly={readOnly}
          />

          {/* Tabs — admin sees all types; agents see their own */}
          {!isAgent && (
            <Tabs value={activeTab} onValueChange={(v: any) => { setActiveTab(v); setPage(1); setSelectedComplaints(new Set()); }}>
              <TabsList className="flex flex-wrap gap-1 h-auto">
                <TabsTrigger value="all">All ({complaints.length})</TabsTrigger>
                <TabsTrigger value="storefront">Storefront ({complaints.filter(c => c.complaint_type === "storefront").length})</TabsTrigger>
                <TabsTrigger value="agent">Agent ({complaints.filter(c => c.complaint_type === "agent").length})</TabsTrigger>
                <TabsTrigger value="subagent">Subagent ({complaints.filter(c => c.complaint_type === "subagent").length})</TabsTrigger>
                <TabsTrigger value="sub-subagent">Sub-Subagent ({complaints.filter(c => c.complaint_type === "sub-subagent").length})</TabsTrigger>

              </TabsList>

              <TabsContent value={activeTab} className="space-y-4 mt-4">
                <ComplaintsTable
                  complaints={filteredComplaints}
                  searchTerm={searchTerm}
                  setSearchTerm={(v) => { setSearchTerm(v); setPage(1); }}
                  networkFilter={networkFilter}
                  setNetworkFilter={(v) => { setNetworkFilter(v); setPage(1); }}
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
                  readOnly={readOnly}
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
                networkFilter={networkFilter}
                setNetworkFilter={(v) => { setNetworkFilter(v); setPage(1); }}
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
                readOnly={readOnly}
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
  readOnly?: boolean;
}

function ComplaintDetailDialog({ complaint, onClose, onPreviewImage, updateComplaintStatus, getStatusBadge, readOnly = false }: ComplaintDetailDialogProps) {
  // Screenshot tab state must live at component level (hooks cannot be called inside IIFE/callbacks)
  const [activeScreenshotTab, setActiveScreenshotTab] = useState<"data" | "sms">("data");

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
    const orderDate = complaint.orders?.created_at
      ? new Date(complaint.orders.created_at).toLocaleString()
      : "—";
    const network = complaint.orders ? networkName(complaint.orders.network) : "—";
    const bundle = complaint.orders ? `${complaint.orders.size_gb}GB` : "—";
    const lines = [
      `Order Date: ${orderDate}`,
      `Customer Number: ${complaint.customer_number}`,
      `Network: ${network} ${bundle}`,
      `Message Delivered But Not Received`,
      ``,
      complaint.complaint_details,
    ].join("\n");
    if (navigator.share) {
      try { await navigator.share({ title: "Complaint", text: lines }); } catch (_) {}
    } else {
      await navigator.clipboard.writeText(lines);
      alert("Report copied to clipboard!");
    }
  };

  return (
    <Dialog open={!!complaint} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
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
                <span className="text-muted-foreground">Order Date</span>
                <span className="font-medium">{complaint.orders.created_at ? new Date(complaint.orders.created_at).toLocaleString() : "—"}</span>
                <span className="text-muted-foreground">Network</span><span className="font-medium">{networkName(complaint.orders.network)}</span>
                <span className="text-muted-foreground">Package</span><span className="font-medium">{complaint.orders.size_gb}GB</span>
                <span className="text-muted-foreground">Delivery</span><span className="font-medium">{complaint.orders.fulfillment_status}</span>
                <span className="text-muted-foreground">Order Source</span>
                <span className="font-medium">
                  {complaint.agent_stores?.store_name ? (
                    <span className="flex items-center gap-1">
                      {complaint.agent_stores.store_name}
                      {complaint.agent_stores.store_url && (
                        <a href={complaint.agent_stores.store_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-1">Visit</a>
                      )}
                    </span>
                  ) : complaint.subagent_stores?.store_name ? (
                    <span className="flex items-center gap-1">
                      {complaint.subagent_stores.store_name}
                      {complaint.subagent_stores.store_url && (
                        <a href={complaint.subagent_stores.store_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-1">Visit</a>
                      )}
                    </span>
                  ) : (
                    <span>Direct</span>
                  )}
                </span>
              </>}
              <span className="text-muted-foreground">Type</span><span className="capitalize font-medium">{complaint.complaint_type}</span>
            </CardContent>
          </Card>

          {/* Checklist — shown prominently before any other detail */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer Pre-submission Checklist</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["Owing Airtime", complaint.owing_airtime],
                ["Owing Bundle", complaint.owing_bundle],
                ["Owing MoMo", complaint.owing_momo],
              ] as [string, boolean | null | undefined][]).map(([label, val]) => (
                <div
                  key={label}
                  className={`rounded-lg p-3 text-center text-xs border
                    ${val == null
                      ? "border-border bg-muted/30"
                      : val
                        ? "border-red-500/40 bg-red-500/10"
                        : "border-green-500/40 bg-green-500/10"
                    }`}
                >
                  <p className="text-muted-foreground mb-1.5">{label}</p>
                  <p className={`font-bold text-sm ${val == null ? "text-muted-foreground" : val ? "text-red-400" : "text-green-400"}`}>
                    {val == null ? "Not answered" : val ? "YES" : "No"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Screenshots — tabbed view: Data Balance tab + SMS Confirmation tab */}
          {(() => {
            const hasData = !!complaint.screenshot_url;
            const hasSms = !!(complaint as any).sms_screenshot_url;
            // activeScreenshotTab / setActiveScreenshotTab are declared at the component level above

            return (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Screenshots</p>

                {/* Tab selector */}
                <div className="flex gap-1 mb-3">
                  <button
                    onClick={() => setActiveScreenshotTab("data")}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${activeScreenshotTab === "data" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    Data Balance {hasData ? "" : "(none)"}
                  </button>
                  <button
                    onClick={() => setActiveScreenshotTab("sms")}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${activeScreenshotTab === "sms" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    SMS Confirmation {hasSms ? "" : "(none)"}
                  </button>
                </div>

                {activeScreenshotTab === "data" ? (
                  hasData ? (
                    <div>
                      <img
                        src={complaint.screenshot_url!}
                        alt="Customer data balance screenshot"
                        className="w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => onPreviewImage(complaint.screenshot_url!)}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          const msg = document.createElement("p");
                          msg.className = "text-xs text-muted-foreground italic";
                          msg.textContent = "Screenshot could not be loaded.";
                          (e.currentTarget as HTMLImageElement).parentElement?.appendChild(msg);
                        }}
                      />
                      <div className="flex gap-2 mt-2">
                        <a href={complaint.screenshot_url!} download target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">
                          <Download className="h-3.5 w-3.5" /> Save Image
                        </a>
                        <button onClick={() => onPreviewImage(complaint.screenshot_url!)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">
                          <Image className="h-3.5 w-3.5" /> Fullscreen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center">
                      <p className="text-xs text-muted-foreground italic">No data balance screenshot was attached</p>
                    </div>
                  )
                ) : (
                  hasSms ? (
                    <div>
                      <img
                        src={(complaint as any).sms_screenshot_url}
                        alt="MTN SMS confirmation screenshot"
                        className="w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => onPreviewImage((complaint as any).sms_screenshot_url)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="flex gap-2 mt-2">
                        <a href={(complaint as any).sms_screenshot_url} download target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">
                          <Download className="h-3.5 w-3.5" /> Save SMS Image
                        </a>
                        <button onClick={() => onPreviewImage((complaint as any).sms_screenshot_url)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors">
                          <Image className="h-3.5 w-3.5" /> Fullscreen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center">
                      <p className="text-xs text-muted-foreground italic">No SMS confirmation screenshot was attached</p>
                    </div>
                  )
                )}
              </div>
            );
          })()}

          <Separator />

          {/* Complaint text */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{complaint.complaint_title}</p>
            <p className="text-sm whitespace-pre-wrap">{complaint.complaint_details}</p>
          </div>

          <Separator />

          {/* Admin Notes & Q&A Thread */}
          <ComplaintNotesThread
            complaintId={complaint.id}
            isAdmin={true}
          />

          {/* Actions — hidden for read-only viewers (e.g. sub-admins) */}
          {!readOnly && complaint.status !== "resolved" && (
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
  networkFilter: string;
  setNetworkFilter: (v: string) => void;
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
  readOnly?: boolean;
}

function ComplaintsTable({
  complaints, searchTerm, setSearchTerm,
  networkFilter, setNetworkFilter,
  selectedComplaints, setSelectedComplaints,
  selectAll, setSelectAll,
  bulkUpdating, bulkUpdateStatus, updateComplaintStatus,
  getStatusBadge, page, setPage, PAGE_SIZE, onPreviewImage, onSelectComplaint,
  readOnly = false,
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

  const typeLabel = (c: Complaint) => {
    if (c.complaint_type === "agent") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Agent</Badge>;
    if (c.complaint_type === "subagent") return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Subagent</Badge>;
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
        {/* Network filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={networkFilter}
            onChange={e => setNetworkFilter(e.target.value)}
            className="text-sm border border-border rounded-md bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Networks</option>
            <option value="mtn">MTN</option>
            <option value="mtn_express">MTN Express</option>
            <option value="telecel">Telecel</option>
            <option value="airteltigo">AirtelTigo</option>
            <option value="atbigtime">AT BigTime</option>
          </select>
        </div>
        {!readOnly && selectedComplaints.size > 0 && (
          <>
            <button
              className="text-xs px-3 py-1.5 rounded border border-border bg-background hover:bg-muted disabled:opacity-50"
              disabled={bulkUpdating}
              onClick={() => bulkUpdateStatus("resolved")}
            >
              Resolve Selected ({selectedComplaints.size})
            </button>
            <button
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border bg-background hover:bg-muted"
              onClick={() => {
                const selected = complaints.filter(c => selectedComplaints.has(c.id));
                const lines = selected.map(c =>
                  [
                    `ID: ${c.id}`,
                    `Status: ${c.status}`,
                    `Customer: ${c.customer_number}`,
                    `Order: ${c.orders ? `${c.orders.network?.toUpperCase()} ${c.orders.size_gb}GB` : c.order_id}`,
                    `Title: ${c.complaint_title}`,
                    `Details: ${c.complaint_details}`,
                    `Date: ${new Date(c.created_at).toLocaleString()}`,
                    "---",
                  ].join("\n")
                ).join("\n");
                const blob = new Blob([lines], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `complaints-export-${Date.now()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download ({selectedComplaints.size})
            </button>
            <button
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-border bg-background hover:bg-muted"
              onClick={async () => {
                const selected = complaints.filter(c => selectedComplaints.has(c.id));
                const networkName = (n: string) =>
                  n === "mtn" ? "MTN" : n === "mtn_express" ? "MTN Express" : n === "airteltigo" ? "AirtelTigo" : n === "telecel" ? "Telecel" : (n || "").toUpperCase();
                const text = selected.map(c => {
                  const orderDate = c.orders?.created_at ? new Date(c.orders.created_at).toLocaleString() : "—";
                  const network = c.orders ? `${networkName(c.orders.network)} ${c.orders.size_gb}GB` : "—";
                  return [
                    `Order Date: ${orderDate}`,
                    `Customer Number: ${c.customer_number}`,
                    `Network: ${network}`,
                    `Message Delivered But Not Received`,
                    ``,
                    c.complaint_details,
                    "---",
                  ].join("\n");
                }).join("\n");
                if (navigator.share) {
                  try { await navigator.share({ title: `${selected.length} Complaint(s)`, text }); } catch (_) {}
                } else {
                  await navigator.clipboard.writeText(text);
                  alert("Copied to clipboard!");
                }
              }}
            >
              <Share2 className="h-3.5 w-3.5" /> Share ({selectedComplaints.size})
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
                  {!readOnly && (
                    <TableHead className="w-10">
                      <input type="checkbox" checked={selectAll} onChange={e => handleSelectAll(e.target.checked)} className="rounded border" />
                    </TableHead>
                  )}
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="whitespace-nowrap">Order Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead className="whitespace-nowrap">Reported At</TableHead>
                  <TableHead>Status</TableHead>
                  {!readOnly && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(c => (
                  <TableRow key={c.id} className={`${c.status === "resolved" ? "opacity-60" : ""} cursor-pointer hover:bg-muted/40`} onClick={(e) => { if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return; onSelectComplaint(c); }}>
                    {!readOnly && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedComplaints.has(c.id)}
                          onChange={e => handleSelect(c.id, e.target.checked)}
                          disabled={c.status === "resolved"}
                          className="rounded border"
                        />
                      </TableCell>
                    )}
                    <TableCell>{typeLabel(c)}</TableCell>
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
                          <p className="text-muted-foreground">{c.orders.fulfillment_status}</p>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">{c.order_id?.slice(0,8)}…</span>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {c.orders?.created_at ? new Date(c.orders.created_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.agent_stores?.store_name ? (
                        <div>
                          <p className="font-medium text-blue-400">{c.agent_stores.store_name}</p>
                          {(c.agent_stores as any).store_url && (
                            <a href={(c.agent_stores as any).store_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline" onClick={e => e.stopPropagation()}>Visit</a>
                          )}
                        </div>
                      ) : c.subagent_stores?.store_name ? (
                        <div>
                          <p className="font-medium text-purple-400">{c.subagent_stores.store_name}</p>
                          {(c.subagent_stores as any).store_url && (
                            <a href={(c.subagent_stores as any).store_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline" onClick={e => e.stopPropagation()}>Visit</a>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">Direct</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {[
                          { label: "Air", val: c.owing_airtime },
                          { label: "Bndl", val: c.owing_bundle },
                          { label: "MoMo", val: c.owing_momo },
                        ].map(({ label, val }) => (
                          <span
                            key={label}
                            className={`inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5 w-fit
                              ${val == null
                                ? "bg-muted text-muted-foreground"
                                : val
                                  ? "bg-red-500/15 text-red-400 border border-red-500/30"
                                  : "bg-green-500/15 text-green-400 border border-green-500/30"
                              }`}
                          >
                            {label}: {val == null ? "?" : val ? "YES" : "No"}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.screenshot_url ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onPreviewImage(c.screenshot_url!); }}
                          className="block rounded overflow-hidden border border-border hover:border-primary transition-colors"
                          title="Click to enlarge screenshot"
                        >
                          <img
                            src={c.screenshot_url}
                            alt="Customer screenshot"
                            className="w-14 h-14 object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                              (e.currentTarget.parentElement as HTMLElement).innerHTML = '<span class="flex items-center gap-1 text-xs text-primary px-2 py-1"><svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>View</span>';
                            }}
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    {!readOnly && (
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
                    )}
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
