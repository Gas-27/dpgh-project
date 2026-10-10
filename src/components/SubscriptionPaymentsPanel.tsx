import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Props = { admin?: boolean; storeId?: string | null };

export default function SubscriptionPaymentsPanel({ admin = false, storeId = null }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [whatsapp, setWhatsapp] = useState("+233274467682");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("private_share_subscriptions").select("*").order("created_at", { ascending: false }).limit(200);
    if (storeId) query = query.eq("seller_store_id", storeId);
    const { data, error } = await query;
    if (error) toast({ title: "Could not load subscriptions", description: error.message, variant: "destructive" });
    setRows(data || []);
    if (admin) {
      const { data: settings } = await supabase.from("subscription_settings").select("whatsapp_number").eq("id", true).maybeSingle();
      if (settings?.whatsapp_number) setWhatsapp(settings.whatsapp_number);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [storeId]);

  const saveWhatsapp = async () => {
    const { error } = await supabase.rpc("set_subscription_settings", { p_whatsapp_number: whatsapp });
    if (error) toast({ title: "Could not save WhatsApp number", description: error.message, variant: "destructive" });
    else toast({ title: "WhatsApp destination updated" });
  };

  const confirm = async (id: string) => {
    const { error } = await supabase.from("private_share_subscriptions").update({ confirmation_status: "confirmed", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast({ title: "Could not confirm payment", description: error.message, variant: "destructive" });
    else { toast({ title: "Subscription confirmed" }); load(); }
  };

  const filtered = rows.filter((row) => [row.payment_reference, row.service_name, row.customer_name, row.customer_phone].some((value) => String(value || "").toLowerCase().includes(search.toLowerCase())));

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-4">
      <CardTitle>Paid private-share subscriptions</CardTitle>
      {admin && <div className="flex items-center gap-2"><Input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} aria-label="Subscription WhatsApp number" /><Button onClick={saveWhatsapp}>Save number</Button></div>}
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex gap-2"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payment reference, service, customer, or phone" /><Button variant="outline" onClick={load}>Refresh</Button></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Payment reference</TableHead><TableHead>Service</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Paid at</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={7}>Loading subscriptions...</TableCell></TableRow> : filtered.map((row) => <TableRow key={row.id}><TableCell className="font-mono text-xs">{row.payment_reference}</TableCell><TableCell>{row.service_name}</TableCell><TableCell>{row.customer_name || row.customer_phone || "—"}</TableCell><TableCell>GHS {Number(row.amount).toFixed(2)}</TableCell><TableCell>{row.paid_at ? new Date(row.paid_at).toLocaleString() : "—"}</TableCell><TableCell><Badge variant={row.confirmation_status === "confirmed" ? "default" : "secondary"}>{row.confirmation_status}</Badge></TableCell><TableCell>{admin && row.confirmation_status !== "confirmed" && <Button size="sm" onClick={() => confirm(row.id)}>Confirm</Button>}</TableCell></TableRow>)}</TableBody></Table></div>
    </CardContent>
  </Card>;
}
