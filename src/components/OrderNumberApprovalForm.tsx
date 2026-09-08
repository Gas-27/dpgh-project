import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatApprovalNumber, validateApprovalNumber } from "@/lib/orderNumberApproval";

type Props = {
  source: string;
  storeId?: string | null;
  compact?: boolean;
};

export default function OrderNumberApprovalForm({ source, storeId, orderId, compact = false }: Props) {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const result = validateApprovalNumber(phone);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setSaving(true);
    const { error: insertError } = await supabase.from("order_number_submissions").insert({
      phone_number: result.normalized,
      normalized_phone: result.normalized,
      order_id: null,
      requester_id: user?.id ?? null,
      requester_role: roles[0] ?? "customer",
      source,
      store_id: storeId ?? null,
      admin_note: null,
    });
    setSaving(false);
    if (insertError) {
      toast({ title: "Could not submit number", description: insertError.message, variant: "destructive" });
      return;
    }
    setSubmitted(true);
    toast({ title: "Number submitted", description: `${formatApprovalNumber(result.normalized)} is waiting for approval.` });
  }

  if (submitted) {
    return <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" /> Number submitted for approval.</div>;
  }

  return <div className={`${compact ? "space-y-3" : "space-y-4"} rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 text-slate-100 shadow-xl`}>
    <div className="space-y-1.5"><Label htmlFor={`approval-phone-${source}`}>Phone number</Label><Input id={`approval-phone-${source}`} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0242206542" inputMode="tel" /></div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Button type="button" onClick={submit} disabled={saving} className="w-full"><>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit for approval</></Button>
  </div>;
}
