import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE_URL = "https://api.dataplug.store/functions/v1";

const STATUS_ROWS: Array<{ status: string; meaning: string; final: boolean }> = [
  { status: "processing", meaning: "Order placed and your wallet charged; being delivered.", final: false },
  { status: "waiting", meaning: "Queued at the network; delivery will follow.", final: false },
  { status: "unverified", meaning: "Network is confirming delivery.", final: false },
  { status: "delivered", meaning: "Data delivered to the number.", final: true },
  { status: "failed", meaning: "Could not be delivered.", final: true },
  { status: "refunded", meaning: "Amount returned to your API wallet.", final: true },
];

const BALANCE_CURL = `curl -X GET "${BASE_URL}/get-balance" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

const BALANCE_JS = `const res = await fetch("${BASE_URL}/get-balance", {
  headers: { Authorization: "Bearer YOUR_API_KEY" },
});
const data = await res.json();
console.log(data.data.balance);`;

const BALANCE_PHP = `$ch = curl_init("${BASE_URL}/get-balance");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer YOUR_API_KEY"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
echo $response["data"]["balance"];`;

const BALANCE_RESPONSE = `{
  "success": true,
  "data": {
    "balance": 152.5,
    "wallet_balance": 152.5,
    "currency": "GHS",
    "checked_at": "2026-11-14T17:45:00.000Z"
  }
}`;

const BALANCE_FIELDS: Array<{ field: string; type: string; description: string }> = [
  { field: "balance", type: "number", description: "Available API wallet balance in Ghana cedis" },
  { field: "wallet_balance", type: "number", description: "Same value as balance (matches the field name returned by Purchase)" },
  { field: "currency", type: "string", description: 'Always "GHS"' },
  { field: "checked_at", type: "string", description: "ISO timestamp of when the balance was read" },
];

const BALANCE_ERRORS: Array<{ code: string; body: string; meaning: string }> = [
  {
    code: "401",
    body: '{"success": false, "error": "Missing or invalid Authorization header. Use: Bearer YOUR_API_KEY"}',
    meaning: "No key sent",
  },
  { code: "401", body: '{"success": false, "error": "Invalid API key"}', meaning: "Key not recognised" },
  { code: "403", body: '{"success": false, "error": "API key is inactive"}', meaning: "Key is inactive" },
  { code: "405", body: "-", meaning: "Method other than GET/POST" },
  { code: "500", body: '{"success": false, "error": "Internal server error"}', meaning: "Server error" },
];

const PURCHASE_REQUEST = `curl -X POST "${BASE_URL}/purchase" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mtn",
    "size_gb": 1,
    "phone": "0241234567"
  }'`;

const PURCHASE_RESPONSE = `{
  "success": true,
  "message": "Order placed. Track delivery with the order_id.",
  "data": {
    "order_id": "1a84e3a4-b25f-44eb-9579-61a19deccfc1",
    "reference": "1a84e3a4-b25f-44eb-9579-61a19deccfc1",
    "provider_reference": "1070API_1794558324491_krqjmu0540391236",
    "network": "mtn",
    "size_gb": 1,
    "size_gb_text": null,
    "phone": "0241234567",
    "amount": 3.94,
    "wallet_balance": 120.5,
    "status": "processing",
    "payment_status": "paid",
    "is_final": false
  }
}`;

const PURCHASE_ERRORS = `Error 402 - insufficient wallet balance:
{
  "error": "Insufficient wallet balance",
  "wallet_balance": 1.5,
  "required": 7.8,
  "deficit": "6.30"
}

Error 429 - same number and same size ordered within 65 seconds:
{
  "rate_limited": true,
  ...
}`;

const ORDERS_REQUEST = `# Get your latest orders (default limit 50)
curl -X GET "${BASE_URL}/get-orders" \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Filter by status and network, with pagination
curl -X GET "${BASE_URL}/get-orders?status=delivered&network=mtn&limit=10&offset=0" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

const ORDERS_RESPONSE = `{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": "1a84e3a4-b25f-44eb-9579-61a19deccfc1",
        "id": "1a84e3a4-b25f-44eb-9579-61a19deccfc1",
        "phone": "0540391236",
        "customer_number": "0540391236",
        "network": "mtn_express",
        "size_gb": 1,
        "size_gb_text": null,
        "amount": 3.94,
        "status": "delivered",
        "order_status": "delivered",
        "fulfillment_status": "delivered",
        "payment_status": "paid",
        "is_final": true,
        "payment_method": "api_wallet",
        "created_at": "2026-11-13T08:25:24.666+00:00",
        "updated_at": "2026-11-13T09:23:52.436476+00:00"
      }
    ],
    "pagination": { "limit": 50, "offset": 0, "total": 1, "returned": 1 }
  }
}`;

const TRACK_REQUEST = `curl -X GET "${BASE_URL}/track-order?reference=ORDER_ID" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

const TRACK_RESPONSE = `{
  "success": true,
  "data": {
    "order_id": "1a84e3a4-b25f-44eb-9579-61a19deccfc1",
    "reference": "1a84e3a4-b25f-44eb-9579-61a19deccfc1",
    "phone": "0540391236",
    "network": "mtn_express",
    "size_gb": 1,
    "size_gb_text": null,
    "amount": 3.94,
    "status": "delivered",
    "order_status": "delivered",
    "fulfillment_status": "delivered",
    "payment_status": "paid",
    "is_final": true,
    "payment_method": "api_wallet",
    "created_at": "2026-11-13T08:25:24.666+00:00",
    "updated_at": "2026-11-13T09:23:52.436476+00:00"
  }
}`;

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted p-3 font-mono text-xs">
      {children}
    </pre>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-foreground">{children}</span>;
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  const color = method === "GET" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400";
  return <span className={`rounded px-2 py-1 font-mono text-xs ${color}`}>{method}</span>;
}

export default function CheapDataOrderApiDocs() {
  return (
    <>
      <Card id="cd-check-balance" className="scroll-mt-32">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MethodBadge method="GET" />
            <span>/get-balance</span>
          </CardTitle>
          <p className="mt-1 text-sm font-semibold">Check Wallet Balance</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Returns the current balance of your API wallet — the same balance that is charged when you place an order through the
            API. Use it before placing orders to make sure you have enough funds.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Authentication:</p>
            <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
              <li>
                • Send your API key in the header <Mono>Authorization: Bearer YOUR_API_KEY</Mono>. (
                <Mono>x-api-key: YOUR_API_KEY</Mono> is also accepted.)
              </li>
              <li>• Never put the API key in the URL. No request body is needed.</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Example Request (cURL):</p>
            <Code>{BALANCE_CURL}</Code>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">JavaScript:</p>
            <Code>{BALANCE_JS}</Code>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">PHP:</p>
            <Code>{BALANCE_PHP}</Code>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Success Response (200):</p>
            <Code>{BALANCE_RESPONSE}</Code>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Response Fields:</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {BALANCE_FIELDS.map((row) => (
                    <tr key={row.field} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-cyan-400">{row.field}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{row.type}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Errors:</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Response</th>
                    <th className="px-3 py-2">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {BALANCE_ERRORS.map((row) => (
                    <tr key={`${row.code}-${row.meaning}`} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-red-400">{row.code}</td>
                      <td className="break-words px-3 py-2 font-mono text-xs text-muted-foreground">{row.body}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">Tip:</strong> The Purchase response also returns <Mono>wallet_balance</Mono> after
            each order, so you don&apos;t need to call this endpoint after every purchase.
          </div>
        </CardContent>
      </Card>

      <Card id="cd-purchase" className="scroll-mt-32">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MethodBadge method="POST" />
            <span>/purchase</span>
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Purchase a data package using your wallet balance. The order is created with status <Mono>processing</Mono>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Request Body:</p>
            <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
              <li>
                • <Mono>network</Mono> (required) - <Mono>mtn</Mono>, <Mono>mtn_express</Mono>, <Mono>telecel</Mono>,{" "}
                <Mono>airteltigo</Mono>, <Mono>mtn_mashup</Mono>, <Mono>mashup</Mono>
              </li>
              <li>
                • <Mono>size_gb</Mono> (required) - Package size in GB
              </li>
              <li>
                • <Mono>phone</Mono> (required) - Recipient phone number, e.g. 0241234567
              </li>
              <li>
                • <Mono>size_gb_text</Mono> - Required for <Mono>mashup</Mono> and <Mono>mtn_mashup</Mono>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Example Request:</p>
            <Code>{PURCHASE_REQUEST}</Code>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Success Response (200):</p>
            <Code>{PURCHASE_RESPONSE}</Code>
            <p className="mt-2 text-xs text-muted-foreground">
              Save <Mono>order_id</Mono> and use it to track the order. <Mono>provider_reference</Mono> is informational only.
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Errors:</p>
            <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
              <li>• <Mono>400</Mono> - Missing or invalid field</li>
              <li>• <Mono>401</Mono> - Bad API key</li>
              <li>
                • <Mono>402</Mono> - Insufficient wallet balance (includes <Mono>wallet_balance</Mono>, <Mono>required</Mono>,{" "}
                <Mono>deficit</Mono>)
              </li>
              <li>
                • <Mono>403</Mono> - <Mono>NUMBER_BLOCKED</Mono> or inactive key
              </li>
              <li>• <Mono>404</Mono> - Package not found</li>
              <li>
                • <Mono>429</Mono> - Same number and same size ordered within 65 seconds (<Mono>rate_limited: true</Mono>)
              </li>
              <li>• <Mono>500</Mono> - Server error</li>
            </ul>
            <div className="mt-3">
              <Code>{PURCHASE_ERRORS}</Code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="cd-get-orders" className="scroll-mt-32">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MethodBadge method="GET" />
            <span>/get-orders</span>
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Returns the orders placed by the authenticated API user, newest first. API orders are paid from the API wallet.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <Mono>GET /get-api-user-orders</Mono> is an identical alias of this endpoint.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Query Parameters (Optional):</p>
            <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
              <li>• <Mono>limit</Mono> (1-100) - Orders to return (default: 50)</li>
              <li>• <Mono>offset</Mono> - Orders to skip (default: 0)</li>
              <li>
                • <Mono>status</Mono> - One of <Mono>processing</Mono>, <Mono>waiting</Mono>, <Mono>unverified</Mono>,{" "}
                <Mono>delivered</Mono>, <Mono>failed</Mono>, <Mono>refunded</Mono>
              </li>
              <li>• <Mono>network</Mono> - Filter by network</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Example Requests:</p>
            <Code>{ORDERS_REQUEST}</Code>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Success Response (200):</p>
            <Code>{ORDERS_RESPONSE}</Code>
            <p className="mt-2 text-xs text-muted-foreground">
              Each order has <Mono>order_id</Mono> (also <Mono>id</Mono>), <Mono>phone</Mono> (also <Mono>customer_number</Mono>),{" "}
              <Mono>network</Mono>, <Mono>size_gb</Mono>, <Mono>size_gb_text</Mono>, <Mono>amount</Mono>, <Mono>status</Mono>,{" "}
              <Mono>order_status</Mono>, <Mono>fulfillment_status</Mono>, <Mono>payment_status</Mono>, <Mono>is_final</Mono>,{" "}
              <Mono>payment_method</Mono>, <Mono>created_at</Mono> and <Mono>updated_at</Mono>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card id="cd-track-order" className="scroll-mt-32">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MethodBadge method="GET" />
            <span>/track-order?reference=ORDER_ID</span>
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">Get the current status of a specific order.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Required Parameters:</p>
            <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
              <li>
                • <Mono>reference</Mono> (string) - The <Mono>order_id</Mono> from /purchase (recommended). A{" "}
                <Mono>provider_reference</Mono> also works.
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Example Request:</p>
            <Code>{TRACK_REQUEST}</Code>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Success Response (200):</p>
            <Code>{TRACK_RESPONSE}</Code>
          </div>
          <p className="text-sm text-muted-foreground">
            Errors: <Mono>400</Mono> (missing reference), <Mono>401</Mono>, <Mono>403</Mono>, <Mono>404</Mono> (order not found or
            not yours).
          </p>
        </CardContent>
      </Card>

      <Card id="cd-statuses" className="scroll-mt-32">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Order Status
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Every order has a single delivery status in the <Mono>status</Mono> field. Polling (<Mono>/track-order</Mono>,{" "}
            <Mono>/get-orders</Mono>) and the webhook (<Mono>data.status</Mono>) always return the same value.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">status</th>
                  <th className="px-3 py-2">Meaning</th>
                  <th className="px-3 py-2">Final?</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ROWS.map((row) => (
                  <tr key={row.status} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-cyan-400">{row.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.meaning}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.final ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
            <li>
              Treat only <Mono>delivered</Mono>, <Mono>failed</Mono> and <Mono>refunded</Mono> as final (<Mono>is_final: true</Mono>
              ). Keep polling or wait for the webhook until then.
            </li>
            <li>
              <Mono>payment_status</Mono> is <Mono>paid</Mono> (wallet charged when the order was placed) or <Mono>refunded</Mono>.
              It is NOT the delivery status.
            </li>
            <li>
              <Mono>order_status</Mono> and <Mono>fulfillment_status</Mono> still exist for older integrations and are always equal
              to <Mono>status</Mono>. New integrations should read <Mono>status</Mono>.
            </li>
            <li>
              Recommended polling: every 30-60 seconds, and stop when <Mono>is_final</Mono> is true. Prefer the webhook.
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
