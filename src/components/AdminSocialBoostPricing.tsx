import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const fields = ["admin_price_per_1000", "min_price_per_1000", "max_price_per_1000", "agent_price_per_1000", "subagent_price_per_1000", "sub_subagent_price_per_1000"] as const;
const labels: Record<string, string> = { admin_price_per_1000: "User price / 1,000", min_price_per_1000: "Minimum reseller price", max_price_per_1000: "Maximum reseller price", agent_price_per_1000: "Agent price / 1,000", subagent_price_per_1000: "Subagent price / 1,000", sub_subagent_price_per_1000: "Sub-subagent price / 1,000" };
export default function AdminSocialBoostPricing() {
  const { toast } = useToast(); const [values, setValues] = useState<Record<string, number>>({}); const [saving, setSaving] = useState(false);
  useEffect(() => { (supabase as any).from("social_boost_pricing").select(fields.join(",")).eq("id", true).maybeSingle().then(({ data, error }: any) => { if (error) toast({ title: "Could not load Social Boost pricing", description: error.message, variant: "destructive" }); setValues(Object.fromEntries(fields.map((field) => [field, Number(data?.[field] ?? 0)]))); }); }, [toast]);
  const save = async () => { setSaving(true); const { error } = await (supabase as any).from("social_boost_pricing").update({ ...values, updated_at: new Date().toISOString() }).eq("id", true); setSaving(false); toast(error ? { title: "Pricing not saved", description: error.message, variant: "destructive" } : { title: "Social Boost pricing saved" }); };
  return <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4"><h3 className="text-lg font-semibold">Social Boost pricing</h3><p className="mb-4 text-sm text-muted-foreground">Set admin pricing and enforce the minimum and maximum prices available to agents and downstream resellers.</p><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{fields.map((field) => <label key={field} className="space-y-2 text-sm font-medium">{labels[field]}<Input type="number" min="0.01" step="0.01" value={values[field] ?? 0} onChange={(event) => setValues((current) => ({ ...current, [field]: Number(event.target.value) || 0 }))} /></label>)}</div><Button className="mt-4" onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Social Boost pricing"}</Button></div>;
}
