import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Target } from "lucide-react";

export default function WeeklyOrderTargetAdmin() {
  const { toast } = useToast();
  const [target, setTarget] = useState("2000");
  const [benefits, setBenefits] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void supabase.from("weekly_order_target_settings").select("weekly_order_target, benefits_description").eq("id", true).maybeSingle().then(({ data }) => { if (data) { setTarget(String(data.weekly_order_target)); setBenefits(data.benefits_description || ""); } }); }, []);
  async function save() {
    const weeklyOrderTarget = Math.max(1, Number(target) || 1);
    setSaving(true);
    const { error } = await supabase.from("weekly_order_target_settings").upsert({ id: true, weekly_order_target: weeklyOrderTarget, benefits_description: benefits.trim(), updated_at: new Date().toISOString() });
    setSaving(false);
    toast(error ? { title: "Could not save target", description: error.message, variant: "destructive" } : { title: "Weekly target saved", description: `Agents must complete ${weeklyOrderTarget.toLocaleString()} orders each week.` });
  }
  return <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Weekly price-reduction target</CardTitle><p className="text-sm text-muted-foreground">The meter resets automatically every Monday for each store.</p></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Orders required per week</Label><Input type="number" min="1" value={target} onChange={e => setTarget(e.target.value)} /></div><div className="space-y-2"><Label>Benefit description</Label><Input value={benefits} onChange={e => setBenefits(e.target.value)} placeholder="e.g. lower data prices and priority support" /></div><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save weekly target</Button></CardContent></Card>;
}
