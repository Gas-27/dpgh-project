import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Plus, Link2, Unlink, RefreshCw, Mail, ExternalLink } from "lucide-react";

type Service = { id: string; name: string; service_type: string };
type Config = {
  service_id: string; enabled: boolean; fulfillment_mode: string; entitlement_days: number;
  default_capacity: number | null; requires_verification: boolean; verification_provider: string | null;
  approved_at: string | null; notes: string | null;
};
type EmailIdentity = { id: string; email: string; provider_kind: string; label: string | null; active: boolean };
type Account = {
  id: string; service_id: string; label: string; capacity: number; capacity_basis: string | null;
  account_subscription_expires_at: string | null; maintenance_status: string; maintenance_until: string | null;
  supplier_ref: string | null; notes: string | null; login_identifier: string | null; login_password: string | null;
};
type Link = { id: string; account_id: string; email_identity_id: string; role: string };
type Assignment = {
  id: string; subscription_id: string; service_id: string; account_id: string | null; customer_id: string | null;
  status: string; entitlement_starts_at: string | null; entitlement_expires_at: string | null;
  customer_note: string | null; admin_note: string | null; created_at: string;
};
type Verification = {
  id: string; assignment_id: string; status: string; source: string; customer_visible_note: string | null;
  note_expires_at: string | null; requested_at: string;
};
type Connection = {
  id: string; provider: string; email_identity_id: string; status: string; sender_allowlist: string[]; enabled: boolean;
};
type AuditRow = { id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string };

// Generated Supabase types predate the private_share_* tables and RPCs, so the client is untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const OCCUPYING = ["active", "expired", "revoked"];
const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : "-");
const toLocalInput = (v: string | null) => (v ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const short = (v: string | null) => (v ? v.slice(0, 8) : "-");

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["active", "completed"].includes(status)) return "default";
  if (["revoked", "failed", "suspended", "error"].includes(status)) return "destructive";
  if (["pending_fulfillment", "requested", "in_progress", "maintenance"].includes(status)) return "secondary";
  return "outline";
}

function NoteDialog({ open, title, description, initial, onClose, onSave }: {
  open: boolean; title: string; description: string; initial: string; onClose: () => void; onSave: (note: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setValue(initial); }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea value={value} maxLength={500} onChange={(e) => setValue(e.target.value)} rows={4} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={async () => { setBusy(true); try { await onSave(value); } finally { setBusy(false); } }}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductCard({ service, config, onSave }: {
  service: Service; config: Config | undefined; onSave: (service: Service, draft: Config) => Promise<void>;
}) {
  const initial: Config = config ?? {
    service_id: service.id, enabled: false, fulfillment_mode: "admin_assisted", entitlement_days: 30,
    default_capacity: null, requires_verification: false, verification_provider: null, approved_at: null, notes: null,
  };
  const [draft, setDraft] = useState<Config>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(initial); }, [config]); // eslint-disable-line react-hooks/exhaustive-deps
  const enabling = draft.enabled && !initial.enabled;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{service.name}</CardTitle>
          <Badge variant={initial.enabled ? "default" : "outline"}>{initial.enabled ? "Approved & enabled" : "Not enabled"}</Badge>
        </div>
        {initial.approved_at && <CardDescription>Approved {fmt(initial.approved_at)}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor={`en-${service.id}`}>Enable private-share fulfilment</Label>
          <Switch id={`en-${service.id}`} checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Fulfilment method</Label>
            <Select value={draft.fulfillment_mode} onValueChange={(v) => setDraft({ ...draft, fulfillment_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin_assisted">Admin assisted</SelectItem>
                <SelectItem value="supplier_api" disabled>Supplier API (not available yet)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Entitlement days</Label>
            <Input type="number" min={1} max={3650} value={draft.entitlement_days}
              onChange={(e) => setDraft({ ...draft, entitlement_days: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label>Default capacity</Label>
            <Input type="number" min={1} value={draft.default_capacity ?? ""} placeholder="Per account"
              onChange={(e) => setDraft({ ...draft, default_capacity: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border p-2">
            <Label htmlFor={`rv-${service.id}`}>Requires verification</Label>
            <Switch id={`rv-${service.id}`} checked={draft.requires_verification}
              onCheckedChange={(v) => setDraft({ ...draft, requires_verification: v, verification_provider: v ? "forwarding" : null })} />
          </div>
          <div className="space-y-1">
            <Label>Verification method</Label>
            <Select value={draft.verification_provider ?? "none"} disabled={!draft.requires_verification}
              onValueChange={(v) => setDraft({ ...draft, verification_provider: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="forwarding">Universal forwarding relay</SelectItem>
                <SelectItem value="manual">Manual (admin relays)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Textarea placeholder="Internal notes" value={draft.notes ?? ""} maxLength={1000}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} />
        <Button disabled={busy} onClick={async () => {
          if (enabling && !window.confirm(`Approve "${service.name}" for private-share fulfilment? Paid orders will start being assigned to accounts.`)) return;
          setBusy(true);
          try { await onSave(service, draft); } finally { setBusy(false); }
        }}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enabling ? "Approve and enable" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

type CodeSender = { domain: string; label: string | null; active: boolean };
const INBOUND_URL = `${import.meta.env.VITE_SUPABASE_URL ?? "https://uloaiqmknsrknqikbmtb.supabase.co"}/functions/v1/private-share-inbound-email`;

function InboundRelayCard() {
  // The relay is provider-agnostic: any mailbox that can forward matching messages can use it.
  const { toast } = useToast();
  const [secret, setSecret] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [senders, setSenders] = useState<CodeSender[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    const [s, d] = await Promise.all([
      db.rpc("private_share_admin_get_inbound_settings"),
      db.from("private_share_code_senders").select("*").order("domain"),
    ]);
    if (s.error) toast({ title: "Could not load relay settings", description: s.error.message, variant: "destructive" });
    else setSecret(s.data?.secret ?? null);
    setSenders(d.data ?? []);
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const copy = async (value: string, what: string) => {
    try { await navigator.clipboard.writeText(value); toast({ title: `${what} copied` }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  const rotate = async () => {
    if (!window.confirm("Rotate the secret? Your email forwarder stops working until you paste the new secret into it.")) return;
    setBusy(true);
    const { data, error } = await db.rpc("private_share_admin_rotate_inbound_secret");
    setBusy(false);
    if (error) { toast({ title: "Rotate failed", description: error.message, variant: "destructive" }); return; }
    setSecret(data?.secret ?? null); setRevealed(true);
    toast({ title: "Secret rotated" });
  };

  const setSender = async (domain: string, active: boolean) => {
    const { error } = await db.rpc("private_share_admin_set_code_sender", { p_domain: domain, p_active: active });
    if (error) { toast({ title: "Could not save sender", description: error.message, variant: "destructive" }); return false; }
    await loadAll();
    return true;
  };

  return (
    <div className="space-y-3">
      <Alert>
        <AlertTitle>How automatic verification codes work</AlertTitle>
        <AlertDescription>
          Forward the shared account&apos;s verification emails (for example from Netflix) to the URL below using an email-to-webhook service.
          The relay pulls out only the numeric code, stores it for 15 minutes and shows it to the customer who holds an active seat on that account when they press
          &quot;Get my login code&quot;. Each account needs its mailbox added in Emails and linked in Accounts with the role &quot;verification&quot;.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Forwarder settings</CardTitle>
          <CardDescription>Send a POST with JSON fields mailbox, from, subject, text (or html) and the header x-inbound-secret.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={INBOUND_URL} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copy(INBOUND_URL, "URL")}>Copy</Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Secret (header x-inbound-secret)</Label>
            <div className="flex gap-2">
              <Input readOnly type={revealed ? "text" : "password"} value={secret ?? ""} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => setRevealed((v) => !v)}>{revealed ? "Hide" : "Show"}</Button>
              <Button variant="outline" disabled={!secret} onClick={() => secret && copy(secret, "Secret")}>Copy</Button>
              <Button variant="destructive" disabled={busy} onClick={rotate}>Rotate</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Allowed sender domains</CardTitle>
          <CardDescription>Only codes from these domains (and their subdomains) are accepted. Everything else is ignored.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="example.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
            <Button disabled={!newDomain.trim()} onClick={async () => { if (await setSender(newDomain, true)) setNewDomain(""); }}>Add</Button>
          </div>
          <div className="space-y-2">
            {senders.map((s) => (
              <div key={s.domain} className="flex items-center justify-between rounded-md border p-2">
                <div className="text-sm"><span className="font-medium">{s.domain}</span>{s.label && <span className="text-muted-foreground"> - {s.label}</span>}</div>
                <Switch checked={s.active} aria-label={`Allow ${s.domain}`} onCheckedChange={(v) => setSender(s.domain, v)} />
              </div>
            ))}
            {senders.length === 0 && <p className="text-sm text-muted-foreground">No sender domains yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const emptyAccountForm = { id: null as string | null, label: "", capacity: 1, capacity_basis: "", expires: "", maintenance_status: "active", maintenance_until: "", supplier_ref: "", notes: "", login_identifier: "", login_password: "" };

export default function AdminPrivateShareManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [emails, setEmails] = useState<EmailIdentity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const [emailForm, setEmailForm] = useState({ id: null as string | null, email: "", provider_kind: "other", label: "", active: true });
  const [accountForm, setAccountForm] = useState({ ...emptyAccountForm });
  const [accountServiceId, setAccountServiceId] = useState("");
  const [linkDraft, setLinkDraft] = useState<Record<string, { email: string; role: string }>>({});
  const [integrationDraft, setIntegrationDraft] = useState({ email_identity_id: "", provider: "gmail", senders: "" });
  const [noteTarget, setNoteTarget] = useState<{ kind: "assignment" | "verification"; id: string; status?: string; initial: string } | null>(null);
  const [gmailState, setGmailState] = useState<{ connected: boolean; email?: string; lastSyncAt?: string | null; error?: string }>({ connected: false });
  const [gmailBusy, setGmailBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, c, e, a, l, asg, v, i, au] = await Promise.all([
      db.from("digital_services").select("id,name,service_type").eq("service_type", "private_shared").order("name"),
      db.from("private_share_product_config").select("*"),
      db.from("private_share_email_identities").select("*").order("email"),
      db.from("private_share_accounts").select("*").order("created_at", { ascending: false }),
      db.from("private_share_account_email_links").select("*"),
      db.from("private_share_assignments").select("*").order("created_at", { ascending: false }).limit(300),
      db.from("private_share_verification_requests").select("*").order("requested_at", { ascending: false }).limit(200),
      db.from("private_share_integration_connections").select("id,provider,email_identity_id,status,sender_allowlist,enabled"),
      db.from("private_share_audit_log").select("*").order("created_at", { ascending: false }).limit(150),
    ]);
    const firstError = [s, c, e, a, l, asg, v, i, au].find((r) => r.error)?.error;
    if (firstError) toast({ title: "Could not load private-share data", description: firstError.message, variant: "destructive" });
    setServices(s.data ?? []); setConfigs(c.data ?? []); setEmails(e.data ?? []); setAccounts(a.data ?? []);
    setLinks(l.data ?? []); setAssignments(asg.data ?? []); setVerifications(v.data ?? []);
    setConnections(i.data ?? []); setAudit(au.data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!accountServiceId && services.length) setAccountServiceId(services[0].id); }, [services, accountServiceId]);

  const rpc = useCallback(async (fn: string, args: Record<string, unknown>, success: string) => {
    const { error } = await db.rpc(fn, args);
    if (error) { toast({ title: "Action failed", description: error.message, variant: "destructive" }); return false; }
    toast({ title: success });
    await load();
    return true;
  }, [load, toast]);

  const connectGmail = async () => {
    setGmailBusy(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Admin session required");
      const response = await fetch("/api/private-share/gmail/authorize", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gmail authorization failed");
      if (data.authorizationUrl) {
        if (window.self !== window.top) window.open(data.authorizationUrl, "_blank", "noopener,noreferrer");
        else window.location.href = data.authorizationUrl;
        return;
      }
      setGmailState({ connected: true, email: data.email, lastSyncAt: data.lastSyncAt });
      toast({ title: "Gmail connected", description: data.email });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gmail authorization failed";
      setGmailState((current) => ({ ...current, error: message }));
      toast({ title: "Gmail connection failed", description: message, variant: "destructive" });
    } finally { setGmailBusy(false); }
  };

  const disconnectGmail = async () => {
    setGmailBusy(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const response = await fetch("/api/private-share/gmail/authorize", { method: "DELETE", headers: { Authorization: `Bearer ${token ?? ""}` } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Gmail disconnect failed")
      setGmailState({ connected: false })
      toast({ title: "Gmail disconnected", description: "You can now connect a different Google account." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gmail disconnect failed"
      toast({ title: "Gmail disconnect failed", description: message, variant: "destructive" })
    } finally { setGmailBusy(false) }
  };

  const syncGmail = async () => {
    setGmailBusy(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch("/api/private-share/gmail/sync", { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gmail synchronization failed");
      setGmailState((current) => ({ ...current, connected: true, lastSyncAt: data.synchronizedAt, error: undefined }));
      toast({ title: "Gmail synchronized", description: `${data.processed} verification message(s) processed.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gmail synchronization failed";
      setGmailState((current) => ({ ...current, error: message }));
      toast({ title: "Gmail sync failed", description: message, variant: "destructive" });
    } finally { setGmailBusy(false); }
  };

  const serviceName = useMemo(() => Object.fromEntries(services.map((x) => [x.id, x.name])), [services]);
  const emailById = useMemo(() => Object.fromEntries(emails.map((x) => [x.id, x])), [emails]);
  const accountById = useMemo(() => Object.fromEntries(accounts.map((x) => [x.id, x])), [accounts]);
  const occupied = useCallback((accountId: string) => assignments.filter((x) => x.account_id === accountId && OCCUPYING.includes(x.status)).length, [assignments]);
  const pending = assignments.filter((x) => x.status === "pending_fulfillment");
  const openVerifications = verifications.filter((x) => ["requested", "in_progress"].includes(x.status));

  const saveProduct = (service: Service, d: Config) =>
    rpc("private_share_admin_set_product", {
      p_service_id: service.id, p_enabled: d.enabled, p_fulfillment_mode: d.fulfillment_mode,
      p_entitlement_days: d.entitlement_days, p_default_capacity: d.default_capacity,
      p_requires_verification: d.requires_verification, p_verification_provider: d.verification_provider, p_notes: d.notes,
    }, d.enabled ? "Product saved" : "Product disabled").then(() => undefined);

  const saveEmail = async () => {
    const ok = await rpc("private_share_admin_upsert_email", {
      p_id: emailForm.id, p_email: emailForm.email, p_provider_kind: emailForm.provider_kind,
      p_label: emailForm.label || null, p_active: emailForm.active,
    }, emailForm.id ? "Email identity updated" : "Email identity added");
    if (ok) setEmailForm({ id: null, email: "", provider_kind: "other", label: "", active: true });
  };

  const saveAccount = async () => {
    const f = accountForm;
    const ok = await rpc("private_share_admin_upsert_account", {
      p_id: f.id, p_service_id: accountServiceId, p_label: f.label, p_capacity: f.capacity,
      p_capacity_basis: f.capacity_basis || null, p_subscription_expires_at: fromLocalInput(f.expires),
      p_maintenance_status: f.maintenance_status, p_maintenance_until: fromLocalInput(f.maintenance_until),
      p_supplier_ref: f.supplier_ref || null, p_notes: f.notes || null,
    }, f.id ? "Account updated" : "Account created");
    if (ok && f.id && f.login_password.trim()) {
      await rpc("private_share_admin_set_account_password", { p_account_id: f.id, p_password: f.login_password }, "Account password saved");
    }
    if (ok) setAccountForm({ ...emptyAccountForm });
  };

  const editAccount = (a: Account) => {
    setAccountServiceId(a.service_id);
    setAccountForm({
      id: a.id, label: a.label, capacity: a.capacity, capacity_basis: a.capacity_basis ?? "",
      expires: toLocalInput(a.account_subscription_expires_at), maintenance_status: a.maintenance_status,
      maintenance_until: toLocalInput(a.maintenance_until), supplier_ref: a.supplier_ref ?? "", notes: a.notes ?? "", login_identifier: a.login_identifier ?? "", login_password: "",
    });
  };

  const saveNote = async (note: string) => {
    if (!noteTarget) return;
    const ok = noteTarget.kind === "assignment"
      ? await rpc("private_share_admin_set_customer_note", { p_assignment_id: noteTarget.id, p_note: note }, "Customer note saved")
      : await rpc("private_share_admin_update_verification", { p_request_id: noteTarget.id, p_status: noteTarget.status, p_note: note }, "Verification updated");
    if (ok) setNoteTarget(null);
  };

  const saveIntegration = async () => {
    const senders = integrationDraft.senders.split(/[\s,;]+/).filter(Boolean);
    await rpc("private_share_admin_set_integration_config", {
      p_email_identity_id: integrationDraft.email_identity_id, p_provider: integrationDraft.provider, p_sender_allowlist: senders,
    }, "Integration configuration saved");
  };

  if (loading && !services.length && !emails.length) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Private-share fulfilment</h2>
          <p className="text-sm text-muted-foreground">Only services you approve here are fulfilled. Public-share products are unaffected.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {(pending.length > 0 || openVerifications.length > 0) && (
        <Alert>
          <AlertTitle>Needs attention</AlertTitle>
          <AlertDescription>
            {pending.length} order(s) awaiting an account with free capacity; {openVerifications.length} open verification request(s).
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="products">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="assignments">Assignments{pending.length ? ` (${pending.length} pending)` : ""}</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="relay">Code relay</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-3 pt-3">
          {services.length === 0 && <p className="text-sm text-muted-foreground">No services are marked as private-shared in Digital Services.</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {services.map((s) => (
              <ProductCard key={s.id} service={s} config={configs.find((c) => c.service_id === s.id)} onSave={saveProduct} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="emails" className="space-y-3 pt-3">
          <Card>
            <CardHeader><CardTitle className="text-base">{emailForm.id ? "Edit email identity" : "Add email identity"}</CardTitle>
              <CardDescription>Addresses only. Passwords and mailbox tokens are never stored here.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-5">
              <Input className="sm:col-span-2" type="email" placeholder="address@example.com" value={emailForm.email}
                onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} />
              <Select value={emailForm.provider_kind} onValueChange={(v) => setEmailForm({ ...emailForm, provider_kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="microsoft">Microsoft</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Label" value={emailForm.label} onChange={(e) => setEmailForm({ ...emailForm, label: e.target.value })} />
              <div className="flex items-center gap-2">
                <Switch checked={emailForm.active} onCheckedChange={(v) => setEmailForm({ ...emailForm, active: v })} />
                <span className="text-sm">Active</span>
              </div>
              <div className="flex gap-2 sm:col-span-5">
                <Button onClick={saveEmail} disabled={!emailForm.email}><Plus className="mr-2 h-4 w-4" />{emailForm.id ? "Update" : "Add"}</Button>
                {emailForm.id && <Button variant="outline" onClick={() => setEmailForm({ id: null, email: "", provider_kind: "other", label: "", active: true })}>Cancel</Button>}
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {emails.map((e) => {
              const linked = links.filter((l) => l.email_identity_id === e.id);
              return (
                <Card key={e.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-medium">{e.email} {e.label && <span className="text-muted-foreground">({e.label})</span>}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.provider_kind} - linked to {new Set(linked.map((l) => l.account_id)).size} account(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={e.active ? "default" : "outline"}>{e.active ? "Active" : "Inactive"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setEmailForm({ id: e.id, email: e.email, provider_kind: e.provider_kind, label: e.label ?? "", active: e.active })}>Edit</Button>
                  </div>
                </CardContent></Card>
              );
            })}
            {emails.length === 0 && <p className="text-sm text-muted-foreground">No email identities yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-3 pt-3">
          <Card>
            <CardHeader><CardTitle className="text-base">{accountForm.id ? "Edit service account" : "Create service account"}</CardTitle>
              <CardDescription>Capacity cannot be set below seats already held. Account credentials are not stored in this system.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Service</Label>
                <Select value={accountServiceId} onValueChange={setAccountServiceId} disabled={!!accountForm.id}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Label</Label>
                <Input value={accountForm.label} onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })} /></div>
              <div className="space-y-1"><Label>Permitted capacity</Label>
                <Input type="number" min={1} value={accountForm.capacity} onChange={(e) => setAccountForm({ ...accountForm, capacity: Number(e.target.value) })} /></div>
              <div className="space-y-1 sm:col-span-3"><Label>Capacity basis (provider terms)</Label>
                <Input value={accountForm.capacity_basis} placeholder="e.g. plan allows 5 profiles" onChange={(e) => setAccountForm({ ...accountForm, capacity_basis: e.target.value })} /></div>
              <div className="space-y-1"><Label>Account subscription expires</Label>
                <Input type="datetime-local" value={accountForm.expires} onChange={(e) => setAccountForm({ ...accountForm, expires: e.target.value })} /></div>
              <div className="space-y-1"><Label>Maintenance status</Label>
                <Select value={accountForm.maintenance_status} onValueChange={(v) => setAccountForm({ ...accountForm, maintenance_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Maintenance until</Label>
                <Input type="datetime-local" value={accountForm.maintenance_until} onChange={(e) => setAccountForm({ ...accountForm, maintenance_until: e.target.value })} /></div>
              <div className="space-y-1"><Label>Supplier reference</Label>
                <Input value={accountForm.supplier_ref} onChange={(e) => setAccountForm({ ...accountForm, supplier_ref: e.target.value })} /></div>
              <div className="space-y-1"><Label>Login email or username</Label>
                <Input value={accountForm.login_identifier} placeholder="Optional" onChange={(e) => setAccountForm({ ...accountForm, login_identifier: e.target.value })} /></div>
              <div className="space-y-1"><Label>Login password</Label>
                <Input type="text" value={accountForm.login_password} placeholder="Leave blank for verification pending" onChange={(e) => setAccountForm({ ...accountForm, login_password: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-3"><Label>Notes</Label>
                <Input value={accountForm.notes} onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })} /></div>
              <div className="flex gap-2 sm:col-span-3">
                <Button onClick={saveAccount} disabled={!accountServiceId || !accountForm.label.trim() || accountForm.capacity < 1}>
                  <Plus className="mr-2 h-4 w-4" />{accountForm.id ? "Update account" : "Create account"}
                </Button>
                {accountForm.id && <Button variant="outline" onClick={() => setAccountForm({ ...emptyAccountForm })}>Cancel</Button>}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {accounts.map((a) => {
              const used = occupied(a.id);
              const accountLinks = links.filter((l) => l.account_id === a.id);
              const draft = linkDraft[a.id] ?? { email: "", role: "login" };
              return (
                <Card key={a.id}><CardContent className="space-y-3 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{a.label} <span className="text-muted-foreground">- {serviceName[a.service_id] ?? "Unknown service"}</span></p>
                      <p className="text-xs text-muted-foreground">
                        Seats {used}/{a.capacity} - subscription ends {fmt(a.account_subscription_expires_at)}
                        {a.maintenance_until ? ` - maintenance until ${fmt(a.maintenance_until)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(a.maintenance_status)}>{a.maintenance_status}</Badge>
                      {!a.account_subscription_expires_at && <Badge variant="secondary">No expiry set: not assignable</Badge>}
                      <Button size="sm" variant="outline" onClick={() => editAccount(a)}>Edit</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {accountLinks.map((l) => (
                      <Badge key={l.id} variant="outline" className="gap-1">
                        {emailById[l.email_identity_id]?.email ?? "unknown"} ({l.role})
                        <button aria-label="Unlink email" onClick={() => rpc("private_share_admin_unlink_email", { p_link_id: l.id }, "Email unlinked")}>
                          <Unlink className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={draft.email} onValueChange={(v) => setLinkDraft({ ...linkDraft, [a.id]: { ...draft, email: v } })}>
                      <SelectTrigger className="w-60"><SelectValue placeholder="Link an email identity" /></SelectTrigger>
                      <SelectContent>{emails.map((e) => <SelectItem key={e.id} value={e.id}>{e.email}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={draft.role} onValueChange={(v) => setLinkDraft({ ...linkDraft, [a.id]: { ...draft, role: v } })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="login">Login</SelectItem>
                        <SelectItem value="recovery">Recovery</SelectItem>
                        <SelectItem value="verification">Verification</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={!draft.email}
                      onClick={() => rpc("private_share_admin_link_email", { p_account_id: a.id, p_email_identity_id: draft.email, p_role: draft.role }, "Email linked")}>
                      <Link2 className="mr-2 h-4 w-4" />Link
                    </Button>
                  </div>
                </CardContent></Card>
              );
            })}
            {accounts.length === 0 && <p className="text-sm text-muted-foreground">No service accounts yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-2 pt-3">
          {assignments.map((a) => (
            <Card key={a.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{serviceName[a.service_id] ?? "Unknown service"}
                  <span className="text-muted-foreground"> - {a.account_id ? accountById[a.account_id]?.label ?? "account" : "no account yet"}</span></p>
                <p className="text-xs text-muted-foreground">
                  Customer {short(a.customer_id)} - order {short(a.subscription_id)} - expires {fmt(a.entitlement_expires_at)}
                </p>
                {a.customer_note && <p className="text-xs">Customer note: {a.customer_note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(a.status)}>{a.status.replace("_", " ")}</Badge>
                <Button size="sm" variant="outline" onClick={() => setNoteTarget({ kind: "assignment", id: a.id, initial: a.customer_note ?? "" })}>Note</Button>
                {a.status === "active" && (
                  <Button size="sm" variant="destructive" onClick={() => window.confirm("Revoke this entitlement? The seat stays occupied until released.") &&
                    rpc("private_share_admin_set_assignment_status", { p_assignment_id: a.id, p_action: "revoke" }, "Assignment revoked")}>Revoke</Button>
                )}
                {["expired", "revoked"].includes(a.status) && (
                  <Button size="sm" variant="outline" onClick={() => window.confirm("Release this seat back to the account?") &&
                    rpc("private_share_admin_set_assignment_status", { p_assignment_id: a.id, p_action: "release" }, "Seat released")}>Release seat</Button>
                )}
              </div>
            </CardContent></Card>
          ))}
          {assignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
        </TabsContent>

        <TabsContent value="verification" className="space-y-2 pt-3">
          <p className="text-sm text-muted-foreground">Manual mode: you relay any verification step yourself. Customer-visible notes expire (default 1 hour, max 24 hours).</p>
          {verifications.map((v) => (
            <Card key={v.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">Request {short(v.id)} <span className="text-muted-foreground">- assignment {short(v.assignment_id)}</span></p>
                <p className="text-xs text-muted-foreground">Requested {fmt(v.requested_at)} - source {v.source}</p>
                {v.customer_visible_note && <p className="text-xs">Note shown until {fmt(v.note_expires_at)}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(v.status)}>{v.status.replace("_", " ")}</Badge>
                {["requested", "in_progress"].includes(v.status) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => rpc("private_share_admin_update_verification", { p_request_id: v.id, p_status: "in_progress" }, "Marked in progress")}>In progress</Button>
                    <Button size="sm" onClick={() => setNoteTarget({ kind: "verification", id: v.id, status: "completed", initial: "" })}>Complete</Button>
                    <Button size="sm" variant="destructive" onClick={() => setNoteTarget({ kind: "verification", id: v.id, status: "failed", initial: "" })}>Fail</Button>
                  </>
                )}
              </div>
            </CardContent></Card>
          ))}
          {verifications.length === 0 && <p className="text-sm text-muted-foreground">No verification requests.</p>}
        </TabsContent>

        <TabsContent value="relay" className="pt-3">
          <InboundRelayCard />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-3 pt-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" />Central Gmail verification inbox</CardTitle>
              <CardDescription>Connect the authorized JustBuy Gmail account. OAuth tokens remain server-side in Vercel Connect.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={gmailState.connected ? "default" : "outline"}>{gmailState.connected ? "Connected" : "Not connected"}</Badge>
                {gmailState.email && <span className="text-sm">{gmailState.email}</span>}
                {gmailState.lastSyncAt && <span className="text-xs text-muted-foreground">Last sync {fmt(gmailState.lastSyncAt)}</span>}
              </div>
              {gmailState.error && <p className="text-sm text-destructive">{gmailState.error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={connectGmail} disabled={gmailBusy}><ExternalLink className="mr-2 h-4 w-4" />Connect or reauthorize Gmail</Button>
                {gmailState.connected && <Button variant="outline" onClick={syncGmail} disabled={gmailBusy}><RefreshCw className="mr-2 h-4 w-4" />Sync inbox</Button>}
                {gmailState.connected && <Button variant="destructive" onClick={disconnectGmail} disabled={gmailBusy}>Disconnect this Gmail account</Button>}
              </div>
              <p className="text-xs text-muted-foreground">Only Gmail read access is requested. Messages are reduced to short-lived verification codes and are never shown to customers.</p>
            </CardContent>
          </Card>
          <Card><CardContent className="grid gap-3 p-3 sm:grid-cols-4">
            <Select value={integrationDraft.email_identity_id} onValueChange={(v) => setIntegrationDraft({ ...integrationDraft, email_identity_id: v })}>
              <SelectTrigger><SelectValue placeholder="Email identity" /></SelectTrigger>
              <SelectContent>{emails.map((e) => <SelectItem key={e.id} value={e.id}>{e.email}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={integrationDraft.provider} onValueChange={(v) => setIntegrationDraft({ ...integrationDraft, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">Gmail</SelectItem>
                <SelectItem value="microsoft">Microsoft</SelectItem>
              </SelectContent>
            </Select>
            <Input className="sm:col-span-2" placeholder="Allowed sender addresses (comma separated, max 20)" value={integrationDraft.senders}
              onChange={(e) => setIntegrationDraft({ ...integrationDraft, senders: e.target.value })} />
            <Button className="sm:col-span-4 sm:w-fit" onClick={saveIntegration} disabled={!integrationDraft.email_identity_id}>Save configuration</Button>
          </CardContent></Card>
          {connections.map((c) => (
            <Card key={c.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{emailById[c.email_identity_id]?.email ?? "unknown"} - {c.provider}</p>
                <p className="text-xs text-muted-foreground">Allowed senders: {c.sender_allowlist.join(", ") || "none"}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant={statusVariant(c.status)}>{c.status.replace("_", " ")}</Badge>
                <Badge variant="outline">{c.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="space-y-2 pt-3">
          {audit.map((r) => (
            <Card key={r.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <span className="font-medium">{r.action.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground"> - {r.entity_type} {short(r.entity_id)} - by {r.actor_id ? short(r.actor_id) : "system"}</span>
                {Object.keys(r.details ?? {}).length > 0 && <p className="text-xs text-muted-foreground break-all">{JSON.stringify(r.details)}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
            </CardContent></Card>
          ))}
          {audit.length === 0 && <p className="text-sm text-muted-foreground">No audit entries yet.</p>}
        </TabsContent>
      </Tabs>

      <NoteDialog
        open={!!noteTarget}
        title={noteTarget?.kind === "assignment" ? "Customer note" : `Mark verification ${noteTarget?.status ?? ""}`}
        description={noteTarget?.kind === "assignment"
          ? "Visible to the customer on their order. Do not include passwords or codes you do not want retained."
          : "Optional note shown to the customer for a short time (expires within 24 hours)."}
        initial={noteTarget?.initial ?? ""}
        onClose={() => setNoteTarget(null)}
        onSave={saveNote}
      />
    </div>
  );
}
