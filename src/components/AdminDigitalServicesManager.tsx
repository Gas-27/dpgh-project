import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Save } from "lucide-react";

type Service = { id: string; name: string; category: string; price: number };
type Credential = { service_id: string; email: string | null; password: string | null; instructions: string | null };

export default function AdminDigitalServicesManager() {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [credentials, setCredentials] = useState<Record<string, Credential>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: serviceRows }, { data: credentialRows }] = await Promise.all([
        supabase.from("digital_services").select("id,name,category,price").order("category").order("name"),
        supabase.from("digital_service_credentials").select("service_id,email,password,instructions"),
      ]);
      setServices((serviceRows as Service[]) || []);
      setCredentials(Object.fromEntries(((credentialRows as Credential[]) || []).map((row) => [row.service_id, row])));
    };
    void load();
  }, []);

  const update = (serviceId: string, field: keyof Credential, value: string) => {
    setCredentials((current) => ({
      ...current,
      [serviceId]: { service_id: serviceId, email: null, password: null, instructions: null, ...current[serviceId], [field]: value },
    }));
  };

  const save = async (service: Service) => {
    const credential = credentials[service.id] || { service_id: service.id, email: null, password: null, instructions: null };
    setSaving(service.id);
    const { error } = await supabase.from("digital_service_credentials").upsert({ ...credential, updated_at: new Date().toISOString() });
    setSaving(null);
    toast(error ? { title: "Save failed", description: "The service credentials could not be saved.", variant: "destructive" } : { title: "Credentials saved", description: `${service.name} was updated.` });
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display"><KeyRound className="h-5 w-5 text-primary" />Digital Service Credentials</CardTitle>
        <p className="text-sm text-muted-foreground">Manage the email, password, and activation instructions shown after a service purchase.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {services.map((service) => {
          const credential = credentials[service.id] || { service_id: service.id, email: "", password: "", instructions: "" };
          return (
            <div key={service.id} className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 lg:grid-cols-[1.1fr_1fr_1fr_1.5fr_auto] lg:items-end">
              <div><p className="font-semibold">{service.name}</p><p className="text-xs text-muted-foreground">{service.category} · GHC {Number(service.price).toFixed(2)}</p></div>
              <div className="flex flex-col gap-1"><Label className="text-xs">Email / Username</Label><Input value={credential.email || ""} onChange={(event) => update(service.id, "email", event.target.value)} /></div>
              <div className="flex flex-col gap-1"><Label className="text-xs">Password</Label><Input type="password" value={credential.password || ""} onChange={(event) => update(service.id, "password", event.target.value)} /></div>
              <div className="flex flex-col gap-1"><Label className="text-xs">Activation instructions</Label><Textarea rows={2} value={credential.instructions || ""} onChange={(event) => update(service.id, "instructions", event.target.value)} /></div>
              <Button onClick={() => void save(service)} disabled={saving === service.id}><Save data-icon="inline-start" />Save</Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
