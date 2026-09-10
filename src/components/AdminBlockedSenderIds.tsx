import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Block = { id: string; sender_id: string; reason: string | null; created_at: string };

export default function AdminBlockedSenderIds() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Block[]>([]);
  const [senderId, setSenderId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("blocked_sender_ids").select("id, sender_id, reason, created_at").order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load blocked senders", description: error.message, variant: "destructive" });
    setRows((data ?? []) as Block[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  async function add() {
    const value = senderId.trim();
    if (!value) return;
    setSaving(true);
    const { error } = await supabase.from("blocked_sender_ids").insert({ sender_id: value, reason: reason.trim() || null });
    setSaving(false);
    if (error) toast({ title: "Could not block sender", description: error.message, variant: "destructive" });
    else { setSenderId(""); setReason(""); await load(); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("blocked_sender_ids").delete().eq("id", id);
    if (error) toast({ title: "Could not unblock sender", description: error.message, variant: "destructive" });
    else setRows((current) => current.filter((row) => row.id !== id));
  }
  return <section className="space-y-3 rounded-lg border border-border bg-card p-4"><div><h3 className="font-semibold">Blocked sender IDs</h3><p className="text-sm text-muted-foreground">Block a sender before it can submit or trigger approval requests.</p></div><div className="flex flex-col gap-2 sm:flex-row"><Input value={senderId} onChange={(event) => setSenderId(event.target.value)} placeholder="Sender ID" /><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (optional)" /><Button onClick={() => void add()} disabled={saving || !senderId.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Block</Button></div>{loading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No blocked senders.</p> : <div className="divide-y divide-border">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm"><div><strong>{row.sender_id}</strong>{row.reason && <p className="text-xs text-muted-foreground">{row.reason}</p>}</div><Button variant="ghost" size="sm" onClick={() => void remove(row.id)} aria-label={`Unblock ${row.sender_id}`}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}</section>;
}
