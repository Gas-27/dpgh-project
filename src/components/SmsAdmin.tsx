import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import AdminPricingManager from "@/components/AdminPricingManager";
import { Check, Clock, Copy, Loader2, Plus, RefreshCw, Search, Trash2, Video, X } from "lucide-react";

type BlockedSender = { id: string; sender_id: string; reason: string | null; created_at: string };

type SenderRow = {
  id: string;
  sender_id: string;
  status: "pending" | "approved" | "rejected";
  is_global: boolean;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const statusStyles: Record<SenderRow["status"], string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-600 border-red-500/30",
};

export default function SmsAdmin() {
  const { toast } = useToast();
  const [senders, setSenders] = useState<SenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [newSender, setNewSender] = useState("");
  const [adding, setAdding] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [dashboardVideoUrl, setDashboardVideoUrl] = useState("");
  const [packagesVideoUrl, setPackagesVideoUrl] = useState("");
  const [dashboardLinkUrl, setDashboardLinkUrl] = useState("");
  const [packagesLinkUrl, setPackagesLinkUrl] = useState("");
  const [savingVideo, setSavingVideo] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingSearch, setPendingSearch] = useState("");
  const [senderSearch, setSenderSearch] = useState("");
  const [blockedSenders, setBlockedSenders] = useState<BlockedSender[]>([]);
  const [blockedSender, setBlockedSender] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [savingBlocked, setSavingBlocked] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_sms_sender_ids");
    if (error) toast({ title: "Could not load sender IDs", description: error.message, variant: "destructive" });
    setSenders((data || []) as SenderRow[]);
    const { data: blocked } = await supabase.rpc("admin_list_blocked_sms_senders");
    setBlockedSenders((blocked || []) as BlockedSender[]);
    const { data: settings } = await supabase.from("sms_settings").select("video_url,dashboard_video_url,packages_video_url,dashboard_link_url,packages_link_url").eq("id", true).maybeSingle();
    const current = settings as { video_url?: string | null; dashboard_video_url?: string | null; packages_video_url?: string | null; dashboard_link_url?: string | null; packages_link_url?: string | null } | null;
    setVideoUrl(current?.video_url ?? "");
    setDashboardVideoUrl(current?.dashboard_video_url ?? "");
    setPackagesVideoUrl(current?.packages_video_url ?? "");
    setDashboardLinkUrl(current?.dashboard_link_url ?? "");
    setPackagesLinkUrl(current?.packages_link_url ?? "");
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const setStatus = async (row: SenderRow, status: SenderRow["status"]) => {
    setBusy(row.id);
    const { error } = await supabase.rpc("admin_set_sms_sender_status", { p_id: row.id, p_status: status });
    setBusy(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setSenders((current) => current.map((item) => (item.id === row.id ? { ...item, status } : item)));
    toast({ title: `Sender ${status}`, description: `${row.sender_id} is now ${status}.` });
  };

  const bulkAction = async (action: "approved" | "rejected" | "delete") => {
    const rows = senders.filter((row) => selectedIds.includes(row.id));
    if (!rows.length) return;
    setBusy("bulk");
    const results = await Promise.all(rows.map((row) => action === "delete"
      ? supabase.rpc("admin_delete_sms_sender", { p_id: row.id })
      : supabase.rpc("admin_set_sms_sender_status", { p_id: row.id, p_status: action })));
    const failed = results.filter((result) => result.error);
    setBusy(null);
    if (failed.length) {
      toast({ title: "Some updates failed", description: failed[0].error?.message, variant: "destructive" });
    }
    setSelectedIds([]);
    await load();
    toast({ title: "Bulk action complete", description: `${rows.length - failed.length} sender ID(s) updated.` });
  };

  const remove = async (row: SenderRow) => {
    setBusy(row.id);
    const { error } = await supabase.rpc("admin_delete_sms_sender", { p_id: row.id });
    setBusy(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setSenders((current) => current.filter((item) => item.id !== row.id));
    toast({ title: "Sender deleted", description: `${row.sender_id} was removed.` });
  };

  const addBlocked = async () => {
    const value = blockedSender.trim().toUpperCase();
    if (!/^[A-Z0-9 ]{3,11}$/.test(value)) {
      toast({ title: "Invalid sender ID", description: "Use 3-11 letters, numbers, or spaces.", variant: "destructive" });
      return;
    }
    setSavingBlocked(true);
    const { error } = await supabase.rpc("admin_add_blocked_sms_sender", { p_sender_id: value, p_reason: blockedReason });
    setSavingBlocked(false);
    if (error) { toast({ title: "Could not block sender ID", description: error.message, variant: "destructive" }); return; }
    setBlockedSender(""); setBlockedReason(""); await load();
    toast({ title: "Sender ID blocked", description: `${value} cannot be submitted or used for SMS.` });
  };

  const removeBlocked = async (row: BlockedSender) => {
    const { error } = await supabase.rpc("admin_delete_blocked_sms_sender", { p_id: row.id });
    if (error) { toast({ title: "Could not unblock sender ID", description: error.message, variant: "destructive" }); return; }
    setBlockedSenders((current) => current.filter((item) => item.id !== row.id));
  };

  const addGlobal = async () => {
    const value = newSender.trim().toUpperCase();
    if (!/^[A-Z0-9 ]{3,11}$/.test(value)) {
      toast({ title: "Invalid sender ID", description: "Use 3-11 letters, numbers, or spaces.", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.rpc("admin_add_global_sender", { p_sender_id: value });
    setAdding(false);
    if (error) {
      toast({ title: "Could not add sender ID", description: error.message, variant: "destructive" });
      return;
    }
    setNewSender("");
    await load();
    toast({ title: "Global sender added", description: `${value} is now available on all dashboards.` });
  };

  const saveVideo = async () => {
    setSavingVideo(true);
    const { error } = await supabase.from("sms_settings").update({ video_url: videoUrl || null, dashboard_video_url: dashboardVideoUrl || null, packages_video_url: packagesVideoUrl || null, dashboard_link_url: dashboardLinkUrl || null, packages_link_url: packagesLinkUrl || null }).eq("id", true);
    setSavingVideo(false);
    if (error) {
      toast({ title: "Could not save video", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Video saved", description: "The tutorial video is now shown in the SMS section." });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `${text} copied. Send it to TxtConnect for approval.` });
    } catch {
      toast({ title: "Copy failed", description: "Copy manually instead.", variant: "destructive" });
    }
  };

  const pending = senders.filter((s) => s.status === "pending" && `${s.sender_id} ${s.user_email ?? ""}`.toLowerCase().includes(pendingSearch.toLowerCase().trim()));
  const others = senders.filter((s) => s.status !== "pending" && `${s.sender_id} ${s.user_email ?? ""}`.toLowerCase().includes(senderSearch.toLowerCase().trim()));

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Add Global Sender ID
              </CardTitle>
              <CardDescription>Added sender IDs are approved instantly and available on every dashboard.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newSender}
              maxLength={11}
              onChange={(e) => setNewSender(e.target.value.toUpperCase())}
              placeholder="e.g. DATA4ALL (max 11 chars)"
            />
            <Button onClick={() => void addGlobal()} disabled={adding} className="shrink-0">
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add for everyone
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle>Blocked Sender IDs</CardTitle><CardDescription>Locked IDs cannot be submitted for approval or used to send SMS.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input value={blockedSender} maxLength={11} onChange={(e) => setBlockedSender(e.target.value.toUpperCase())} placeholder="Sender ID to block" /><Input value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="Reason (optional)" /><Button onClick={() => void addBlocked()} disabled={savingBlocked}>{savingBlocked ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}Block sender</Button></div>
          {blockedSenders.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><span className="font-mono font-semibold">{row.sender_id}</span>{row.reason && <p className="text-xs text-muted-foreground">{row.reason}</p>}</div><Button size="sm" variant="outline" onClick={() => void removeBlocked(row)}>Unblock</Button></div>)}
          {!blockedSenders.length && <p className="text-sm text-muted-foreground">No sender IDs are blocked.</p>}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" /> SMS Tutorial Video
          </CardTitle>
          <CardDescription>Paste a YouTube/Vimeo/MP4 URL. It appears as a video inside the Send SMS section for all users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Dashboard video</Label><Input value={dashboardVideoUrl} onChange={(e) => setDashboardVideoUrl(e.target.value)} placeholder="Dashboard tutorial URL" /><Label>Dashboard link</Label><Input value={dashboardLinkUrl} onChange={(e) => setDashboardLinkUrl(e.target.value)} placeholder="Dashboard help link" /></div>
            <div className="space-y-2"><Label>Packages video</Label><Input value={packagesVideoUrl} onChange={(e) => setPackagesVideoUrl(e.target.value)} placeholder="Packages tutorial URL" /><Label>Packages link</Label><Input value={packagesLinkUrl} onChange={(e) => setPackagesLinkUrl(e.target.value)} placeholder="Packages help link" /></div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Legacy/default video URL" />
            <Button onClick={() => void saveVideo()} disabled={savingVideo} className="shrink-0">
              {savingVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save video
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pending Approval ({pending.length})</TabsTrigger>
          <TabsTrigger value="all">All Sender IDs ({senders.length})</TabsTrigger>
          <TabsTrigger value="pricing">SMS Pricing</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-0">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> Pending Approval ({pending.length})
          </CardTitle>
          <CardDescription>Copy sender IDs to TxtConnect, then approve, reject, or delete one or more submissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} placeholder="Search pending sender IDs or email" className="pl-9" /></div>
          {pending.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <Checkbox checked={pending.every((row) => selectedIds.includes(row.id))} onCheckedChange={(checked) => setSelectedIds(checked ? pending.map((row) => row.id) : [])} aria-label="Select all pending sender IDs" />
            <span className="mr-auto text-sm">{selectedIds.length} selected</span>
            <Button size="sm" onClick={() => void bulkAction("approved")} disabled={!selectedIds.length || busy === "bulk"}><Check className="mr-1 h-4 w-4" />Approve selected</Button>
            <Button size="sm" variant="outline" onClick={() => void bulkAction("rejected")} disabled={!selectedIds.length || busy === "bulk"}><X className="mr-1 h-4 w-4" />Reject selected</Button>
            <Button size="sm" variant="destructive" onClick={() => void bulkAction("delete")} disabled={!selectedIds.length || busy === "bulk"}><Trash2 className="mr-1 h-4 w-4" />Delete selected</Button>
          </div>}
          {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {!loading && pending.length === 0 && <p className="text-sm text-muted-foreground">No sender IDs awaiting approval.</p>}
          {pending.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id))} aria-label={`Select ${row.sender_id}`} />
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{row.sender_id}</span>
                  <Badge variant="outline" className={statusStyles[row.status]}>{row.status}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {row.user_email || "Unknown user"} · {new Date(row.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void copy(row.sender_id)}>
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </Button>
                <Button size="sm" onClick={() => void setStatus(row, "approved")} disabled={busy === row.id}>
                  <Check className="mr-1 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void setStatus(row, "rejected")} disabled={busy === row.id}>
                  <X className="mr-1 h-4 w-4" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

        </TabsContent>
        <TabsContent value="all" className="mt-0">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Sender IDs ({others.length})</CardTitle>
          <CardDescription>Approved and rejected sender IDs across all users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={senderSearch} onChange={(e) => setSenderSearch(e.target.value)} placeholder="Search sender IDs or email" className="pl-9" /></div>
          {!loading && others.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
          {others.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{row.sender_id}</span>
                  <Badge variant="outline" className={statusStyles[row.status]}>{row.status}</Badge>
                  {row.is_global && <Badge variant="secondary" className="text-[10px]">Global</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {row.is_global ? "Available to everyone" : row.user_email || "Unknown user"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void copy(row.sender_id)}>
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </Button>
                {row.status !== "approved" && (
                  <Button size="sm" onClick={() => void setStatus(row, "approved")} disabled={busy === row.id}>
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                )}
                {row.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => void setStatus(row, "pending")} disabled={busy === row.id}>
                    <Clock className="mr-1 h-4 w-4" /> Set pending
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => void remove(row)} disabled={busy === row.id}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="pricing" className="mt-0">
          <AdminPricingManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
