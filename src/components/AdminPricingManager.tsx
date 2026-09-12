import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Pricing = Record<string, number>;

const fields = [
  ["sms_dashboard_recipient_price", "Dashboard SMS price per recipient"],
  ["sms_dashboard_page_price", "Dashboard SMS price per page"],
  ["sms_packages_recipient_price", "Packages page SMS price per recipient"],
  ["sms_packages_page_price", "Packages page SMS price per page"],
  ["sms_storefront_recipient_price", "Storefront SMS price per recipient"],
  ["sms_storefront_page_price", "Storefront SMS price per page"],
  ["dashboard_data_price", "Dashboard data price adjustment"],
  ["packages_data_price", "Packages page data price adjustment"],
  ["storefront_data_price", "Storefront data price adjustment"],
] as const;

export default function AdminPricingManager() {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<Pricing>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from("app_settings").select(fields.map(([key]) => key).join(", ")).eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) toast({ title: "Could not load pricing", description: error.message, variant: "destructive" });
      setPricing(Object.fromEntries(fields.map(([key]) => [key, Number((data as any)?.[key] ?? 0)])));
      setLoading(false);
    });
    return () => { active = false; };
  }, [toast]);

  const update = (key: string, value: string) => setPricing((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({ id: 1, ...pricing, updated_at: new Date().toISOString() });
    setSaving(false);
    toast(error ? { title: "Pricing not saved", description: error.message, variant: "destructive" } : { title: "Pricing saved", description: "The updated prices are now available to the app." });
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Pricing Management</CardTitle>
        <p className="text-sm text-muted-foreground">Set separate SMS recipient/page prices and data pricing by sales channel.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading pricing...</div> : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">GHC</span><Input id={key} type="number" min="0" step="0.01" value={pricing[key] ?? 0} onChange={(event) => update(key, event.target.value)} /></div>
                </div>
              ))}
            </div>
            <Button type="button" onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save pricing</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
