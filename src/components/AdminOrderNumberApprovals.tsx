import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, RefreshCw, X, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatApprovalNumber } from "@/lib/orderNumberApproval";

type Submission = { id: string; normalized_phone: string; order_id: string | null; source: string; status: "pending" | "approved" | "rejected"; created_at: string; updated_at?: string };

export default function AdminOrderNumberApprovals() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Submission[]>([]);
  const [view, setView] = useState<"pending" | "submitted">("pending");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const pageSize = view === "pending" ? 50 : 100;

  async function load() {
    setLoading(true);
    const status = view === "pending" ? "pending" : "approved";
    let query = supabase.from("order_number_submissions").select("id, normalized_phone, order_id, source, status, created_at, updated_at").eq("status", status).order(view === "submitted" ? "updated_at" : "created_at", { ascending: false }).range(page * pageSize, (page + 1) * pageSize);
    if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
    if (toDate) query = query.lt("created_at", `${toDate}T23:59:59.999Z`);
    const { data, error } = await query;
    if (error) toast({ title: "Could not load numbers", description: error.message, variant: "destructive" });
    setRows((data ?? []) as Submission[]);
    setHasMore((data?.length ?? 0) === pageSize + 1);
    if ((data?.length ?? 0) > pageSize) setRows((data ?? []).slice(0, pageSize) as Submission[]);
    setSelected([]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [view, page, fromDate, toDate]);
  const filtered = useMemo(() => rows.filter((row) => `${row.normalized_phone} ${row.order_id ?? ""} ${row.source}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const togglePage = () => setSelected(selected.length === filtered.length ? [] : filtered.map((row) => row.id));
  async function copyNumbers(items: Submission[]) { await navigator.clipboard.writeText(items.map((row) => row.normalized_phone).join("\n")); toast({ title: "Numbers copied" }); }
  function shareWhatsApp(items: Submission[]) { const text = items.map((row) => row.normalized_phone).join("\n"); window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer"); }
  async function markSubmitted(ids: string[]) {
    if (!ids.length) return;
    setSaving(true);
    const { error } = await supabase.from("order_number_submissions").update({ status: "approved", updated_at: new Date().toISOString() }).in("id", ids);
    setSaving(false);
    if (error) toast({ title: "Could not mark submitted", description: error.message, variant: "destructive" });
    else { toast({ title: "Numbers moved to Submitted", description: `${ids.length} number${ids.length === 1 ? "" : "s"} marked as submitted.` }); void load(); }
  }
  async function reject(id: string) {
    setSaving(true);
    const { error } = await supabase.from("order_number_submissions").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Could not reject number", description: error.message, variant: "destructive" }); else void load();
  }
  const selectedRows = filtered.filter((row) => selected.includes(row.id));

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold">Order number approvals</h2><p className="text-sm text-muted-foreground">Review and submit customer numbers for MTN verification.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    <div className="flex gap-2 rounded-xl border bg-card p-1"><Button variant={view === "pending" ? "default" : "ghost"} onClick={() => { setView("pending"); setPage(0); }}>Pending</Button><Button variant={view === "submitted" ? "default" : "ghost"} onClick={() => { setView("submitted"); setPage(0); }}>Submitted</Button></div>
    <div className="flex flex-col gap-2 sm:flex-row"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number, order ID, or source" /><Input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0); }} aria-label="From date" /><Input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(0); }} aria-label="To date" /></div>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3"><Button variant="outline" onClick={togglePage} disabled={!filtered.length}>{selected.length === filtered.length ? "Clear page" : "Select page"}</Button><Button variant="outline" onClick={() => void copyNumbers(selectedRows)} disabled={!selectedRows.length}><Clipboard className="mr-2 h-4 w-4" />Copy selected</Button><Button variant="outline" onClick={() => shareWhatsApp(selectedRows)} disabled={!selectedRows.length}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button>{view === "pending" && <Button onClick={() => void markSubmitted(selectedRows.map((row) => row.id))} disabled={!selectedRows.length || saving}><Check className="mr-2 h-4 w-4" />Mark submitted</Button>}<span className="ml-auto text-sm text-muted-foreground">Page {page + 1} · {rows.length} loaded</span></div>
    <div className="space-y-2">{loading ? <p className="py-10 text-center text-muted-foreground">Loading numbers…</p> : filtered.length === 0 ? <p className="py-10 text-center text-muted-foreground">No {view} numbers found.</p> : filtered.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-xl border bg-card p-4"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} aria-label={`Select ${row.normalized_phone}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-lg">{formatApprovalNumber(row.normalized_phone)}</strong><Badge variant={view === "submitted" ? "default" : "secondary"}>{view === "submitted" ? "submitted" : "pending"}</Badge></div><p className="text-xs text-muted-foreground">{row.order_id ? `Order ${row.order_id} · ` : ""}{row.source} · {new Date(row.updated_at || row.created_at).toLocaleString()}</p></div>{view === "pending" && <><Button size="sm" onClick={() => void markSubmitted([row.id])} disabled={saving}><Check className="mr-1 h-4 w-4" />Submit</Button><Button size="sm" variant="destructive" onClick={() => void reject(row.id)} disabled={saving}><X className="mr-1 h-4 w-4" />Reject</Button></>}</div>)}</div>
    <div className="flex justify-between"><Button variant="outline" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}>Previous</Button><Button variant="outline" onClick={() => setPage((current) => current + 1)} disabled={!hasMore || loading}>Next page</Button></div>
  </div>;
}
