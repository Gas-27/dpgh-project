import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Save } from "lucide-react";

type Service = { id: string; name: string; category: string; price: number; email: string | null; password: string | null; instructions: string | null };
export default function AdminDigitalServicesManager() {
  const { toast } = useToast(); const [services, setServices] = useState<Service[]>([]); const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => { supabase.from("digital_services").select("id,name,category,price,email,password,instructions").order("category").order("name").then(({ data }) => setServices((data as Service[]) || [])); }, []);
  const update = (id: string, field: keyof Service, value: string) => setServices((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  const save = async (service: Service) => { setSaving(service.id); const { error } = await supabase.from("digital_services").update({ email: service.email, password: service.password, instructions: service.instructions, updated_at: new Date().toISOString() }).eq("id", service.id); setSaving(null); toast(error ? { title: "Save failed", description: error.message, variant: "destructive" } : { title: "Credentials saved", description: `${service.name} was updated.` }); };
  return <Card className="border-border"><CardHeader><CardTitle className="flex items-center gap-2 font-display"><KeyRound className="h-5 w-5 text-primary" /> Digital Service Credentials</CardTitle><p className="text-sm text-muted-foreground">Manage activation credentials and customer instructions for each catalog service.</p></CardHeader><CardContent className="space-y-4">{services.map((service) => <div key={service.id} className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 lg:grid-cols-[1.1fr_1fr_1fr_1.5fr_auto] lg:items-end"><div><p className="font-semibold">{service.name}</p><p className="text-xs text-muted-foreground">{service.category} · GHC {Number(service.price).toFixed(2)}</p></div><div className="space-y-1"><Label className="text-xs">Email / Username</Label><Input value={service.email || ""} onChange={(e) => update(service.id, "email", e.target.value)} /></div><div className="space-y-1"><Label className="text-xs">Password</Label><Input type="password" value={service.password || ""} onChange={(e) => update(service.id, "password", e.target.value)} /></div><div className="space-y-1"><Label className="text-xs">Activation instructions</Label><Textarea rows={2} value={service.instructions || ""} onChange={(e) => update(service.id, "instructions", e.target.value)} /></div><Button onClick={() => save(service)} disabled={saving === service.id}><Save className="mr-2 h-4 w-4" />Save</Button></div>)}</CardContent></Card>;
}
