import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type ReportedProduct = {
  report_id: string;
  product_id: string;
  product_title: string;
  product_description: string | null;
  product_price: number;
  product_images: unknown;
  product_status: string;
  reason: string;
  offers_site_service: boolean;
  note: string | null;
  report_status: string;
  reported_at: string;
  report_count: number;
  poster_account_type: string;
  poster_store_name: string | null;
  poster_topup_reference: string | null;
  poster_email: string | null;
};

function firstImage(images: unknown): string | null {
  return Array.isArray(images) && typeof images[0] === "string" ? images[0] : null;
}

export default function AdminReportedProducts() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReportedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_reported_products" as never);
    if (error) toast({ title: "Could not load reports", description: error.message, variant: "destructive" });
    else setRows((data ?? []) as ReportedProduct[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deletePost(row: ReportedProduct) {
    if (!window.confirm(`Delete "${row.product_title}" permanently? It will be removed from the whole site.`)) return;
    setBusyId(row.report_id);
    const { error } = await supabase.rpc("admin_delete_reported_product" as never, { p_product_id: row.product_id } as never);
    setBusyId(null);
    if (error) {
      toast({ title: "Could not delete post", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post deleted", description: "It no longer shows anywhere on the site." });
    void load();
  }

  async function dismiss(row: ReportedProduct) {
    setBusyId(row.report_id);
    const { error } = await supabase.rpc("admin_dismiss_product_report" as never, { p_report_id: row.report_id } as never);
    setBusyId(null);
    if (error) {
      toast({ title: "Could not dismiss report", description: error.message, variant: "destructive" });
      return;
    }
    void load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reported Posts</CardTitle>
        <CardDescription>Marketplace posts reported by buyers. Delete a post to remove it from the site.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports...</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reported posts.</p>
        ) : (
          rows.map((row) => {
            const image = firstImage(row.product_images);
            const isUser = row.poster_account_type === "User";
            return (
              <div key={row.report_id} className="flex flex-col gap-4 rounded-lg border border-border p-4 md:flex-row">
                {image && <img src={image} alt={row.product_title} className="h-24 w-24 rounded-md object-cover" />}
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{row.product_title}</p>
                    <Badge variant="secondary">GHS {Number(row.product_price).toFixed(2)}</Badge>
                    <Badge variant={row.report_status === "open" ? "destructive" : "outline"}>{row.report_status}</Badge>
                    {row.report_count > 1 && <Badge variant="outline">{row.report_count} reports</Badge>}
                  </div>
                  {row.product_description && <p className="line-clamp-3 text-muted-foreground">{row.product_description}</p>}
                  <div className="rounded-md bg-muted/40 p-3">
                    <p><span className="text-muted-foreground">Posted by:</span> <strong>{row.poster_account_type}</strong></p>
                    {isUser ? (
                      <p><span className="text-muted-foreground">Top-up reference:</span> <strong>{row.poster_topup_reference ?? "Not available"}</strong></p>
                    ) : (
                      <>
                        <p><span className="text-muted-foreground">Store name:</span> <strong>{row.poster_store_name ?? "Not available"}</strong></p>
                        {row.poster_topup_reference && <p><span className="text-muted-foreground">Top-up reference:</span> <strong>{row.poster_topup_reference}</strong></p>}
                      </>
                    )}
                    {row.poster_email && <p><span className="text-muted-foreground">Email:</span> {row.poster_email}</p>}
                  </div>
                  <p><span className="text-muted-foreground">Reason:</span> {row.reason}</p>
                  <p><span className="text-muted-foreground">Offers a service the site already provides:</span> <strong>{row.offers_site_service ? "Yes" : "No"}</strong></p>
                  {row.note && <p><span className="text-muted-foreground">Reporter note:</span> {row.note}</p>}
                  <p className="text-xs text-muted-foreground">Reported {new Date(row.reported_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 md:flex-col">
                  <Button size="sm" variant="destructive" disabled={busyId === row.report_id} onClick={() => deletePost(row)}>
                    <Trash2 className="mr-1 h-4 w-4" /> Delete post
                  </Button>
                  {row.report_status === "open" && (
                    <Button size="sm" variant="outline" disabled={busyId === row.report_id} onClick={() => dismiss(row)}>
                      <X className="mr-1 h-4 w-4" /> Dismiss
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
