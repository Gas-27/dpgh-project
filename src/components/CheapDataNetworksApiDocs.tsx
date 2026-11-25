import { Globe, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE_URL = "https://api.dataplug.store/functions/v1";

const NETWORKS: Array<{ code: string; name: string }> = [
  { code: "mtn", name: "MTN Ghana" },
  { code: "mtn_express", name: "MTN Ghana" },
  { code: "telecel", name: "Telecel Ghana" },
  { code: "airteltigo", name: "AirtelTigo Ghana" },
  { code: "mtn_mashup", name: "MTN Mashup" },
  { code: "mashup", name: "Mashup" },
  { code: "mtn_special", name: "MTN Special" },
  { code: "telecel_special", name: "Telecel Special" },
];

const PACKAGES_RESPONSE = `{
  "success": true,
  "count": 14,
  "data": [
    { "network": "mtn", "size_gb": 1, "price": 3.9 },
    { "network": "mtn", "size_gb": 2, "price": 7.8 },
    { "network": "mtn", "size_gb": 3, "price": 11.75 }
  ]
}`;

const SPECIAL_PACKAGES_REQUEST = `# MTN Special packages
curl -X GET "${BASE_URL}/get-packages?network=mtn_special" \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Telecel Special packages
curl -X GET "${BASE_URL}/get-packages?network=telecel_special" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

const SPECIAL_PACKAGES_RESPONSE = `{
  "success": true,
  "count": 2,
  "data": [
    { "network": "telecel_special", "size_gb": 1.5, "size_gb_text": "1.5GB", "price": 8.5 },
    { "network": "telecel_special", "size_gb": 1, "size_gb_text": "1GB + 200MINS", "price": 13 }
  ]
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

export function SupportedNetworksDocs() {
  return (
    <Card id="cd-networks" className="scroll-mt-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-green-400" />
          Supported Networks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            MTN Special &amp; Telecel Special
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <Mono>mtn_special</Mono> and <Mono>telecel_special</Mono> are special bundle networks with their own packages and
            prices, separate from the normal MTN and Telecel bundles. <Mono>mtn_special</Mono> accepts MTN numbers only and{" "}
            <Mono>telecel_special</Mono> accepts Telecel numbers only. Their packages are identified by{" "}
            <Mono>size_gb_text</Mono> (see Get Packages and Purchase below).
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {NETWORKS.map((network) => (
            <div key={network.code} className="rounded-lg border border-border bg-muted p-3">
              <p className="font-mono text-sm font-semibold text-cyan-400">{network.code}</p>
              <p className="text-sm text-muted-foreground">{network.name}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function GetPackagesDocs() {
  return (
    <Card id="cd-get-packages" className="scroll-mt-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="rounded bg-green-500/20 px-2 py-1 font-mono text-xs text-green-400">GET</span>
          <span>/get-packages</span>
        </CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">Retrieve all available data packages with pricing.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold">Query Parameters (Optional):</p>
          <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
            <li>
              • <Mono>network</Mono> - Filter by single network
            </li>
            <li>
              • <Mono>networks[]</Mono> - Filter by multiple networks
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="mb-2 text-xs text-muted-foreground">Example:</p>
          <p className="font-mono text-xs">GET {BASE_URL}/get-packages?network=mtn</p>
        </div>
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="mb-2 text-xs text-muted-foreground">Successful JSON response (200):</p>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">{PACKAGES_RESPONSE}</pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Sample shortened to 3 of 14 packages. Each package has only network, size_gb (GB) and price (GHS, your API price). The
            response does not include validity or availability fields; only active packages are listed. Omit the network parameter
            to get every network. Prices are live and may change, and use size_gb exactly as returned when calling /purchase.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
          <p className="text-sm font-semibold">MTN Special &amp; Telecel Special packages</p>
          <p className="text-sm text-muted-foreground">
            Filter with <Mono>?network=mtn_special</Mono> or <Mono>?network=telecel_special</Mono>. Packages for these networks
            include a <Mono>size_gb_text</Mono> field, which is the package name.
          </p>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Example Request (cURL):</p>
            <Code>{SPECIAL_PACKAGES_REQUEST}</Code>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Successful JSON response (200):</p>
            <Code>{SPECIAL_PACKAGES_RESPONSE}</Code>
          </div>
          <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li>
              Only packages available on the API are listed, and the list can change. Always fetch it instead of hard-coding
              package names or prices.
            </li>
            <li>
              Some packages are minutes bundles (for example <Mono>1GB + 200MINS</Mono>), so use <Mono>size_gb_text</Mono> as the
              package name when you call /purchase.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
