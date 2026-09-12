import { useMemo, useState } from "react";
import { CalendarDays, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type OwnerType = "agent" | "subagent" | "subsubagent";
type Audience = "all" | "recent" | "inactive" | "custom";
type Props = { ownerType: OwnerType; ownerId?: string; onContacts: (contacts: string) => void };

const normalize = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00233")) return `0${digits.slice(5)}`;
  if (digits.startsWith("233")) return `0${digits.slice(3)}`;
  return digits.startsWith("0") ? digits : `0${digits}`;
};

const formatDate = (date: Date) => date.toISOString();

export default function OrderContactPicker({ ownerType, ownerId, onContacts }: Props) {
  const { toast } = useToast();
  const [range, setRange] = useState("today");
  const [source, setSource] = useState<"store" | "subagent" | "subsubagent" | "all">("store");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [audience, setAudience] = useState<Audience>("all");
  const [inactiveDays, setInactiveDays] = useState("30");

  const ownerColumn = useMemo(() => ownerType === "agent" ? "agent_store_id" : ownerType === "subagent" ? "subagent_store_id" : "sub_subagent_store_id", [ownerType]);

  const getWindow = () => {
    const now = new Date();
    if (range === "custom") {
      if (!customFrom || !customTo) return null;
      return { from: new Date(`${customFrom}T00:00:00`), to: new Date(`${customTo}T23:59:59.999`) };
    }
    const from = new Date(now);
    if (range === "yesterday") from.setDate(from.getDate() - 1);
    if (range === "this_week") {
      const day = from.getDay();
      from.setDate(from.getDate() - (day === 0 ? 6 : day - 1));
    }
    if (range === "last_week") {
      const day = from.getDay();
      from.setDate(from.getDate() - (day === 0 ? 6 : day - 1) - 7);
    }
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    if (range === "last_week") to.setDate(to.getDate() + 6);
    else if (range === "this_week") to.setDate(to.getDate() + 6);
    else to.setHours(23, 59, 59, 999);
    return { from, to };
  };

  const fetchContacts = async () => {
    if (!ownerId) return;
    const window = getWindow();
    if (!window) { toast({ title: "Choose a date range", description: "Select both custom dates first.", variant: "destructive" }); return; }
    setLoading(true);
    const sourceColumn = source === "store" ? ownerColumn : source === "subagent" && ownerType === "agent" ? "subagent_store_id" : "sub_subagent_store_id";
    let sourceIds = [ownerId];
    let allStoreIds = [ownerId];
    if (ownerType === "agent") {
      const { data: subs } = await supabase.from("subagent_stores").select("id").eq("agent_store_id", ownerId);
      const subIds = (subs || []).map((row) => row.id);
      const { data: subsubs } = await supabase.from("sub_subagent_stores").select("id").in("subagent_store_id", subIds.length ? subIds : ["00000000-0000-0000-0000-000000000000"]);
      allStoreIds = [ownerId, ...subIds, ...(subsubs || []).map((row) => row.id)];
    } else if (ownerType === "subagent") {
      const { data: subsubs } = await supabase.from("sub_subagent_stores").select("id").eq("subagent_store_id", ownerId);
      allStoreIds = [ownerId, ...(subsubs || []).map((row) => row.id)];
    }
    if (source !== "store" && (ownerType === "agent" || ownerType === "subagent")) {
      if (source === "subagent") {
        const { data: rows } = await supabase.from("subagent_stores").select("id").eq("agent_store_id", ownerId);
        sourceIds = (rows || []).map((row) => row.id);
      } else if (source === "subsubagent") {
        const { data: subs } = await supabase.from("subagent_stores").select("id").eq("agent_store_id", ownerId);
        const { data: rows } = await supabase.from("sub_subagent_stores").select("id").in("subagent_store_id", (subs || []).map((row) => row.id));
        sourceIds = (rows || []).map((row) => row.id);
      }
    } else if (source === "subagent" && ownerType === "subagent") {
      const { data: rows } = await supabase.from("sub_subagent_stores").select("id").eq("subagent_store_id", ownerId);
      sourceIds = (rows || []).map((row) => row.id);
    }
    let query = supabase.from("orders").select("customer_number,created_at").limit(5000);
    if (audience === "all") query = query.gte("created_at", formatDate(window.from)).lte("created_at", formatDate(window.to));
    let data: { customer_number: string | null; created_at: string | null }[] = [];
    let error: { message: string } | null = null;
    if (source === "all") {
      const results = await Promise.all([
        query.in("agent_store_id", allStoreIds),
        query.in("subagent_store_id", allStoreIds),
        query.in("sub_subagent_store_id", allStoreIds),
      ]);
      data = results.flatMap((result) => result.data || []);
      error = results.find((result) => result.error)?.error || null;
    } else if (sourceIds.length) {
      const result = await query.in(sourceColumn, sourceIds);
      data = result.data || [];
      error = result.error;
    }
    setLoading(false);
    if (error) { toast({ title: "Could not find order contacts", description: error.message, variant: "destructive" }); return; }
    const cutoff = Date.now() - Math.max(1, Number(inactiveDays) || 30) * 24 * 60 * 60 * 1000;
    const filtered = data.filter((row) => audience === "all" || (audience === "recent" ? new Date(row.created_at || 0).getTime() >= cutoff : new Date(row.created_at || 0).getTime() < cutoff));
    const contacts = Array.from(new Set(filtered.map((row) => normalize(String(row.customer_number || ""))).filter((number) => /^0[2-5]\d{8}$/.test(number))));
    onContacts(contacts.join(","));
    setCount(contacts.length);
    toast({ title: "Contacts ready", description: `${contacts.length} unique order contact${contacts.length === 1 ? "" : "s"} added to recipients.` });
  };

  return <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
    <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><Label>Find customer numbers by time or date of orders and send SMS to them (optional)</Label></div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Customer audience"><Button type="button" size="sm" variant={audience === "all" ? "default" : "outline"} onClick={() => setAudience("all")}>All</Button><Button type="button" size="sm" variant={audience === "recent" ? "default" : "outline"} onClick={() => setAudience("recent")}>Bought recently</Button><Button type="button" size="sm" variant={audience === "inactive" ? "default" : "outline"} onClick={() => setAudience("inactive")}>No purchase</Button><Button type="button" size="sm" variant={audience === "custom" ? "default" : "outline"} onClick={() => setAudience("custom")}>Custom</Button></div>
      {audience !== "all" && <div className="flex items-center gap-2"><Input type="number" min="1" value={inactiveDays} onChange={(event) => setInactiveDays(event.target.value)} className="w-20" aria-label="Audience days" /><span className="text-xs text-muted-foreground">days</span></div>}
      {ownerType !== "subsubagent" && <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order source"><Button type="button" size="sm" variant={source === "store" ? "default" : "outline"} onClick={() => setSource("store")}>My storefront</Button>{ownerType === "agent" && <><Button type="button" size="sm" variant={source === "subagent" ? "default" : "outline"} onClick={() => setSource("subagent")}>Subagents</Button><Button type="button" size="sm" variant={source === "subsubagent" ? "default" : "outline"} onClick={() => setSource("subsubagent")}>Sub-subagents</Button></>}{ownerType === "subagent" && <Button type="button" size="sm" variant={source === "subagent" ? "default" : "outline"} onClick={() => setSource("subagent")}>Subagents</Button>}<Button type="button" size="sm" variant={source === "all" ? "default" : "outline"} onClick={() => setSource("all")}>All available</Button></div>}
      <Select value={range} onValueChange={setRange}><SelectTrigger className="sm:max-w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem><SelectItem value="this_week">This week</SelectItem><SelectItem value="last_week">Last week</SelectItem><SelectItem value="custom">Custom range</SelectItem></SelectContent></Select>
      <Button type="button" onClick={() => void fetchContacts()} disabled={loading || !ownerId} className="sm:ml-auto"><Search className="mr-2 h-4 w-4" />{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Show contacts"}</Button>
    </div>
    {range === "custom" && <div className="grid gap-2 sm:grid-cols-2"><Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} aria-label="Custom start date" /><Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} aria-label="Custom end date" /></div>}
    <p className="text-xs text-muted-foreground">{count === null ? "Contacts are taken from this store's orders." : `${count} unique contact${count === 1 ? "" : "s"} found.`}</p>
  </div>;
}
