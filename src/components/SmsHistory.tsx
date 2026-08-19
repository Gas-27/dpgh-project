import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SmsHistoryProps = { ownerType: "customer" | "agent" | "subagent" | "subsubagent"; ownerId?: string };
type SmsRow = { id: string; sender_id: string; recipients: string[] | null; message: string; status: string; total_charge: number | null; created_at: string; completed_at?: string | null; provider_response?: unknown; provider_message_ids?: string[] | null; last_delivery_check_at?: string | null };

const getMessageIds = (response: unknown) => {
  if (!Array.isArray(response)) return [];
  return response.map((item: any) => item?.message_id || item?.body?.messageId || item?.body?.message_id || item?.body?.data?.messageId).filter(Boolean);
};

export default function SmsHistory({ ownerType, ownerId }: SmsHistoryProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<SmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (checkDelivery = false) => {
    if (!ownerId) return;
    setRefreshing(checkDelivery);
    let query = supabase.from("sms_messages").select("id,sender_id,recipients,message,status,total_charge,created_at,completed_at,provider_response,provider_message_ids,last_delivery_check_at").eq("owner_type", ownerType).eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(50);
    const { data, error } = await query;
    if (error) toast({ title: "Could not load SMS history", description: error.message, variant: "destructive" });
    let next = (data || []) as SmsRow[];
    if (checkDelivery) {
      next = await Promise.all(next.map(async (row) => {
        const ids = row.provider_message_ids?.length ? row.provider_message_ids : getMessageIds(row.provider_response);
        if (!ids.length) return row;
        const statuses = await Promise.all(ids.map(async (message_id) => {
          const result = await supabase.functions.invoke("txtconnect-sms", { body: { action: "status", message_id } });
          return result.data;
        }));
        const delivered = statuses.some((status: any) => String(status?.msg || status?.message || "").toLowerCase().includes("delivered"));
        const nextStatus = delivered ? "delivered" : row.status;
        const checkedAt = new Date().toISOString();
        await supabase.from("sms_messages").update({ status: nextStatus, last_delivery_check_at: checkedAt, ...(nextStatus !== row.status ? { completed_at: checkedAt } : {}) }).eq("id", row.id);
        return delivered ? { ...row, status: nextStatus, completed_at: checkedAt, last_delivery_check_at: checkedAt } : { ...row, last_delivery_check_at: checkedAt };
      }));
    }
    setRows(next);
    setLoading(false);
    setRefreshing(false);
  }, [ownerId, ownerType, toast]);

  useEffect(() => { void load(); }, [load]);

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-3">
      <CardTitle>SMS History</CardTitle>
      <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing}>
        {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        Refresh delivery status
      </Button>
    </CardHeader>
    <CardContent>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No SMS messages have been sent yet.</p> : <div className="space-y-3">
        {rows.map((row) => <div key={row.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="font-semibold">{row.sender_id}</span><Badge variant={row.status === "delivered" || row.status === "sent" ? "default" : "destructive"}>{row.status}</Badge></div><span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span></div>
          <p className="mt-2 text-sm text-foreground">{row.message}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>{row.recipients?.length || 0} recipient(s)</span><span>GHS {Number(row.total_charge || 0).toFixed(2)}</span>{row.completed_at && <span>Completed {new Date(row.completed_at).toLocaleString()}</span>}</div>
        </div>)}
      </div>}
    </CardContent>
  </Card>;
}

// Keep a named reference for future dashboard integrations.
export { SmsHistory };
