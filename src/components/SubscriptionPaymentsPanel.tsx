import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Props = { admin?: boolean };

type SubscriptionRow = {
  id: string;
  payment_reference: string;
  customer_name: string | null;
  customer_phone: string | null;
  service_name: string | null;
  amount: number;
  payment_status: string;
  confirmation_status: string;
  paid_at: string | null;
};

type ConfirmResult = { changed?: boolean; rows_updated?: number };

export default function SubscriptionPaymentsPanel({ admin = false }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [search, setSearch] = useState("");
  const [whatsapp, setWhatsapp] = useState("+233274467682");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc("private_share_admin_list_subscriptions" as never, { p_limit: 200 } as never);
    if (error) {
      setRows([]);
      setLoadError(error.message);
      toast({ title: "Could not load subscriptions", description: error.message, variant: "destructive" });
    } else {
      setRows((data as unknown as SubscriptionRow[]) || []);
    }
    const { data: settings } = await supabase.from("subscription_settings").select("whatsapp_number").eq("id", true).maybeSingle();
    if (settings?.whatsapp_number) setWhatsapp(settings.whatsapp_number);
    setLoading(false);
  }, [admin, toast]);

  useEffect(() => { load(); }, [load]);

  const saveWhatsapp = async () => {
    const { error } = await supabase.rpc("set_subscription_settings", { p_whatsapp_number: whatsapp });
    if (error) toast({ title: "Could not save WhatsApp number", description: error.message, variant: "destructive" });
    else toast({ title: "WhatsApp destination updated" });
  };

  const confirm = async (id: string) => {
    setConfirmingId(id);
    const { data, error } = await supabase.rpc("private_share_admin_confirm_subscription" as never, { p_id: id } as never);
    setConfirmingId(null);
    const result = data as unknown as ConfirmResult | null;
    if (error) {
      toast({ title: "Could not confirm payment", description: error.message, variant: "destructive" });
    } else if (!result || result.changed !== true || result.rows_updated !== 1) {
      toast({ title: "Nothing was changed", description: "The subscription was not confirmed. Refresh and try again.", variant: "destructive" });
    } else {
      toast({ title: "Subscription confirmed" });
    }
    load();
  };

  const needle = search.toLowerCase();
  const filtered = rows.filter((row) => [row.payment_reference, row.service_name, row.customer_name, row.customer_phone].some((value) => String(value || "").toLowerCase().includes(needle)));

  if (!admin) {
    return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Paid subscriptions are not available for this account.</CardContent></Card>;
  }

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-4">
      <CardTitle>Paid private-share subscriptions</CardTitle>
      <div className="flex items-center gap-2"><Input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} aria-label="Subscription WhatsApp number" /><Button onClick={saveWhatsapp}>Save number</Button></div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex gap-2"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payment reference, service, customer, or phone" /><Button variant="outline" onClick={load}>Refresh</Button></div>
      {loadError && <p role="alert" className="text-sm text-destructive">Subscriptions could not be loaded: {loadError}</p>}
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Payment reference</TableHead><TableHead>Service</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Paid at</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={8}>Loading subscriptions...</TableCell></TableRow>
          : filtered.length === 0 ? <TableRow><TableCell colSpan={8}>{loadError ? "Unavailable." : "No subscriptions found."}</TableCell></TableRow>
          : filtered.map((row) => {
            const canConfirm = row.payment_status === "paid" && row.confirmation_status === "pending";
            return <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.payment_reference}</TableCell>
              <TableCell>{row.service_name}</TableCell>
              <TableCell>{row.customer_name || row.customer_phone || "—"}</TableCell>
              <TableCell>GHS {Number(row.amount).toFixed(2)}</TableCell>
              <TableCell>{row.paid_at ? new Date(row.paid_at).toLocaleString() : "—"}</TableCell>
              <TableCell><Badge variant={row.payment_status === "paid" ? "default" : "secondary"}>{row.payment_status}</Badge></TableCell>
              <TableCell><Badge variant={row.confirmation_status === "confirmed" ? "default" : "secondary"}>{row.confirmation_status}</Badge></TableCell>
              <TableCell>{canConfirm && <Button size="sm" disabled={confirmingId === row.id} onClick={() => confirm(row.id)}>{confirmingId === row.id ? "Confirming..." : "Confirm"}</Button>}</TableCell>
            </TableRow>;
          })}
      </TableBody></Table></div>
    </CardContent>
  </Card>;
}
