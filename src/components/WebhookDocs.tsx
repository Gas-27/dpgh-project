import { toast } from "@/lib/friendlySonner";
import { Copy, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebhookSettings from "@/components/WebhookSettings";

const BASE_URL = "https://api.dataplug.store/functions/v1";

const EXAMPLE_BODY = `{
  "id": "evt_3f2a9c0e8b1d4c7fa1e2b3c4d5e6f708",
  "event": "order.status_changed",
  "created_at": "2026-11-13T09:23:52Z",
  "data": {
    "order_id": "1a84e3a4-b25f-44eb-9579-61a19deccfc1",
    "status": "delivered",
    "previous_status": "processing",
    "phone": "0540391236",
    "network": "mtn_express",
    "size_gb": 1,
    "size_gb_text": null,
    "amount": 3.94,
    "refunded": false,
    "order_created_at": "2026-11-13T08:25:24.666+00:00",
    "updated_at": "2026-11-13T09:23:52.436476+00:00"
  }
}`;

const NODE_CODE = `const crypto = require("crypto");
app.post("/webhooks/dataplug", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.get("X-Webhook-Timestamp");
  const sig = (req.get("X-Webhook-Signature") || "").replace("sha256=", "");
  const raw = req.body.toString("utf8");
  const expected = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(\`\${ts}.\${raw}\`).digest("hex");
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.status(401).end();
  const event = JSON.parse(raw);
  // update your order using event.data.order_id and event.data.status
  res.status(200).json({ ok: true });
});`;

const PHP_CODE = `$raw = file_get_contents('php://input');
$ts  = $_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'] ?? '';
$sig = str_replace('sha256=', '', $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '');
$expected = hash_hmac('sha256', $ts . '.' . $raw, getenv('WEBHOOK_SECRET'));
if (!hash_equals($expected, $sig) || abs(time() - (int)$ts) > 300) { http_response_code(401); exit; }
$event = json_decode($raw, true);
http_response_code(200);
echo '{"ok":true}';`;

const CURL_CODE = `curl -X POST ${BASE_URL}/api-webhook-settings \\
  -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"action":"set","url":"https://yourdomain.com/webhooks/dataplug"}'

curl -X POST ${BASE_URL}/api-webhook-settings \\
  -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"action":"test"}'`;

const HEADERS: Array<[string, string]> = [
  ["X-Webhook-Event", "order.status_changed or webhook.test"],
  ["X-Webhook-Id", "Unique event id (evt_...). It is the same on retries, so use it to ignore duplicates."],
  ["X-Webhook-Timestamp", "Unix seconds when the event was signed"],
  ["X-Webhook-Signature", "sha256=<hex>"],
  ["User-Agent", "JustBuy-Webhooks/1.0"],
];

const STATUSES = ["processing", "waiting", "unverified", "delivered", "failed", "refunded"];

const ACTIONS: Array<[string, string, string]> = [
  ["get", "-", "Current settings (secret masked)"],
  ["set", "url, enabled (optional)", "Save your URL. The first save returns the signing secret ONCE. Copy it."],
  ["enable / disable / delete", "-", "Turn deliveries on or off, or remove the webhook"],
  ["rotate_secret", "-", "Create a new secret. The old one stops working immediately"],
  ["reveal_secret", "-", "Return the full signing secret"],
  ["test", "-", "Send a webhook.test event now (max once per 10 seconds). Returns your server's status code"],
  ["deliveries", "limit (1-100), status, order_id", "Delivery history. status: pending, sending, delivered, failed"],
  ["redeliver", "delivery_id", "Send a past event again"],
];

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast.success("Copied");
  } catch {
    toast.error("Could not copy. Select the text and copy it manually.");
  }
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-2 top-2 h-7 px-2"
        onClick={() => void copyCode(code)}
        aria-label="Copy code"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <pre className="overflow-x-auto whitespace-pre rounded-lg border border-border bg-muted p-3 pr-12 font-mono text-xs">
        {code}
      </pre>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-foreground">{children}</span>;
}

interface WebhookDocsProps {
  hasApiKey: boolean;
}

export default function WebhookDocs({ hasApiKey }: WebhookDocsProps) {
  return (
    <section id="webhooks" className="scroll-mt-20 space-y-6">
      <Card className="border-cyan-500/30 bg-cyan-500/5">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-xl">
            <Webhook className="h-5 w-5 text-cyan-400" />
            Webhooks (Order Status Updates)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Instead of polling <Mono>/track-order</Mono>, give us a URL and we POST to it every time one of your API orders changes
            status. Manage the webhook with <Mono>POST /api-webhook-settings</Mono> (same Bearer API key) or from the settings
            below.
          </p>
          <p>
            Use webhooks for instant updates and keep <Mono>GET /track-order</Mono> as a backup: it always has the current status.
          </p>
        </CardContent>
      </Card>

      <WebhookSettings hasApiKey={hasApiKey} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">When it fires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Event <Mono>order.status_changed</Mono> is sent every time an API order&apos;s <Mono>status</Mono> changes (processing to
            waiting, waiting to delivered, etc.). It is NOT sent when the order is created: the <Mono>/purchase</Mono> response is
            your confirmation. Expect several events per order; the last one has a final status (<Mono>delivered</Mono>,{" "}
            <Mono>failed</Mono> or <Mono>refunded</Mono>).
          </p>
          <p>
            <Mono>webhook.test</Mono> is sent by the <Mono>test</Mono> action.
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <span key={status} className="rounded bg-muted px-2 py-1 font-mono text-xs text-cyan-400">
                {status}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Request we send</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            <Mono>POST</Mono> to your URL with <Mono>Content-Type: application/json</Mono> and these headers:
          </p>
          <div className="space-y-2">
            {HEADERS.map(([name, desc]) => (
              <div key={name} className="flex flex-col gap-1 rounded-lg p-2 sm:flex-row sm:gap-3">
                <span className="w-fit whitespace-nowrap rounded bg-muted px-2 py-1 font-mono text-xs text-cyan-400">{name}</span>
                <span className="break-words">{desc}</span>
              </div>
            ))}
          </div>
          <p className="font-semibold text-foreground">Example body</p>
          <CodeBlock code={EXAMPLE_BODY} />
          <p>
            <Mono>data.order_id</Mono> is the same <Mono>order_id</Mono> returned by <Mono>/purchase</Mono>, and{" "}
            <Mono>data.status</Mono> is the same value returned by polling.
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-lg">Verifying the signature (important)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            signature = HMAC-SHA256 with your signing secret (<Mono>whsec_...</Mono>) over the string{" "}
            <Mono>{'TIMESTAMP + "." + RAW_BODY'}</Mono>, hex-encoded. Compare it to the value after <Mono>sha256=</Mono> in{" "}
            <Mono>X-Webhook-Signature</Mono>.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use the raw request body exactly as received. Do not re-serialize the JSON.</li>
            <li>Compare with a constant-time compare.</li>
            <li>Reject timestamps older than 5 minutes.</li>
          </ul>
          <Tabs defaultValue="node">
            <TabsList>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="php">PHP</TabsTrigger>
            </TabsList>
            <TabsContent value="node">
              <CodeBlock code={NODE_CODE} />
            </TabsContent>
            <TabsContent value="php">
              <CodeBlock code={PHP_CODE} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Responding and retries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-2 pl-5">
            <li>Reply with any 2xx within 10 seconds. Do slow work after replying.</li>
            <li>
              Anything else (non-2xx, redirect, timeout, connection error) is retried: 7 attempts in total, waiting 1 min, 5 min,
              30 min, 2 h, 6 h, 12 h between them (about 21 hours).
            </li>
            <li>
              After 25 events in a row fail every retry, the webhook is disabled automatically. Fix your endpoint, then{" "}
              <Mono>enable</Mono> it.
            </li>
            <li>
              Events can arrive more than once and, rarely, out of order. Use <Mono>X-Webhook-Id</Mono> to skip duplicates, and
              never move an order out of a final status.
            </li>
            <li>
              If you miss events, <Mono>GET /track-order</Mono> always has the current status.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URL rules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Must be <Mono>https://</Mono>.
            </li>
            <li>A public domain name (no IP addresses, no localhost or private networks).</li>
            <li>Port 443 or 8443.</li>
            <li>Maximum 500 characters.</li>
            <li>No username or password in the URL.</li>
            <li>Redirects are NOT followed: use the final URL.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="rounded bg-blue-500/20 px-2 py-1 font-mono text-xs text-blue-400">POST</span>
            <span>/api-webhook-settings</span>
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your webhook with <Mono>Authorization: Bearer YOUR_API_KEY</Mono> and a JSON body{" "}
            <Mono>{'{ "action": ... }'}</Mono>, or use the dashboard.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock code={CURL_CODE} />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">action</th>
                  <th className="px-3 py-2">Extra fields</th>
                  <th className="px-3 py-2">What it does</th>
                </tr>
              </thead>
              <tbody>
                {ACTIONS.map(([action, fields, desc]) => (
                  <tr key={action} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-cyan-400">{action}</td>
                    <td className="px-3 py-2 font-mono text-xs">{fields}</td>
                    <td className="px-3 py-2 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
