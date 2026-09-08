import { useEffect, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatApprovalNumber, validateApprovalNumber } from "@/lib/orderNumberApproval";

type Props = {
  source: string;
  storeId?: string | null;
  compact?: boolean;
};

export default function OrderNumberApprovalForm({ source, storeId, compact = false }: Props) {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [numbers, setNumbers] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previousNumbers, setPreviousNumbers] = useState<Array<{ normalized_phone: string; status: string }>>([]);

  useEffect(() => {
    if (compact || !user?.id) return;
    void supabase.from("order_number_submissions").select("normalized_phone, status").eq("requester_id", user.id).order("created_at", { ascending: false }).limit(100).then(({ data }) => setPreviousNumbers(data ?? []));
  }, [compact, user?.id]);

  async function submit() {
    const values = compact ? [phone] : numbers.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
    if (!values.length) {
      setError("Enter at least one phone number.");
      return;
    }
    const results = values.map(validateApprovalNumber);
    const invalid = results.find((result) => result.error);
    if (invalid?.error) {
      setError(invalid.error);
      return;
    }
    setError(null);
    setSaving(true);
    const { error: insertError } = await supabase.from("order_number_submissions").insert(results.map((result) => ({
      phone_number: result.normalized,
      normalized_phone: result.normalized,
      order_id: null,
      requester_id: user?.id ?? null,
      requester_role: roles[0] ?? "customer",
      source,
      store_id: storeId ?? null,
      admin_note: null,
    })));
    setSaving(false);
    if (insertError) {
      toast({ title: "Could not submit number", description: insertError.message, variant: "destructive" });
      return;
    }
    setSubmitted(true);
    setPhone("");
    setNumbers("");
    setPreviousNumbers((current) => [...results.map((result) => ({ normalized_phone: result.normalized, status: "pending" })), ...current]);
    toast({ title: "Numbers submitted", description: `${results.length} number${results.length === 1 ? "" : "s"} waiting for approval.` });
  }

  const enteredCount = compact ? (phone.trim() ? 1 : 0) : numbers.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean).length;
  return <div className={`${compact ? "space-y-3" : "space-y-5"} rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-slate-100 shadow-xl`}>
    {!compact && <div className="flex items-start justify-between border-b border-slate-800 pb-4"><div><p className="text-lg font-bold">Submit numbers</p><p className="text-sm text-slate-400">Paste, type, or import up to 10,000 numbers.</p></div><span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">₵0.00</span></div>}
    {submitted && <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"><Check className="h-4 w-4" /> Numbers submitted and added to your history.</div>}
    {!compact && previousNumbers.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold">Previously submitted numbers</p><div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-slate-800 p-2">{previousNumbers.map((item, index) => <div key={`${item.normalized_phone}-${index}`} className="flex justify-between rounded px-2 py-1 font-mono text-sm"><span>{item.normalized_phone}</span><span className="text-xs capitalize text-slate-400">{item.status}</span></div>)}</div></div>}
    <div className="space-y-1.5"><Label htmlFor={`approval-phone-${source}`}>{compact ? "Phone number" : "MTN numbers"}</Label>{compact ? <Input id={`approval-phone-${source}`} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0242206542" inputMode="tel" /> : <Textarea id={`approval-phone-${source}`} value={numbers} onChange={(event) => setNumbers(event.target.value)} placeholder="0240000000\n0550000000" className="min-h-56 resize-y font-mono" />}</div>
    {!compact && <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-900 p-3"><strong className="block text-base text-white">{enteredCount}</strong><span className="text-slate-400">Detected</span></div><div className="rounded-lg bg-emerald-500/10 p-3"><strong className="block text-base text-emerald-300">{enteredCount}</strong><span className="text-slate-400">Valid</span></div><div className="rounded-lg bg-rose-500/10 p-3"><strong className="block text-base text-rose-300">0</strong><span className="text-slate-400">Check</span></div></div>}
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Button type="button" onClick={submit} disabled={saving} className="w-full"><>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit for approval</></Button>
  </div>;
}
