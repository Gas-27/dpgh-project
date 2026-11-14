import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/lib/friendlySonner";
import { AlertTriangle, Check, Copy, Eye, EyeOff, Loader2, RefreshCw, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WebhookConfig {
  configured: boolean;
  url: string | null;
  enabled: boolean;
  secret: string | null;
  disabled_reason: string | null;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  updated_at: string | null;
}

interface WebhookDelivery {
  id: string;
  event_id: string;
  event: string;
  order_id: string | null;
  status: "pending" | "sending" | "delivered" | "failed";
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  next_attempt_at: string | null;
  created_at: string;
  delivered_at: string | null;
  payload: unknown;
}

interface TestResult {
  success: boolean;
  status_code: number | null;
  error: string | null;
  response_preview: string | null;
  duration_ms: number | null;
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  message: string | null;
}

const MAX_URL_LENGTH = 500;
const TEST_COOLDOWN_SECONDS = 10;

async function callWebhookApi<T>(action: string, params: Record<string, unknown> = {}): Promise<ApiResult<T>> {
  const { data, error } = await supabase.functions.invoke("api-webhook-settings", {
    body: { action, ...params },
  });

  if (error) {
    let status = 500;
    let body: { error?: string; message?: string; data?: T } | null = null;
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === "function") {
      status = response.status;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    }
    return {
      ok: false,
      status,
      data: (body?.data as T) ?? null,
      error: body?.error || body?.message || error.message || "Request failed",
      message: null,
    };
  }

  const body = data as { success?: boolean; error?: string; message?: string; data?: T } | null;
  if (!body?.success) {
    return {
      ok: false,
      status: 400,
      data: (body?.data as T) ?? null,
      error: body?.error || body?.message || "Request failed",
      message: null,
    };
  }
  return { ok: true, status: 200, data: (body.data as T) ?? null, error: null, message: body.message ?? null };
}

function validateUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your webhook URL.";
  if (trimmed.length > MAX_URL_LENGTH) return `Webhook URL must be ${MAX_URL_LENGTH} characters or fewer.`;
  if (!trimmed.toLowerCase().startsWith("https://")) return "Webhook URL must use https://";
  return null;
}

function timeAgo(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortId(value: string | null): string {
  if (!value) return "-";
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

function DeliveryStatusBadge({ status }: { status: WebhookDelivery["status"] }) {
  if (status === "delivered") {
    return <Badge className="border-green-500/30 bg-green-500/15 text-green-500 hover:bg-green-500/15">Delivered</Badge>;
  }
  if (status === "failed") {
    return <Badge className="border-red-500/30 bg-red-500/15 text-red-500 hover:bg-red-500/15">Failed</Badge>;
  }
  return (
    <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-500 hover:bg-blue-500/15">
      {status === "sending" ? "Sending" : "Pending"}
    </Badge>
  );
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy. Select the text and copy it manually.");
  }
}

interface WebhookSettingsProps {
  hasApiKey: boolean;
}

export default function WebhookSettings({ hasApiKey }: WebhookSettingsProps) {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [enabledInput, setEnabledInput] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const [testing, setTesting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [confirmRotate, setConfirmRotate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyConfig = useCallback((next: WebhookConfig) => {
    setConfig(next);
    setUrlInput(next.url || "");
    setEnabledInput(next.configured ? next.enabled : true);
  }, []);

  const loadDeliveries = useCallback(async () => {
    setDeliveriesLoading(true);
    const result = await callWebhookApi<WebhookDelivery[]>("deliveries", { limit: 50 });
    setDeliveriesLoading(false);
    if (result.ok) {
      setDeliveries(Array.isArray(result.data) ? result.data : []);
    } else {
      toast.error(result.error || "Could not load recent deliveries");
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await callWebhookApi<WebhookConfig>("get");
    setLoading(false);
    if (result.ok && result.data) {
      applyConfig(result.data);
      if (result.data.configured) void loadDeliveries();
    } else {
      setLoadError(result.error || "Could not load webhook settings");
    }
  }, [applyConfig, loadDeliveries]);

  useEffect(() => {
    if (!hasApiKey) return;
    void loadConfig();
  }, [hasApiKey, loadConfig]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const startCooldown = () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    setCooldown(TEST_COOLDOWN_SECONDS);
    cooldownTimer.current = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          cooldownTimer.current = null;
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  if (!hasApiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Generate an API key first, then you can set a webhook URL here.</p>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    const validationError = validateUrl(urlInput);
    setUrlError(validationError);
    if (validationError) return;

    setSaving(true);
    const result = await callWebhookApi<WebhookConfig>("set", { url: urlInput.trim(), enabled: enabledInput });
    setSaving(false);

    if (!result.ok) {
      setUrlError(result.error || "Could not save webhook URL");
      toast.error(result.error || "Could not save webhook URL");
      return;
    }

    const secret = result.data?.secret || null;
    if (secret && !secret.includes("•")) {
      setOneTimeSecret(secret);
      setRevealedSecret(null);
    }
    toast.success("Webhook URL saved");
    await loadConfig();
  };

  const handleToggle = async (checked: boolean) => {
    setEnabledInput(checked);
    if (!config?.configured) return;
    setBusyAction("toggle");
    const result = await callWebhookApi<WebhookConfig>(checked ? "enable" : "disable");
    setBusyAction(null);
    if (!result.ok) {
      setEnabledInput(!checked);
      toast.error(result.error || "Could not update webhook");
      return;
    }
    toast.success(checked ? "Webhook enabled" : "Webhook disabled");
    await loadConfig();
  };

  const handleReveal = async () => {
    if (revealedSecret) {
      setRevealedSecret(null);
      return;
    }
    setRevealing(true);
    const result = await callWebhookApi<{ secret: string }>("reveal_secret");
    setRevealing(false);
    if (!result.ok || !result.data?.secret) {
      toast.error(result.error || "Could not reveal secret");
      return;
    }
    setRevealedSecret(result.data.secret);
  };

  const handleCopySecret = async () => {
    if (revealedSecret) {
      await copyToClipboard(revealedSecret, "Signing secret");
      return;
    }
    setRevealing(true);
    const result = await callWebhookApi<{ secret: string }>("reveal_secret");
    setRevealing(false);
    if (!result.ok || !result.data?.secret) {
      toast.error(result.error || "Could not copy secret");
      return;
    }
    await copyToClipboard(result.data.secret, "Signing secret");
  };

  const handleRotate = async () => {
    setConfirmRotate(false);
    setBusyAction("rotate");
    const result = await callWebhookApi<{ secret: string }>("rotate_secret");
    setBusyAction(null);
    if (!result.ok || !result.data?.secret) {
      toast.error(result.error || "Could not rotate secret");
      return;
    }
    setOneTimeSecret(result.data.secret);
    setRevealedSecret(null);
    toast.success("Signing secret rotated");
    await loadConfig();
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    setBusyAction("delete");
    const result = await callWebhookApi<unknown>("delete");
    setBusyAction(null);
    if (!result.ok) {
      toast.error(result.error || "Could not remove webhook");
      return;
    }
    setOneTimeSecret(null);
    setRevealedSecret(null);
    setTestResult(null);
    setDeliveries([]);
    setExpandedId(null);
    setUrlInput("");
    setEnabledInput(true);
    toast.success("Webhook removed");
    await loadConfig();
  };

  const handleTest = async () => {
    if (testing || cooldown > 0) return;
    setTesting(true);
    setTestResult(null);
    startCooldown();
    const result = await callWebhookApi<Omit<TestResult, "success">>("test");
    setTesting(false);

    if (result.status === 429) {
      toast.error("Please wait a few seconds before sending another test.");
      return;
    }
    if (result.data) {
      setTestResult({ ...result.data, success: result.ok });
      if (result.ok) toast.success("Your server accepted the test event");
      else toast.error("Your server did not return a 2xx response");
    } else if (!result.ok) {
      toast.error(result.error || "Could not send test event");
    }
    void loadDeliveries();
  };

  const handleResend = async (delivery: WebhookDelivery) => {
    setResendingId(delivery.id);
    const result = await callWebhookApi<unknown>("redeliver", { delivery_id: delivery.id });
    setResendingId(null);
    if (!result.ok) {
      toast.error(result.error || "Could not resend event");
      return;
    }
    toast.success("Event queued for resend");
    await loadDeliveries();
  };

  const status = !config?.configured ? "not-set" : config.enabled ? "active" : "disabled";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-display flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Settings
          </CardTitle>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : status === "active" ? (
            <Badge className="border-green-500/30 bg-green-500/15 text-green-500 hover:bg-green-500/15">Active</Badge>
          ) : status === "disabled" ? (
            <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-500 hover:bg-amber-500/15">Disabled</Badge>
          ) : (
            <Badge variant="secondary">Not set</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          We send a signed POST request to your URL every time one of your API orders changes status.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {loadError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={() => void loadConfig()}>
              Try again
            </Button>
          </div>
        )}

        {status === "disabled" && config?.disabled_reason && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="break-words">{config.disabled_reason}</span>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="webhook-url" className="text-sm font-medium">
            Webhook URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="webhook-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://yourdomain.com/webhooks/justbuy"
              maxLength={MAX_URL_LENGTH}
              value={urlInput}
              onChange={(event) => {
                setUrlInput(event.target.value);
                if (urlError) setUrlError(null);
              }}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? "webhook-url-error" : undefined}
              className="font-mono text-sm"
            />
            <Button onClick={() => void handleSave()} disabled={saving || loading} className="sm:w-28">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          {urlError && (
            <p id="webhook-url-error" role="alert" className="break-words text-sm text-destructive">
              {urlError}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Switch
              id="webhook-enabled"
              checked={enabledInput}
              onCheckedChange={(checked) => void handleToggle(checked)}
              disabled={busyAction === "toggle" || loading}
            />
            <label htmlFor="webhook-enabled" className="text-sm">
              Enabled
            </label>
          </div>
        </div>

        {oneTimeSecret && (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Copy this now. Save your signing secret in your server settings.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-background p-2 font-mono text-xs">
                {oneTimeSecret}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copyToClipboard(oneTimeSecret, "Signing secret")}
                aria-label="Copy signing secret"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setOneTimeSecret(null)}>
              <Check className="mr-1 h-4 w-4" />
              I have copied it
            </Button>
          </div>
        )}

        {config?.configured && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Signing secret</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted p-2 font-mono text-xs">
                  {revealedSecret || config.secret || "-"}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleReveal()}
                  disabled={revealing}
                  aria-label={revealedSecret ? "Hide signing secret" : "Show signing secret"}
                >
                  {revealing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : revealedSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleCopySecret()} disabled={revealing} aria-label="Copy signing secret">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmRotate(true)} disabled={busyAction === "rotate"}>
                  Rotate secret
                </Button>
              </div>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Last success: </span>
                <span className="font-medium">{timeAgo(config.last_success_at)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Last failure: </span>
                <span className="font-medium">{timeAgo(config.last_failure_at)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleTest()} disabled={testing || cooldown > 0}>
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : cooldown > 0 ? (
                  `Send test event (${cooldown}s)`
                ) : (
                  "Send test event"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                disabled={busyAction === "delete"}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Remove webhook
              </Button>
            </div>

            {testResult && (
              <div
                role="status"
                className={
                  testResult.success
                    ? "rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm"
                    : "rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm"
                }
              >
                <p className="font-semibold">
                  {testResult.success ? "Test passed" : "Test failed"}
                  {testResult.status_code != null && ` - HTTP ${testResult.status_code}`}
                  {testResult.duration_ms != null && ` (${testResult.duration_ms} ms)`}
                </p>
                {testResult.error && <p className="mt-1 break-words text-muted-foreground">{testResult.error}</p>}
                {testResult.response_preview && (
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 font-mono text-xs">
                    {testResult.response_preview}
                  </pre>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold">Recent deliveries</h3>
                <Button size="sm" variant="outline" onClick={() => void loadDeliveries()} disabled={deliveriesLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${deliveriesLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {deliveries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  {deliveriesLoading ? "Loading deliveries..." : "No deliveries yet. Send a test event to see one here."}
                </p>
              ) : (
                <>
                  <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Event</th>
                          <th className="px-3 py-2">Order ID</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Attempts</th>
                          <th className="px-3 py-2">HTTP</th>
                          <th className="px-3 py-2">Error</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((delivery) => (
                          <DeliveryRow
                            key={delivery.id}
                            delivery={delivery}
                            expanded={expandedId === delivery.id}
                            resending={resendingId === delivery.id}
                            onToggle={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
                            onResend={() => void handleResend(delivery)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-2 md:hidden">
                    {deliveries.map((delivery) => (
                      <DeliveryCard
                        key={delivery.id}
                        delivery={delivery}
                        expanded={expandedId === delivery.id}
                        resending={resendingId === delivery.id}
                        onToggle={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
                        onResend={() => void handleResend(delivery)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate signing secret?</AlertDialogTitle>
            <AlertDialogDescription>
              Your old secret stops working immediately. Update your server with the new secret straight away or you will reject our events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRotate()}>Rotate secret</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              We will stop sending order updates to your URL and your signing secret will be deleted. You can set a new URL at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Remove webhook</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface DeliveryItemProps {
  delivery: WebhookDelivery;
  expanded: boolean;
  resending: boolean;
  onToggle: () => void;
  onResend: () => void;
}

function PayloadBlock({ payload }: { payload: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 font-mono text-xs">
      {JSON.stringify(payload ?? null, null, 2)}
    </pre>
  );
}

function DeliveryRow({ delivery, expanded, resending, onToggle, onResend }: DeliveryItemProps) {
  return (
    <>
      <tr
        className="cursor-pointer border-t border-border hover:bg-muted/50"
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        aria-expanded={expanded}
      >
        <td className="whitespace-nowrap px-3 py-2">{formatTime(delivery.created_at)}</td>
        <td className="px-3 py-2 font-mono text-xs">{delivery.event}</td>
        <td className="px-3 py-2 font-mono text-xs" title={delivery.order_id || undefined}>
          {shortId(delivery.order_id)}
        </td>
        <td className="px-3 py-2">
          <DeliveryStatusBadge status={delivery.status} />
        </td>
        <td className="px-3 py-2">{delivery.attempts}</td>
        <td className="px-3 py-2">{delivery.last_status_code ?? "-"}</td>
        <td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground" title={delivery.last_error || undefined}>
          {delivery.last_error || "-"}
        </td>
        <td className="px-3 py-2 text-right">
          {delivery.status === "failed" && (
            <Button
              size="sm"
              variant="outline"
              disabled={resending}
              onClick={(event) => {
                event.stopPropagation();
                onResend();
              }}
            >
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend"}
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-muted/30">
          <td colSpan={8} className="px-3 py-3">
            <PayloadBlock payload={delivery.payload} />
          </td>
        </tr>
      )}
    </>
  );
}

function DeliveryCard({ delivery, expanded, resending, onToggle, onResend }: DeliveryItemProps) {
  return (
    <div className="rounded-lg border border-border p-3">
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full space-y-2 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs">{delivery.event}</span>
          <DeliveryStatusBadge status={delivery.status} />
        </div>
        <p className="text-xs text-muted-foreground">{formatTime(delivery.created_at)}</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <span>
            <span className="text-muted-foreground">Order: </span>
            <span className="font-mono">{shortId(delivery.order_id)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Tries: </span>
            {delivery.attempts}
          </span>
          <span>
            <span className="text-muted-foreground">HTTP: </span>
            {delivery.last_status_code ?? "-"}
          </span>
        </div>
        {delivery.last_error && <p className="break-words text-xs text-muted-foreground">{delivery.last_error}</p>}
      </button>
      {delivery.status === "failed" && (
        <Button size="sm" variant="outline" className="mt-2" disabled={resending} onClick={onResend}>
          {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend"}
        </Button>
      )}
      {expanded && (
        <div className="mt-2">
          <PayloadBlock payload={delivery.payload} />
        </div>
      )}
    </div>
  );
}
