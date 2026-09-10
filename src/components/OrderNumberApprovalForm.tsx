import { useEffect, useState } from "react";
import { Check, Clipboard, Download, FileUp, Loader2, Send } from "lucide-react";
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
  const [previousNumbers, setPreviousNumbers] = useState<Array<{ normalized_phone: string; status: string; source: string | null; created_at: string; updated_at: string | null }>>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (compact || !user?.id) return;
    void supabase.from("order_number_submissions").select("normalized_phone, status, source, created_at, updated_at").eq("requester_id", user.id).order("created_at", { ascending: false }).limit(100).then(({ data }) => setPreviousNumbers((data ?? []) as typeof previousNumbers));
  }, [compact, user?.id]);

  function parseValues(value: string) {
    const candidates = value.match(/(?:\+?233|0)\D*\d{3}\D*\d{3}\D*\d{3}/g) ?? [];
    return Array.from(new Set(candidates.map((candidate) => {
      const digits = candidate.replace(/\D/g, "");
      return digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
    }).filter((candidate) => /^0\d{9}$/.test(candidate))));
  }
  function formatDate(value: string | null) { return value ? new Date(value).toLocaleString() : "—"; }
  function downloadNumbers() { const blob = new Blob([numbers], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "approval-numbers.txt"; link.click(); URL.revokeObjectURL(url); }
  async function copyHistory() { await navigator.clipboard.writeText(previousNumbers.map((item) => item.normalized_phone).join("\n")); toast({ title: "Approval history copied" }); }
  function importFile(file: File) { const reader = new FileReader(); reader.onload = () => { setNumbers(String(reader.result ?? "")); setSubmitted(false); setFileInputKey((value) => value + 1); }; reader.readAsText(file); }

  async function submit() {
    const values = compact ? [phone] : parseValues(numbers);
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
    const normalizedNumbers = results.map((result) => result.normalized);
    const [{ data: existingOrders }, { data: existingSubmissions }] = await Promise.all([
      supabase.from("orders").select("customer_number").in("customer_number", normalizedNumbers),
      supabase.from("order_number_submissions").select("normalized_phone").in("normalized_phone", normalizedNumbers).in("status", ["pending", "approved"]),
    ]);
    const alreadyUsed = new Set([
      ...(existingOrders ?? []).map((row) => String(row.customer_number)),
      ...(existingSubmissions ?? []).map((row) => String(row.normalized_phone)),
    ]);
    const eligibleResults = results.filter((result) => !alreadyUsed.has(result.normalized));
    if (!eligibleResults.length) {
      setSaving(false);
      setError("Every number is already in use or awaiting approval.");
      return;
    }
    const { error: insertError } = await supabase.from("order_number_submissions").insert(eligibleResults.map((result) => ({
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
    setPreviousNumbers((current) => [...eligibleResults.map((result) => ({ normalized_phone: result.normalized, status: "pending" })), ...current]);
    toast({ title: "Numbers submitted", description: `${eligibleResults.length} number${eligibleResults.length === 1 ? "" : "s"} waiting for approval${eligibleResults.length < results.length ? "; duplicates skipped" : ""}.` });
  }

  const enteredValues = compact ? (phone.trim() ? [phone.trim()] : []) : parseValues(numbers);
  const enteredCount = enteredValues.length;
  const validCount = enteredValues.filter((value) => !validateApprovalNumber(value).error).length;
  const invalidCount = enteredCount - validCount;
  const uploadedNumbers = previousNumbers.map((item) => item.normalized_phone).filter(Boolean);
  const totalSubmittedCount = uploadedNumbers.length;
  return <div className={`${compact ? "space-y-3" : "space-y-5"} rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-slate-100 shadow-xl`}>
    {!compact && <div className="flex items-start justify-between border-b border-slate-800 pb-4"><div><p className="text-lg font-bold">Submit numbers</p><p className="text-sm text-slate-400">Paste, type, or import up to 10,000 numbers.</p></div><span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">₵0.00</span></div>}
    {submitted && <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"><Check className="h-4 w-4" /> Numbers submitted and added to your history.</div>}
    <div className="space-y-1.5"><div className="flex items-center justify-between"><Label htmlFor={`approval-phone-${source}`}>{compact ? "Phone number" : "MTN numbers"}</Label>{!compact && <div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-900"><FileUp className="h-3.5 w-3.5" />Import file<input key={fileInputKey} type="file" accept=".txt,.csv,text/plain,text/csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); }} /></label><Button type="button" variant="ghost" size="sm" onClick={downloadNumbers} disabled={!numbers.trim()}><Download className="mr-1 h-3.5 w-3.5" />Export</Button></div>}</div>{compact ? <Input id={`approval-phone-${source}`} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0599427208" inputMode="tel" /> : <Textarea id={`approval-phone-${source}`} value={numbers} onChange={(event) => setNumbers(event.target.value)} placeholder="0240000000\n0550000000" className="min-h-56 resize-y font-mono" />}</div>
    {!compact && <><div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4"><div className="rounded-lg bg-slate-900 p-3"><strong className="block text-base text-white">{enteredCount}</strong><span className="text-slate-400">Detected</span></div><div className="rounded-lg bg-emerald-500/10 p-3"><strong className="block text-base text-emerald-300">{validCount}</strong><span className="text-slate-400">Valid</span></div><div className="rounded-lg bg-rose-500/10 p-3"><strong className="block text-base text-rose-300">{invalidCount}</strong><span className="text-slate-400">Check</span></div><div className="rounded-lg bg-cyan-500/10 p-3"><strong className="block text-base text-cyan-300">{totalSubmittedCount}</strong><span className="text-slate-400">Uploaded</span></div></div>{uploadedNumbers.length > 0 && <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><p className="mb-2 text-xs font-semibold text-slate-400">Numbers you uploaded</p><div className="max-h-32 overflow-auto font-mono text-xs text-slate-200">{uploadedNumbers.map((number, index) => <span key={`${number}-${index}`} className="mr-2 inline-block">{number}</span>)}</div></div>}</>}
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Button type="button" onClick={submit} disabled={saving} className="w-full"><>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit for approval</></Button>
    {false && <div className="overflow-hidden rounded-xl border border-slate-800"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/70 p-3"><div><p className="font-semibold">Approval history</p><p className="text-xs text-slate-400">Only your approval records are shown.</p></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void copyHistory()} disabled={!previousNumbers.length}><Clipboard className="mr-1 h-3.5 w-3.5" />Copy page</Button><Button type="button" variant="outline" size="sm" onClick={() => { const csv = ["MTN NUMBER,STATUS,SUBMISSION,FIRST DETECTED,LAST UPDATED,COUNT", ...previousNumbers.map((item) => `${item.normalized_phone},${item.status},${item.source ?? source},${formatDate(item.created_at)},${formatDate(item.updated_at ?? item.created_at)},1`)].join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "approval-history.csv"; link.click(); URL.revokeObjectURL(url); }} disabled={!previousNumbers.length}><Download className="mr-1 h-3.5 w-3.5" />Export filtered</Button></div></div><div className="max-h-80 overflow-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-950 text-slate-400"><tr><th className="px-3 py-2">MTN NUMBER</th><th className="px-3 py-2">STATUS</th><th className="px-3 py-2">SUBMISSION</th><th className="px-3 py-2">FIRST DETECTED</th><th className="px-3 py-2">LAST UPDATED</th><th className="px-3 py-2">COUNT</th></tr></thead><tbody>{previousNumbers.map((item, index) => <tr key={`${item.normalized_phone}-${index}`} className="border-t border-slate-800"><td className="px-3 py-3 font-mono font-semibold">{item.normalized_phone}</td><td className="px-3 py-3"><span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 capitalize text-amber-200">{item.status}</span></td><td className="px-3 py-3">{item.source ?? source}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(item.created_at)}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(item.updated_at ?? item.created_at)}</td><td className="px-3 py-3 font-semibold">1</td></tr>)}</tbody></table></div></div>}
  </div>;
}
