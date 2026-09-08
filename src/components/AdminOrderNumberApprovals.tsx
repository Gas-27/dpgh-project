import { useEffect, useState } from "react";
import { Check, Clipboard, Download, Loader2, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatApprovalNumber } from "@/lib/orderNumberApproval";

type Submission = { id: string; normalized_phone: string; order_id: string | null; source: string; status: "pending" | "approved" | "rejected"; admin_note: string | null; created_at: string };

export default function AdminOrderNumberApprovals() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Submission[]>([]);
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function load() {
    setLoading(true);
    let query = supabase.from("order_number_submissions").select("id, normalized_phone, order_id, source, status, admin_note, created_at").order("created_at", { ascending: false });
    if (status !== "all") query = query.eq("status", status);
    if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
    if (toDate) query = query.lt("created_at", `${toDate}T23:59:59.999Z`);
    const { data, error } = await query;
    if (error) toast({ title: "Could not load submissions", description: error.message, variant: "destructive" });
    setRows((data ?? []) as Submission[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [status, fromDate, toDate]);
  const filtered = rows.filter((row) => `${row.normalized_phone} ${row.order_id ?? ""} ${row.source}`.toLowerCase().includes(search.toLowerCase()));
  async function update(id: string, nextStatus: Submission["status"], note: string | null) { setSavingId(id); const { error } = await supabase.from("order_number_submissions").update({ status: nextStatus, admin_note: note, updated_at: new Date().toISOString() }).eq("id", id); setSavingId(null); if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" }); else await load(); }
  async function copy(value: string) { await navigator.clipboard.writeText(value); toast({ title: "Number copied" }); }
  function rowsForBulk(limit?: number) { return filtered.filter((row) => row.status === "pending").slice(0, limit); }
  async function copyRows(rowsToCopy: Submission[]) { await copy(rowsToCopy.map((row) => row.normalized_phone).join("\n")); }
  function downloadRows(rowsToDownload: Submission[]) { const blob = new Blob([rowsToDownload.map((row) => row.normalized_phone).join("\n")], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "approval-numbers.txt"; link.click(); URL.revokeObjectURL(url); }
  async function bulkApprove(rowsToApprove: Submission[]) { setSavingId("bulk"); const ids = rowsToApprove.map((row) => row.id); if (!ids.length) return; const { error } = await supabase.from("order_number_submissions").update({ status: "approved", updated_at: new Date().toISOString() }).in("id", ids); setSavingId(null); if (error) toast({ title: "Bulk approval failed", description: error.message, variant: "destructive" }); else { setSelected([]); await load(); } }
  const selectedRows = filtered.filter((row) => selected.includes(row.id));
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return <div className="space-y-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold">Order number approvals</h2><p className="text-sm text-muted-foreground">Review numbers submitted from dashboards, packages, and storefronts.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div><div className="flex flex-col gap-2 sm:flex-row"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number, order ID, or source" /><Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="From date" /><Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="To date" /><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div className="rounded-lg border bg-card p-3"><span className="block text-muted-foreground">Showing</span><strong>{filtered.length}</strong></div><div className="rounded-lg border bg-card p-3"><span className="block text-muted-foreground">Approved</span><strong>{filtered.filter((row) => row.status === "approved").length}</strong></div><div className="rounded-lg border bg-card p-3"><span className="block text-muted-foreground">Not approved</span><strong>{filtered.filter((row) => row.status !== "approved").length}</strong></div><div className="rounded-lg border bg-card p-3"><span className="block text-muted-foreground">Contacts</span><strong>{new Set(filtered.map((row) => row.normalized_phone)).size}</strong></div></div><div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3"><Button variant="outline" size="sm" onClick={() => setSelected(rowsForBulk().map((row) => row.id))}>Select visible</Button><Button variant="outline" size="sm" onClick={() => setSelected(rowsForBulk(100).map((row) => row.id))}>Select first 100</Button><Button variant="outline" size="sm" onClick={() => setSelected(rowsForBulk(1000).map((row) => row.id))}>Select first 1,000</Button><Button variant="outline" size="sm" disabled={!selectedRows.length} onClick={() => void copyRows(selectedRows)}><Clipboard className="mr-1 h-4 w-4" />Copy selected</Button><Button variant="outline" size="sm" disabled={!selectedRows.length} onClick={() => downloadRows(selectedRows)}><Download className="mr-1 h-4 w-4" />Download selected</Button><Button size="sm" disabled={!selectedRows.length || savingId === "bulk"} onClick={() => void bulkApprove(selectedRows)}><Check className="mr-1 h-4 w-4" />Approve selected</Button><Button size="sm" disabled={savingId === "bulk"} onClick={() => void bulkApprove(rowsForBulk())}>Approve all pending</Button></div>{loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading submissions…</div> : filtered.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No submissions found.</p> : <div className="space-y-3">{filtered.map((row) => <div key={row.id} className="rounded-xl border bg-card p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Select ${row.normalized_phone}`} className="h-4 w-4 accent-primary" /><span className="font-mono text-lg font-semibold">{formatApprovalNumber(row.normalized_phone)}</span><Button size="icon" variant="ghost" onClick={() => void copy(row.normalized_phone)} aria-label="Copy number"><Clipboard className="h-4 w-4" /></Button><Badge variant={row.status === "pending" ? "secondary" : row.status === "approved" ? "default" : "destructive"}>{row.status}</Badge></div><p className="text-sm text-muted-foreground">{row.order_id ? `Order: ${row.order_id}` : "No order ID"} · Source: {row.source}</p><p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p></div>{row.status === "pending" && <div className="flex gap-2"><Button size="sm" onClick={() => void update(row.id, "approved", row.admin_note)} disabled={savingId === row.id}><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" onClick={() => void update(row.id, "rejected", row.admin_note)} disabled={savingId === row.id}><X className="mr-1 h-4 w-4" />Reject</Button></div>}</div><Textarea defaultValue={row.admin_note ?? ""} placeholder="Admin note" className="mt-3" onBlur={(event) => { const next = event.target.value || null; if (next !== row.admin_note) void update(row.id, row.status, next); }} /></div>)}</div>}</div>;
}
