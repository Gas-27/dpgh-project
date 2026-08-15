import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Save, Power } from "lucide-react";

type Service = { id: string; name: string; category: string; price: number; active: boolean; logo_url: string | null };
type Credential = { service_id: string; email: string | null; password: string | null; instructions: string | null };

export default function AdminDigitalServicesManager() {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [credentials, setCredentials] = useState<Record<string, Credential>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const [{ data: serviceRows }, { data: credentialRows }] = await Promise.all([
      supabase.from("digital_services").select("id,name,category,price,active,logo_url").order("category").order("name"),
      supabase.from("digital_service_credentials").select("service_id,email,password,instructions"),
    ]);
    setServices((serviceRows as Service[]) || []);
    setCredentials(Object.fromEntries(((credentialRows as Credential[]) || []).map((row) => [row.service_id, row])));
  };

  useEffect(() => { void load(); }, []);

  const update = (serviceId: string, field: keyof Credential, value: string) => {
    setCredentials((current) => ({ ...current, [serviceId]: { service_id: serviceId, email: null, password: null, instructions: null, ...current[serviceId], [field]: value } }));
  };

  const toggle = async (service: Service, active: boolean) => {
    const { error } = await supabase.from("digital_services").update({ active, updated_at: new Date().toISOString() }).eq("id", service.id);
    if (error) { toast({ title: "Update failed", description: "The service status could not be changed.", variant: "destructive" }); return; }
    setServices((current) => current.map((item) => item.id === service.id ? { ...item, active } : item));
    toast({ title: active ? "Service enabled" : "Service disabled", description: `${service.name} is ${active ? "now visible" : "hidden"} in Packages.` });
  };

  const save = async (service: Service) => {
    const credential = credentials[service.id] || { service_id: service.id, email: null, password: null, instructions: null };
    setSaving(service.id);
    const { error } = await supabase.from("digital_service_credentials").upsert({ ...credential, updated_at: new Date().toISOString() });
    setSaving(null);
    toast(error ? { title: "Save failed", description: "The service credentials could not be saved.", variant: "destructive" } : { title: "Service details saved", description: `${service.name} credentials and instructions were updated.` });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3"><KeyRound className="mt-1 h-5 w-5 text-primary" /><div><h2 className="font-display text-xl font-bold">Digital Service Credentials</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Click a service to edit its current email, password, activation instructions, logo, and availability.</p></div></div>
      </div>
      {services.map((service) => {
        const credential = credentials[service.id] || { service_id: service.id, email: "", password: "", instructions: "" };
        return <Card key={service.id} className="overflow-hidden border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 bg-muted/20">
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background p-2">{service.logo_url ? <img src={service.logo_url} alt={`${service.name} logo`} className="h-full w-full object-contain" /> : <KeyRound className="h-5 w-5 text-primary" />}</div><div className="min-w-0"><CardTitle className="truncate text-base">{service.name}</CardTitle><p className="text-xs text-muted-foreground">{service.category} · GHC {Number(service.price).toFixed(2)}</p></div></div>
            <div className="flex shrink-0 items-center gap-3"><Badge variant={service.active ? "default" : "secondary"}>{service.active ? "Live" : "Off"}</Badge><div className="flex items-center gap-2"><Power className="h-4 w-4 text-muted-foreground" /><Switch checked={service.active} onCheckedChange={(checked) => void toggle(service, checked)} aria-label={`Turn ${service.name} ${service.active ? "off" : "on"}`} /></div></div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 md:grid-cols-2">
            <div className="flex flex-col gap-1"><Label className="text-xs">Current email / username</Label><Input value={credential.email || ""} onChange={(event) => update(service.id, "email", event.target.value)} placeholder="Enter current login email" /></div>
            <div className="flex flex-col gap-1"><Label className="text-xs">Current password</Label><Input type="password" value={credential.password || ""} onChange={(event) => update(service.id, "password", event.target.value)} placeholder="Enter current password" /></div>
            <div className="flex flex-col gap-1 md:col-span-2"><Label className="text-xs">Activation instructions</Label><Textarea rows={5} value={credential.instructions || ""} onChange={(event) => update(service.id, "instructions", event.target.value)} placeholder="Add the steps customers should follow after payment" /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2"><p className="text-xs text-muted-foreground">{service.active ? "Customers can see and buy this service." : "This service is hidden from the customer Packages page."}</p><Button onClick={() => void save(service)} disabled={saving === service.id}><Save data-icon="inline-start" />{saving === service.id ? "Saving..." : "Save service details"}</Button></div>
          </CardContent>
        </Card>;
      })}
    </div>
  );
}

