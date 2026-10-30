import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type BlockedContact = {
  id: string;
  phone: string;
  reason: string | null;
  active: boolean;
  blocked_at: string;
};

export default function AdminBlockedContacts() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BlockedContact[]>([]);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const blockedContacts = supabase as any;
    const { data, error } = await blockedContacts
      .from("blocked_contacts")
      .select("id, phone, reason, active, blocked_at")
      .order("blocked_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load blocked numbers", description: error.message, variant: "destructive" });
    }
    setRows((data ?? []) as BlockedContact[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function blockNumber() {
    const value = phone.trim();
    if (value.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter a valid phone number", description: "Use at least 9 digits.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("blocked_contacts").insert({ phone: value, reason: reason.trim() || null });
    setSaving(false);
    if (error) {
      toast({ title: "Could not block number", description: error.message, variant: "destructive" });
      return;
    }
    setPhone("");
    setReason("");
    toast({ title: "Number blocked", description: "This number will be rejected from future purchases and registrations." });
    await load();
  }

  async function unblockNumber(id: string) {
    const { error } = await (supabase as any).from("blocked_contacts").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not unblock number", description: error.message, variant: "destructive" });
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="font-semibold">Blocked purchase numbers</h3>
        <p className="text-sm text-muted-foreground">Blocked numbers cannot purchase data, airtime, services, AFA products, or register new accounts.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" inputMode="tel" aria-label="Phone number to block" />
        <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (optional)" aria-label="Reason for blocking" />
        <Button onClick={() => void blockNumber()} disabled={saving || !phone.trim()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Block number
        </Button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading blocked numbers…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No blocked numbers.</p> : <div className="divide-y divide-border">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><strong>{row.phone}</strong>{row.reason && <p className="text-xs text-muted-foreground">{row.reason}</p>}</div><Button variant="ghost" size="sm" onClick={() => void unblockNumber(row.id)} aria-label={`Unblock ${row.phone}`}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
    </section>
  );
}
