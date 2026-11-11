import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Loader2, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type BlockedNumber = {
  id: string;
  phone: string;
  reason: string | null;
  active: boolean;
  blocked_at: string;
};

type PendingAction = { type: "block" | "unblock"; phone: string } | null;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="destructive">Blocked</Badge>
  ) : (
    <Badge variant="secondary">Unblocked</Badge>
  );
}

export default function AdminBlockedNumbers() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BlockedNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingAction>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_list_blocked_numbers");
    if (error) {
      toast({ title: "Could not load blocked numbers", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      const list = ((data ?? []) as BlockedNumber[])
        .slice()
        .sort((a, b) => new Date(b.blocked_at).getTime() - new Date(a.blocked_at).getTime());
      setRows(list);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) => row.phone.toLowerCase().includes(term) || (row.reason ?? "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  function requestBlock() {
    const value = phone.trim();
    if (!value) {
      toast({ title: "Enter a phone number", description: "A phone number is required.", variant: "destructive" });
      return;
    }
    setPending({ type: "block", phone: value });
  }

  async function confirmAction() {
    if (!pending) return;
    const action = pending;
    setWorking(true);
    const { error } =
      action.type === "block"
        ? await (supabase as any).rpc("admin_block_number", {
            p_phone: action.phone,
            p_reason: reason.trim() || null,
          })
        : await (supabase as any).rpc("admin_unblock_number", { p_phone: action.phone });
    setWorking(false);

    if (error) {
      toast({
        title: action.type === "block" ? "Could not block number" : "Could not unblock number",
        description: error.message,
        variant: "destructive",
      });
      setPending(null);
      return;
    }

    if (action.type === "block") {
      setPhone("");
      setReason("");
      toast({ title: "Number blocked", description: `${action.phone} has been blocked everywhere.` });
    } else {
      toast({ title: "Number unblocked", description: `${action.phone} can buy again.` });
    }
    setPending(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-5 w-5 text-destructive" /> Blocked Numbers
          </CardTitle>
          <CardDescription>
            Block a phone number across the site, USSD and API. This also bans linked accounts and freezes their wallets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="blocked-phone">Phone number</Label>
              <Input
                id="blocked-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="e.g. 0241234567"
                inputMode="tel"
                autoComplete="off"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="blocked-reason">Reason</Label>
              <Input
                id="blocked-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. SCAMMER, chargeback fraud"
                autoComplete="off"
              />
            </div>
            <Button variant="destructive" onClick={requestBlock} disabled={working || !phone.trim()} className="w-full md:w-auto">
              <Ban className="mr-2 h-4 w-4" /> Block number
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between md:space-y-0">
          <CardTitle className="text-base">All blocked numbers ({filtered.length})</CardTitle>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search phone or reason"
              className="pl-9"
              aria-label="Search blocked numbers"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading blocked numbers...
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {rows.length === 0 ? "No blocked numbers yet." : "No numbers match your search."}
            </p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date blocked</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.phone}</TableCell>
                        <TableCell className="max-w-xs break-words">{row.reason || "-"}</TableCell>
                        <TableCell><StatusBadge active={row.active} /></TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(row.blocked_at)}</TableCell>
                        <TableCell className="text-right">
                          {row.active && (
                            <Button size="sm" variant="outline" onClick={() => setPending({ type: "unblock", phone: row.phone })}>
                              <ShieldCheck className="mr-1 h-4 w-4" /> Unblock
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="space-y-3 md:hidden">
                {filtered.map((row) => (
                  <li key={row.id} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{row.phone}</span>
                      <StatusBadge active={row.active} />
                    </div>
                    <p className="break-words text-sm text-muted-foreground">{row.reason || "No reason given"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(row.blocked_at)}</p>
                    {row.active && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => setPending({ type: "unblock", phone: row.phone })}>
                        <ShieldCheck className="mr-1 h-4 w-4" /> Unblock
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !working) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.type === "block" ? `Block ${pending.phone}?` : `Unblock ${pending?.phone ?? ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.type === "block"
                ? "This bans every account linked to this number, freezes their wallets, disables their API key, rejects their pending withdrawals and stops all purchases, rewards and withdrawals for this number everywhere (site, USSD, API)."
                : "They will be able to buy again, but banned accounts and frozen wallets stay as they are until lifted separately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <Button
              variant={pending?.type === "block" ? "destructive" : "default"}
              onClick={() => void confirmAction()}
              disabled={working}
            >
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending?.type === "block" ? "Block number" : "Unblock"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
