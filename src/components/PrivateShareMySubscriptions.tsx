import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";

// Generated Supabase types predate the private_share_* RPCs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type PublicAccess = {
  service_name: string;
  account_id: string;
  account_label: string;
  login_identifier: string | null;
  customer_instructions: string | null;
  access_emails: string[];
};

function AccessCard({ access }: { access: PublicAccess }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{access.service_name}</CardTitle>
          <Badge variant="secondary">Public access</Badge>
        </div>
        <CardDescription>{access.account_label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {access.login_identifier && (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Login</p>
            <p className="mt-1 break-all text-muted-foreground">{access.login_identifier}</p>
          </div>
        )}
        {access.access_emails.length > 0 && (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Service email access</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {access.access_emails.map((email) => <li key={email} className="break-all">{email}</li>)}
            </ul>
          </div>
        )}
        {access.customer_instructions && (
          <div className="rounded-md border p-3 text-sm text-pretty">
            <p className="font-medium">How to sign in</p>
            <p className="mt-1 text-muted-foreground">{access.customer_instructions}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PrivateShareMySubscriptions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PublicAccess[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.rpc("private_share_my_public_access");
    if (error) toast({ title: "Could not load your service access", description: error.message, variant: "destructive" });
    setItems(data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">My service access</h2>
          <p className="text-sm text-muted-foreground">The login and email access configured by the administrator are shown here. No seat assignment is required.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
      {items.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">You have no confirmed public-share subscriptions yet. Once your payment is confirmed, the administrator&apos;s service access details will appear here.</CardContent></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">{items.map((access) => <AccessCard key={access.account_id} access={access} />)}</div>
      )}
    </div>
  );
}
