import { toast } from "@/lib/friendlySonner";
import { Copy, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebhookSettings from "@/components/WebhookSettings";

const BASE_URL = "https://api.dataplug.store/functions/v1";

const EXAMPLE_BODY = `{
  "id": "evt_271ce71ad8904bd193a08e904b88988b",
  "event": "order.status_changed",
  "created_at": "2026-11-10T10:19:52Z",
  "data": {
    "order_id": "35660ba7-7c86-4ebb-b837-d6c7e8c80273",
    "status": "delivered",
    "previous_status": "processing",
    "phone": "0241234567",
    "network": "mtn",
    "size_gb": 5,
    "size_gb_text": null,
    "amount": 19.45,
    "refunded": false,
    "order_created_at": "2026-11-10T10:19:49.386Z",
    "updated_at": "2026-11-10T10:21:02.000Z"
  }
}`;

const NODE_CODE = `const crypto = require("crypto");
app.post("/webhooks/justbuy", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.header("X-Webhook-Timestamp");
  const sig = (req.header("X-Webhook-Signature") || "").replace("sha256=", "");
  const raw = req.body.toString("utf8");
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.status(400).send("stale");
  const expected = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(\`\${ts}.\${raw}\`).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).send("bad signature");
  }
  const event = JSON.parse(raw);
  // TODO: skip if event.id already processed, then update your order using event.data.order_id + event.data.status
  res.sendStatus(200);
});`;

const PHP_CODE = `<?php
$secret = getenv('WEBHOOK_SECRET');
$raw = file_get_contents('php://input');
$ts = $_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'] ?? '';
$sig = str_replace('sha256=', '', $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '');
if (!$ts || abs(time() - (int)$ts) > 300) { http_response_code(400); exit('stale'); }
$expected = hash_hmac('sha256', $ts . '.' . $raw, $secret);
if (!hash_equals($expected, $sig)) { http_response_code(401); exit('bad signature'); }
$event = json_decode($raw, true);
// TODO: skip if $event['id'] already processed, then update order $event['data']['order_id'] to $event['data']['status']
http_response_code(200); echo 'ok';`;

const PYTHON_CODE = `import hmac, hashlib, os, time
from flask import request, abort
@app.post("/webhooks/justbuy")
def justbuy_webhook():
    raw = request.get_data()
    ts = request.headers.get("X-Webhook-Timestamp", "")
    sig = request.headers.get("X-Webhook-Signature", "").replace("sha256=", "")
    if not ts or abs(time.time() - int(ts)) > 300: abort(400)
    expected = hmac.new(os.environ["WEBHOOK_SECRET"].encode(), f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig): abort(401)
    event = request.get_json()
    # skip duplicates by event["id"], then update your order
    return "ok", 200`;

const CURL_CODE = `curl -X POST ${BASE_URL}/api-webhook-settings \\
  -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"action":"set","url":"https://yourdomain.com/webhooks/justbuy"}'

curl -X POST ${BASE_URL}/api-webhook-settings \\
  -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"action":"test"}'`;

const HEADERS: Array<[string, string]> = [
  ["X-Webhook-Event", "order.status_changed"],
  ["X-Webhook-Id", "Unique event id, e.g. evt_271ce71ad8904bd193a08e904b88988b. It stays the same on retries, so use it to ignore duplicates."],
  ["X-Webhook-Timestamp", "Unix time in seconds"],
  ["X-Webhook-Signature", "sha256=<hex>"],
  ["User-Agent", "JustBuy-Webhooks/1.0"],
];

const STATUSES = ["processing", "waiting", "delivered", "refunded", "cancelled", "failed"];

const ACTIONS: Array<[string, string, string]> = [
  ["get", "-", "Read your webhook settings (secret is masked)"],
  ["set", "url, enabled", "Save your URL. The full secret is returned the first time only"],
  ["enable / disable", "-", "Turn deliveries on or off"],
  ["test", "-", "Send a signed webhook.test event now (once every 10 seconds)"],
  ["reveal_secret", "-", "Return the full signing secret"],
  ["rotate_secret", "-", "Create a new secret. The old one stops working immediately"],
  ["delete", "-", "Remove your webhook"],
  ["deliveries", "limit, status, order_id", "List recent deliveries (status: pending, sending, delivered, failed)"],
  ["redeliver", "delivery_id", "Queue a failed or delivered event to be sent again"],
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
            Instead of polling <Mono>track-order</Mono>, give us a URL and we POST to it every time one of your API orders changes
            status (for example processing, waiting, delivered, or refunded).
          </p>
          <p>
            We recommend using webhooks and keeping <Mono>track-order</Mono> as a backup to double-check an order.
          </p>
        </CardContent>
      </Card>

      <WebhookSettings hasApiKey={hasApiKey} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open Webhook Settings above and enter an https URL.</li>
            <li>Copy the signing secret. It is shown once, so save it in your server settings.</li>
            <li>Click &quot;Send test event&quot;.</li>
            <li>Verify signatures on your server (see below).</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Events and statuses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <Mono>order.status_changed</Mono> is sent whenever an order status changes. <Mono>webhook.test</Mono> is sent by the
            &quot;Send test event&quot; button.
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
            <Mono>data.order_id</Mono> is the same <Mono>order_id</Mono> returned by the purchase endpoint.
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-lg">Verifying the signature (important)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The signature is the HMAC-SHA256 of the string <Mono>{"{X-Webhook-Timestamp}.{raw request body}"}</Mono> using your
            signing secret, hex-encoded, and compared to the part after <Mono>sha256=</Mono>.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use the RAW request body, not re-serialized JSON.</li>
            <li>Reject the request if the timestamp is more than 5 minutes old.</li>
            <li>Use a constant-time compare.</li>
          </ul>
          <Tabs defaultValue="node">
            <TabsList>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="php">PHP</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="node">
              <CodeBlock code={NODE_CODE} />
            </TabsContent>
            <TabsContent value="php">
              <CodeBlock code={PHP_CODE} />
            </TabsContent>
            <TabsContent value="python">
              <CodeBlock code={PYTHON_CODE} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Responding and retries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Return any 2xx within 10 seconds and do slow work after replying. Redirects are NOT followed.
          </p>
          <p>
            If we do not get a 2xx we retry after 1 min, 5 min, 30 min, 2 h, 6 h and 12 h (7 tries in total, about 21 hours).
          </p>
          <p>
            Events can arrive more than once or out of order. Use <Mono>X-Webhook-Id</Mono> to skip duplicates and trust the latest{" "}
            <Mono>updated_at</Mono>.
          </p>
          <p>
            After 25 events in a row fail every retry, the webhook is automatically disabled. Fix your server and re-enable it in
            Webhook Settings. You can resend any event from &quot;Recent deliveries&quot;.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URL rules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>https only.</li>
            <li>Must be a public domain name (no IP addresses, localhost, or private networks).</li>
            <li>Port 443 or 8443.</li>
            <li>Maximum 500 characters.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="rounded bg-blue-500/20 px-2 py-1 font-mono text-xs text-blue-400">POST</span>
            <span>/api-webhook-settings</span>
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your webhook from your own server with <Mono>Authorization: Bearer YOUR_API_KEY</Mono>. Every response is JSON:{" "}
            <Mono>{"{ success, message?, error?, data? }"}</Mono>.
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

      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm">
        <strong>Tip:</strong> use webhooks for instant updates; use <span className="font-mono">track-order</span> to double-check an
        order or if your webhook was down.
      </div>
    </section>
  );
}
