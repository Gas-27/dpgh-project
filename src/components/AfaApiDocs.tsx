import ApiDocNav from "@/components/ApiDocNav";
import { AFA_NAV } from "@/lib/apiDocNavItems";
import { BookOpen, Key, ShieldAlert, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE_URL = "https://api.dataplug.store/functions/v1";

const fields: Array<{ name: string; required: boolean; description: string }> = [
  { name: "fullName", required: true, description: "Full name of the person being registered." },
  { name: "phoneNumber", required: true, description: "10-digit Ghana number, e.g. 0241234567." },
  { name: "idNumber", required: true, description: "Ghana Card / ID number, e.g. GHA-123456789-0." },
  { name: "dateOfBirth", required: true, description: "Date of birth in YYYY-MM-DD format." },
  { name: "town", required: true, description: "Town or city." },
  { name: "occupation", required: true, description: "Occupation." },
  { name: "region", required: true, description: "Region, e.g. Greater Accra." },
  { name: "cropProduce", required: true, description: "Crop produce." },
  { name: "callbackUrl", required: false, description: "HTTPS URL that receives a status update when the registration changes." },
];

const errors: Array<{ code: string; meaning: string }> = [
  { code: "400", meaning: "A required field is missing or invalid (phone length, date format, etc.)." },
  { code: "401", meaning: "Missing or invalid API key." },
  { code: "402", meaning: "Insufficient API wallet balance for the GHC 9.50 registration fee." },
  { code: "409", meaning: "Duplicate registration, or the wallet update conflicted. Retry once." },
  { code: "500", meaning: "Unexpected server error. The wallet is not charged." },
];

const statuses: Array<{ value: string; meaning: string }> = [
  { value: "pending", meaning: "Registration received and queued for processing." },
  { value: "processing", meaning: "Registration is being submitted to the network." },
  { value: "completed", meaning: "Registration was successful." },
  { value: "failed", meaning: "Registration failed and the API wallet is refunded." },
];

const curlExample = `curl -X POST "${BASE_URL}/afa-api-registration" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "fullName": "John Doe",
    "phoneNumber": "0241234567",
    "idNumber": "GHA-123456789-0",
    "dateOfBirth": "1990-01-15",
    "town": "Accra",
    "occupation": "Teacher",
    "region": "Greater Accra",
    "cropProduce": "Maize",
    "callbackUrl": "https://your-domain.com/webhook/afa"
  }'`;

const nodeExample = `// Run this on your server. Never expose the API key in browser code.
const res = await fetch("${BASE_URL}/afa-api-registration", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.DATAPLUG_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    fullName: "John Doe",
    phoneNumber: "0241234567",
    idNumber: "GHA-123456789-0",
    dateOfBirth: "1990-01-15",
    town: "Accra",
    occupation: "Teacher",
    region: "Greater Accra",
    cropProduce: "Maize",
    callbackUrl: "https://your-domain.com/webhook/afa",
  }),
});
const result = await res.json();
if (!res.ok || !result.success) throw new Error(result.message ?? "AFA registration failed");
console.log(result.data.registration_id, result.data.status);`;

const phpExample = `<?php
$payload = [
  "fullName" => "John Doe",
  "phoneNumber" => "0241234567",
  "idNumber" => "GHA-123456789-0",
  "dateOfBirth" => "1990-01-15",
  "town" => "Accra",
  "occupation" => "Teacher",
  "region" => "Greater Accra",
  "cropProduce" => "Maize",
  "callbackUrl" => "https://your-domain.com/webhook/afa",
];
$ch = curl_init("${BASE_URL}/afa-api-registration");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("DATAPLUG_API_KEY"),
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode($payload),
]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);`;

const pythonExample = `import os, requests

res = requests.post(
    "${BASE_URL}/afa-api-registration",
    headers={"Authorization": f"Bearer {os.environ['DATAPLUG_API_KEY']}"},
    json={
        "fullName": "John Doe",
        "phoneNumber": "0241234567",
        "idNumber": "GHA-123456789-0",
        "dateOfBirth": "1990-01-15",
        "town": "Accra",
        "occupation": "Teacher",
        "region": "Greater Accra",
        "cropProduce": "Maize",
        "callbackUrl": "https://your-domain.com/webhook/afa",
    },
    timeout=30,
)
data = res.json()
res.raise_for_status()`;

const successResponse = `{
  "success": true,
  "message": "AFA registration successful",
  "data": {
    "registration_id": "uuid",
    "fullName": "John Doe",
    "phoneNumber": "0241234567",
    "idNumber": "GHA-123456789-0",
    "status": "completed",
    "amount_paid": 9.50,
    "wallet_balance": 90.50
  }
}`;

const errorResponse = `{
  "success": false,
  "message": "Insufficient API wallet balance"
}`;

const webhookPayload = `{
  "event": "afa.registration.updated",
  "registration_id": "uuid",
  "phoneNumber": "0241234567",
  "status": "completed",
  "updated_at": "2026-07-08T10:05:00.000Z"
}`;

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted p-3 font-mono text-xs">
      {children}
    </pre>
  );
}

export default function AfaApiDocs() {
  return (
    <div className="space-y-6">
      <ApiDocNav items={AFA_NAV} />
      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-violet-500/10">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <BookOpen className="h-8 w-8 flex-shrink-0 text-purple-400" />
            <div>
              <h2 className="font-display text-2xl font-bold">AFA API Documentation</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Register customers for AFA from your own website or application. Each successful registration is charged to your API wallet.
              </p>
              <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
                <p className="break-all font-mono text-sm text-foreground">Base URL: {BASE_URL}</p>
              </div>
              <nav aria-label="On this page" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">On this page:</span>
                <a href="#afa-auth" className="rounded-md border border-border px-2 py-1 hover:bg-muted">Authentication</a>
                <a href="#afa-register" className="rounded-md border border-border px-2 py-1 hover:bg-muted">Register</a>
                <a href="#afa-examples" className="rounded-md border border-border px-2 py-1 hover:bg-muted">Code examples</a>
                <a href="#afa-errors" className="rounded-md border border-border px-2 py-1 hover:bg-muted">Errors</a>
                <a href="#afa-webhooks" className="rounded-md border border-border px-2 py-1 hover:bg-muted">Webhooks</a>
              </nav>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="afa-auth" className="scroll-mt-32">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-cyan-400" />Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Send your API key as a Bearer token. Generate or view it in the API Key tab. Requests must be JSON and sent from your server.
          </p>
          <Code>{`Authorization: Bearer YOUR_API_KEY\nContent-Type: application/json`}</Code>
        </CardContent>
      </Card>

      <Card id="afa-register" className="scroll-mt-32">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="rounded bg-blue-500/20 px-2 py-1 font-mono text-xs text-blue-400">POST</span>
            <span className="font-mono">/afa-api-registration</span>
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">Register a customer for AFA. Cost: GHC 9.50, debited from your API wallet.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold">Request body</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr><th className="px-3 py-2">Field</th><th className="px-3 py-2">Required</th><th className="px-3 py-2">Description</th></tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.name} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{field.name}</td>
                      <td className="px-3 py-2 text-xs">{field.required ? "Yes" : "Optional"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{field.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Success response (200)</p>
            <Code>{successResponse}</Code>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Registration status values</p>
            <div className="space-y-2">
              {statuses.map((status) => (
                <div key={status.value} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                  <span className="rounded bg-muted px-2 py-1 font-mono text-xs">{status.value}</span>
                  <span className="text-sm text-muted-foreground">{status.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="afa-examples" className="scroll-mt-32">
        <CardHeader><CardTitle className="text-lg">Code examples</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><p className="mb-2 text-sm font-semibold">cURL</p><Code>{curlExample}</Code></div>
          <div><p className="mb-2 text-sm font-semibold">Node.js</p><Code>{nodeExample}</Code></div>
          <div><p className="mb-2 text-sm font-semibold">PHP</p><Code>{phpExample}</Code></div>
          <div><p className="mb-2 text-sm font-semibold">Python</p><Code>{pythonExample}</Code></div>
        </CardContent>
      </Card>

      <Card id="afa-errors" className="scroll-mt-32">
        <CardHeader><CardTitle className="text-lg">Errors</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {errors.map((error) => (
              <div key={error.code} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="rounded bg-muted px-2 py-1 font-mono text-xs">{error.code}</span>
                <span className="text-sm text-muted-foreground">{error.meaning}</span>
              </div>
            ))}
          </div>
          <div><p className="mb-2 text-sm font-semibold">Error response</p><Code>{errorResponse}</Code></div>
        </CardContent>
      </Card>

      <Card id="afa-webhooks" className="scroll-mt-32">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Webhook className="h-5 w-5 text-purple-400" />Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            When you pass <span className="font-mono">callbackUrl</span>, we send a POST request with the payload below whenever the registration status changes. Respond with a 2xx status to acknowledge it.
          </p>
          <Code>{webhookPayload}</Code>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        <p>
          <strong>Security:</strong> keep your API key in a server environment variable, validate customer details before sending them, and never call this endpoint from client-side JavaScript.
        </p>
      </div>
    </div>
  );
}
