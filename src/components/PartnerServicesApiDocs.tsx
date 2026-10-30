"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { publicSupabase } from "@/integrations/supabase/public-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export type PartnerServicesDocVariant = "data-airtime" | "utilities" | "bulk-sms";

const ENDPOINT = "https://api.dataplug.store/functions/v1/partner-services";

type RateRow = { service: string; type: string; rate: number; example: number };

const DATA_AIRTIME_RATES: RateRow[] = [
  { service: "Data bundles", type: "data", rate: 1.5, example: 100 },
  { service: "Airtime", type: "airtime", rate: 1.5, example: 100 },
];

const UTILITY_RATES: RateRow[] = [
  { service: "GOtv", type: "gotv", rate: 0.25, example: 100 },
  { service: "DSTV", type: "dstv", rate: 0.25, example: 100 },
  { service: "StarTimes", type: "startimes", rate: 0.18, example: 100 },
  { service: "ECG (prepaid electricity)", type: "ecg", rate: 0.6, example: 100 },
  { service: "Ghana Water (GWCL)", type: "water", rate: 0.25, example: 100 },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-3 font-mono text-xs">
      {children}
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-1 space-y-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-foreground">{children}</span>;
}

function CommissionTable({ rows }: { rows: RateRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-2">Service</th>
            <th className="p-2">
              <Mono>service_type</Mono>
            </th>
            <th className="p-2">Commission</th>
            <th className="p-2">On GHS 100</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.type} className="border-t border-border">
              <td className="p-2 font-medium">{row.service}</td>
              <td className="p-2 font-mono">{row.type}</td>
              <td className="p-2">
                <Badge variant="outline">{row.rate}%</Badge>
              </td>
              <td className="p-2">GHS {((row.example * row.rate) / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SharedBasics({ rows }: { rows: RateRow[] }) {
  return (
    <>
      <Section title="Your commission">
        <p>
          Every successful purchase is paid from your API wallet at the normal price, and your commission is credited back to the same wallet automatically once the provider accepts the request.
          Failed purchases are refunded in full and earn no commission.
        </p>
        <CommissionTable rows={rows} />
        <p className="text-xs">
          The commission rate and amount applied to each order are returned in the purchase response as <Mono>commission_rate</Mono> and <Mono>commission_amount</Mono>.
        </p>
      </Section>
      <Section title="1. Endpoint and authentication">
        <p>Send requests from your server only. Never expose your API key in browser code.</p>
        <div className="rounded-lg border border-border bg-muted p-3 font-mono text-xs break-all">{ENDPOINT}</div>
        <Code>{`x-api-key: YOUR_API_KEY        (or Authorization: Bearer YOUR_API_KEY)\nContent-Type: application/json\nidempotency-key: UNIQUE_ORDER_ID   (required on purchase)`}</Code>
      </Section>
    </>
  );
}

function Errors() {
  return (
    <>
      <Section title="Responses and errors">
        <p>
          Responses are JSON with <Mono>success</Mono> true or false. Common HTTP codes: <Mono>400</Mono> invalid fields, <Mono>401</Mono> invalid or inactive API key, <Mono>402</Mono> insufficient API wallet, <Mono>502</Mono> provider failed (wallet refunded), <Mono>500</Mono> unexpected error.
        </p>
      </Section>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <strong>Idempotency:</strong> send a new unique <Mono>idempotency-key</Mono> for every customer order (max 128 characters). If a request times out, retry with the same key. You will get the original purchase back and are never charged twice.
      </div>
    </>
  );
}

type Bundle = {
  network: "mtn" | "telecel" | "airteltigo";
  name: string;
  short_name: string | null;
  product_id: string;
  category: string;
  amount: number;
};

type Network = Bundle["network"];

function NetworkBundleTabs() {
  const [network, setNetwork] = useState<Network>("mtn");
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadBundles() {
      const catalogueClient = publicSupabase as any;
      const { data, error: queryError } = await catalogueClient
        .from("network_bundle_catalog")
        .select("network, name, short_name, product_id, category, amount")
        .eq("active", true)
        .in("network", ["mtn", "telecel", "airteltigo"])
        .order("network")
        .order("category")
        .order("amount");
      if (cancelled) return;
      if (queryError) setError("The live bundle catalogue could not be loaded.");
      else setBundles((data ?? []) as Bundle[]);
      setLoading(false);
    }
    void loadBundles();
    return () => { cancelled = true; };
  }, []);

  const networkBundles = bundles.filter((bundle) => bundle.network === network);
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Normal data networks">
        {(["mtn", "telecel", "airteltigo"] as Network[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={network === item}
            onClick={() => setNetwork(item)}
            className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${network === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            {item === "airteltigo" ? "AirtelTigo" : item === "mtn" ? "MTN" : "Telecel"}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        These are live-catalogue examples for <Mono>{network}</Mono>. Use the GET catalogue request below to receive every active bundle for this network; packages can change without an API version change.
      </p>
      {loading && <p className="text-sm text-muted-foreground">Loading every active {network} bundle…</p>}
      {error && <p className="text-sm text-destructive">{error} Use the live catalogue endpoint below to retrieve the current bundles.</p>}
      {!loading && !error && networkBundles.length === 0 && <p className="text-sm text-muted-foreground">No active bundles are currently listed for this network.</p>}
      {!loading && networkBundles.length > 0 && <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted"><tr><th className="p-2">Name</th><th className="p-2">Short name</th><th className="p-2">Product ID to send</th><th className="p-2">Category</th><th className="p-2">Price (GHS)</th></tr></thead>
          <tbody>{networkBundles.map((bundle) => <tr key={bundle.product_id} className="border-t border-border"><td className="p-2 font-medium">{bundle.name}</td><td className="p-2">{bundle.short_name || "—"}</td><td className="p-2 font-mono text-xs">{bundle.product_id}</td><td className="p-2">{bundle.category}</td><td className="p-2">{bundle.amount.toFixed(2)}</td></tr>)}</tbody>
        </table>
      </div>}
      <p className="text-xs text-muted-foreground">Display <Mono>name</Mono> and <Mono>short_name</Mono> to your customer. Keep <Mono>product_id</Mono> in your server-side order and send it exactly as shown, including spaces, underscores and letter case.</p>
    </div>
  );
}

function DataAirtimeDocs() {
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5">
      <CardHeader>
        <CardTitle>Normal Data and Airtime API</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sell instant MTN, Telecel and AirtelTigo data bundles and airtime from your own website or app. Orders are paid from your API wallet and you earn 1.5% commission on every sale.
        </p>
        <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          This is the same <strong className="text-foreground">instant (normal) data</strong> that is sold on the Instant Data screen of the dashboard, delivered through our Korba connection. It is a separate product from Cheap Data: Cheap Data packages and their order endpoint are documented in the other API tabs and cannot be bought through this endpoint.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <SharedBasics rows={DATA_AIRTIME_RATES} />

        <Collapsible open={catalogueOpen} onOpenChange={setCatalogueOpen}>
          <Section title="2. Choose a network and see its bundle format">
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted p-3 text-left font-medium">
              <span>Open the complete MTN, Telecel and AirtelTigo instant-data catalogue</span>
              <ChevronDown className={`size-4 transition-transform ${catalogueOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 flex flex-col gap-3">
              <p>Each network has its own package names and product IDs. Select a network to see the exact fields your integration should display and send.</p>
              <NetworkBundleTabs />
            </CollapsibleContent>
          </Section>
        </Collapsible>

        <Section title="3. Get the live data catalogue (which package to send)">
          <p>
            Normal data is not ordered by a size name like &quot;1GB&quot;. Every bundle has a <Mono>product_id</Mono> and you must send that exact value. Call the catalogue first, optionally filtered with <Mono>?network=mtn</Mono>, <Mono>?network=telecel</Mono> or <Mono>?network=airteltigo</Mono>. Bundles are grouped by network and then by category (for example MTN Data Bundles, Midnight Bundles, Social Media Bundles; Telecel HOURLY, DAILY, WEEKLY, MONTHLY; AirtelTigo BigTime, Sika Kokoo, Fuse).
          </p>
          <Code>{`GET ${ENDPOINT}?network=mtn\n\nResponse:\n{\n  "success": true,\n  "wallet_balance": 250.5,\n  "airtime_networks": ["mtn", "telecel", "airteltigo"],\n  "data_catalogue": [\n    {\n      "network": "mtn",\n      "categories": [\n        {\n          "category": "Data Bundles",\n          "bundles": [\n            { "name": "GHS 0.5 (20.73 MB)", "short_name": "17.79 MB", "product_id": "RACT_Data_GHC 0.5_Others", "amount": 0.5 }\n          ]\n        },\n        {\n          "category": "Midnight Bundles",\n          "bundles": [\n            { "name": "GHS 3 (8683.07 MB)", "short_name": "8683.07 MB", "product_id": "NACT_Midnight_GHC3_Others", "amount": 3 }\n          ]\n        }\n      ]\n    }\n  ],\n  "data_bundles": [ /* the same bundles as a flat list, each with network and category */ ],\n  "services": [{ "service_type": "data", "commission_rate": 0.015, "commission_percent": 1.5 }]\n}`}</Code>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2">Field</th>
                  <th className="p-2">Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border"><td className="p-2 font-mono">network</td><td className="p-2">The network the bundle belongs to. A <Mono>product_id</Mono> only works with its own network.</td></tr>
                <tr className="border-t border-border"><td className="p-2 font-mono">category</td><td className="p-2">The package family, used to group bundles on your own storefront.</td></tr>
                <tr className="border-t border-border"><td className="p-2 font-mono">name / short_name</td><td className="p-2">The label to show your customer. Display only, never send it when buying.</td></tr>
                <tr className="border-t border-border"><td className="p-2 font-mono">product_id</td><td className="p-2"><strong className="text-foreground">The value you send to buy.</strong> Copy it exactly, including spaces, case and underscores.</td></tr>
                <tr className="border-t border-border"><td className="p-2 font-mono">amount</td><td className="p-2">Price in GHS charged to your API wallet.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs">
            Real identifiers look like <Mono>RACT_Data_GHC 0.5_Others</Mono> (MTN), <Mono>BDLHRBOOST2</Mono> (Telecel 400MB hourly) and <Mono>db_Sika_Kokoo_10</Mono> (AirtelTigo 1.1GB). Bundles can be added or removed at any time, so refresh the catalogue regularly instead of hardcoding IDs.
          </p>
        </Section>

        <Section title="3. Buy a data bundle">
          <p>
            Send <Mono>network</Mono> (<Mono>mtn</Mono>, <Mono>telecel</Mono> or <Mono>airteltigo</Mono>), the bundle <Mono>product_id</Mono> and the <Mono>recipient</Mono> number. The price is always taken from the catalogue, so any <Mono>amount</Mono> you send for data is ignored. Recipients are Ghana numbers such as <Mono>0241234567</Mono> or <Mono>233241234567</Mono>.
          </p>
          <Code>{`POST ${ENDPOINT}\nidempotency-key: order-10045\n\n{\n  "action": "purchase",\n  "service_type": "data",\n  "network": "mtn",\n  "product_id": "RACT_Data_GHC 0.5_Others",\n  "recipient": "0241234567"\n}`}</Code>
          <p className="text-xs">
            If the <Mono>product_id</Mono> does not exist for that network you get a <Mono>400</Mono> before any money is taken, for example when an MTN ID is sent with <Mono>network: &quot;telecel&quot;</Mono>.
          </p>
        </Section>

        <Section title="4. Buy airtime">
          <p>
            Send the amount in GHS (greater than 0, maximum 5,000, up to two decimals).
          </p>
          <Code>{`POST ${ENDPOINT}\nidempotency-key: order-10046\n\n{\n  "action": "purchase",\n  "service_type": "airtime",\n  "network": "telecel",\n  "amount": 10,\n  "recipient": "0201234567"\n}`}</Code>
        </Section>

        <Section title="5. Successful response">
          <Code>{`{\n  "success": true,\n  "purchase": {\n    "id": "0b6f...",\n    "service_type": "data",\n    "network": "mtn",\n    "recipient": "0241234567",\n    "amount": 0.5,\n    "status": "completed",\n    "provider_reference": "KB123456",\n    "commission_rate": 0.015,\n    "commission_amount": 0.0075,\n    "created_at": "2026-10-12T10:00:00Z"\n  },\n  "wallet_balance": 250.0075\n}`}</Code>
        </Section>

        <Section title="6. Integration flow for your website">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Call the catalogue on your server, show each bundle&apos;s <Mono>name</Mono> grouped by <Mono>category</Mono> with your own resale price, and keep its <Mono>product_id</Mono> behind the scenes.</li>
            <li>When a customer pays you, generate a unique order ID and send the purchase request with it as the <Mono>idempotency-key</Mono>.</li>
            <li>Mark the order delivered when <Mono>success</Mono> is true. On any error the API wallet is not charged, or is refunded automatically.</li>
            <li>Top up your API wallet from your dashboard before it runs low.</li>
          </ol>
        </Section>

        <Errors />
      </CardContent>
    </Card>
  );
}

function UtilitiesDocs() {
  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5">
      <CardHeader>
        <CardTitle>Utilities API: ECG, GOtv, DSTV, StarTimes and Ghana Water</CardTitle>
        <p className="text-sm text-muted-foreground">
          Let your customers pay electricity, TV subscriptions and water bills from your own website or app. Payments come from your API wallet and your commission is credited back on every successful bill.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <SharedBasics rows={UTILITY_RATES} />

        <Section title="2. Verify the customer first (lookup)">
          <p>
            Always look the account up before charging so you can show the customer name and confirm the right account. Lookup works for <Mono>ecg</Mono>, <Mono>gotv</Mono>, <Mono>dstv</Mono>, <Mono>startimes</Mono> and <Mono>water</Mono>. It is free and does not touch your wallet.
          </p>
          <Code>{`POST ${ENDPOINT}\n\n{\n  "action": "lookup",\n  "service_type": "gotv",\n  "recipient": "1234567890"\n}\n\nResponse:\n{ "success": true, "service_type": "gotv", "recipient": "1234567890", "customer_name": "KOFI MENSAH", "detail": null }`}</Code>
        </Section>

        <Section title="3. Required fields per service">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2">service_type</th>
                  <th className="p-2">recipient</th>
                  <th className="p-2">Also required</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border"><td className="p-2 font-mono">ecg</td><td className="p-2">Meter number</td><td className="p-2"><Mono>phone_number</Mono> (mobile registered to the meter), <Mono>amount</Mono></td></tr>
                <tr className="border-t border-border"><td className="p-2 font-mono">gotv</td><td className="p-2">Smart card / IUC number</td><td className="p-2"><Mono>amount</Mono></td></tr>
                <tr className="border-t border-border"><td className="p-2 font-mono">dstv</td><td className="p-2">Smart card number</td><td className="p-2"><Mono>amount</Mono></td></tr>
                <tr className="border-t border-border"><td className="p-2 font-mono">startimes</td><td className="p-2">Smart card number</td><td className="p-2"><Mono>amount</Mono></td></tr>
                <tr className="border-t border-border"><td className="p-2 font-mono">water</td><td className="p-2">GWCL account number</td><td className="p-2"><Mono>amount</Mono></td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs">
            <Mono>amount</Mono> is in GHS, greater than 0 and at most 5,000. Accepted aliases: <Mono>electricity</Mono> for ecg, <Mono>gwcl</Mono> and <Mono>ghana_water</Mono> for water, <Mono>startime</Mono> for startimes.
          </p>
        </Section>

        <Section title="4. Pay a bill">
          <Code>{`POST ${ENDPOINT}\nidempotency-key: bill-5521\n\n// ECG prepaid\n{\n  "action": "purchase",\n  "service_type": "ecg",\n  "recipient": "01234567890",\n  "phone_number": "0241234567",\n  "amount": 50\n}\n\n// GOtv, DSTV, StarTimes\n{ "action": "purchase", "service_type": "dstv", "recipient": "7012345678", "amount": 129 }\n\n// Ghana Water\n{ "action": "purchase", "service_type": "water", "recipient": "123456789", "amount": 40 }`}</Code>
        </Section>

        <Section title="5. Successful response">
          <Code>{`{\n  "success": true,\n  "purchase": {\n    "id": "5e1c...",\n    "service_type": "ecg",\n    "recipient": "01234567890",\n    "amount": 50,\n    "status": "completed",\n    "provider_reference": "KB778899",\n    "commission_rate": 0.006,\n    "commission_amount": 0.3,\n    "created_at": "2026-10-12T10:00:00Z"\n  },\n  "wallet_balance": 200.3\n}`}</Code>
        </Section>

        <Section title="6. Integration flow for your website">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Customer picks a service and enters their meter, smart card or account number.</li>
            <li>Call <Mono>lookup</Mono> from your server and show the returned customer name for confirmation.</li>
            <li>After the customer pays you, call <Mono>purchase</Mono> with a unique <Mono>idempotency-key</Mono>.</li>
            <li>Show the <Mono>provider_reference</Mono> as the receipt. If the provider fails, the API wallet is refunded automatically and a 502 is returned.</li>
          </ol>
        </Section>

        <Errors />
      </CardContent>
    </Card>
  );
}

const SMS_ENDPOINT = "https://api.dataplug.store/functions/v1/sms-api";

function useSmsApiPricing() {
  return useQuery({
    queryKey: ["sms-api-pricing"],
    staleTime: 60_000,
    queryFn: async () => {
      const client = publicSupabase as any;
      const { data, error } = await client.from("app_settings").select("sms_api_recipient_price, sms_api_page_price").eq("id", 1).maybeSingle();
      if (error) throw error;
      return {
        recipient: Number(data?.sms_api_recipient_price) || 0,
        page: Number(data?.sms_api_page_price) || 0,
      };
    },
  });
}

function BulkSmsPricing() {
  const { data, isLoading, isError } = useSmsApiPricing();
  const recipient = data?.recipient ?? 0;
  const page = data?.page ?? 0;
  const example = recipient * 100 + page * 1;
  return (
    <Section title="Pricing">
      <p>
        Prices are set by JUSTBUY and charged from your API wallet for every message you send. One page is 160 characters. Longer messages use more pages.
      </p>
      {isLoading && <p className="text-xs">Loading current prices...</p>}
      {isError && <p className="text-xs text-destructive">The live prices could not be loaded. Call the info endpoint below to read them.</p>}
      {data && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2">Charge</th>
                <th className="p-2">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="p-2 font-medium">Per recipient</td>
                <td className="p-2 font-mono">GHS {recipient.toFixed(2)}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2 font-medium">Per page (160 characters)</td>
                <td className="p-2 font-mono">GHS {page.toFixed(2)}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2 font-medium">Example: 100 recipients, 1 page</td>
                <td className="p-2 font-mono">GHS {example.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs">
        Total charge = <Mono>(price per recipient x recipients) + (price per page x pages)</Mono>. Messages that the provider rejects are refunded to your API wallet automatically.
      </p>
    </Section>
  );
}

function BulkSmsDocs() {
  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5">
      <CardHeader>
        <CardTitle>Bulk SMS API</CardTitle>
        <p className="text-sm text-muted-foreground">
          Send SMS from your own website or app, submit sender IDs for approval and check delivery. Every send is paid from your API wallet, for both User and Agent API keys.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <BulkSmsPricing />

        <Section title="1. Endpoint and authentication">
          <p>Call this API from your server only. Never place your API key in browser or mobile app code.</p>
          <div className="rounded-lg border border-border bg-muted p-3 font-mono text-xs break-all">{SMS_ENDPOINT}</div>
          <Code>{`x-api-key: YOUR_API_KEY        (or Authorization: Bearer YOUR_API_KEY)\nContent-Type: application/json\nidempotency-key: UNIQUE_MESSAGE_ID   (required when sending)`}</Code>
        </Section>

        <Section title="2. Submit a sender ID for approval">
          <p>
            A sender ID is the name recipients see (3 to 11 letters, numbers or spaces, not only digits). Submit it from your site, then wait for approval. It shows up in the JUSTBUY admin SMS section where it is reviewed. You can only send with approved sender IDs.
          </p>
          <Code>{`POST ${SMS_ENDPOINT}\n{\n  "action": "submit_sender",\n  "sender_id": "MYSHOP",\n  "phone_number": "0241234567"   // optional contact number\n}`}</Code>
          <Code>{`201 { "success": true, "sender": { "id": "...", "sender_id": "MYSHOP", "status": "pending" } }\n409 { "success": false, "error": "This sender ID already exists and must be unique" }`}</Code>
        </Section>

        <Section title="3. Check balance, prices and approved sender IDs">
          <Code>{`GET ${SMS_ENDPOINT}\n\n200 {\n  "success": true,\n  "pricing": { "currency": "GHS", "per_recipient": 0.0, "per_page": 0.0, "characters_per_page": 160 },\n  "balance": 25.5,\n  "sender_ids": [ { "sender_id": "MYSHOP", "status": "approved" } ]\n}`}</Code>
          <p>
            The <Mono>official_sender_ids</Mono> list contains every currently approved global/official sender ID that any API client may use. Use those values directly in your site. You can also post <Mono>{`{ "action": "senders" }`}</Mono> to return both official and account-specific approved sender IDs, or <Mono>{`{ "action": "balance" }`}</Mono> for your API wallet balance.
          </p>
        </Section>

        <Section title="4. Send bulk SMS">
          <p>
            Send up to 1000 Ghana numbers per request. Numbers can be written as <Mono>0241234567</Mono> or <Mono>233241234567</Mono>, and duplicates are removed automatically.
          </p>
          <Code>{`POST ${SMS_ENDPOINT}\nidempotency-key: order-10045\n{\n  "action": "send",\n  "sender_id": "MYSHOP",\n  "recipients": ["0241234567", "0551234567"],\n  "message": "Your order has been shipped."\n}`}</Code>
          <Code>{`200 {\n  "success": true,\n  "id": "MESSAGE_RECORD_ID",\n  "status": "sent",             // sent | partial\n  "sent": 2,\n  "failed": [],\n  "pages": 1,\n  "charge": 0.0,\n  "refunded": 0,\n  "balance": 24.5,\n  "message_ids": [ { "to": "0241234567", "message_id": "..." } ]\n}`}</Code>
        </Section>

        <Section title="5. Check a message">
          <Code>{`POST ${SMS_ENDPOINT}\n{ "action": "status", "id": "MESSAGE_RECORD_ID" }`}</Code>
        </Section>

        <Section title="6. Integration example (Node.js)">
          <Code>{`const response = await fetch("${SMS_ENDPOINT}", {\n  method: "POST",\n  headers: {\n    "x-api-key": process.env.JUSTBUY_API_KEY,\n    "Content-Type": "application/json",\n    "idempotency-key": crypto.randomUUID(),\n  },\n  body: JSON.stringify({\n    action: "send",\n    sender_id: "MYSHOP",\n    recipients: ["0241234567"],\n    message: "Hello from MYSHOP",\n  }),\n});\nconst result = await response.json();\nif (!result.success) console.error(result.error);`}</Code>
          <Code>{`curl -X POST "${SMS_ENDPOINT}" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -H "idempotency-key: order-10045" \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"send","sender_id":"MYSHOP","recipients":["0241234567"],"message":"Hello"}'`}</Code>
        </Section>

        <Section title="Responses and errors">
          <p>
            Responses are JSON with <Mono>success</Mono> true or false. <Mono>400</Mono> invalid fields, <Mono>401</Mono> invalid or inactive API key, <Mono>402</Mono> insufficient API wallet (the response includes <Mono>required</Mono> and <Mono>balance</Mono>), <Mono>403</Mono> sender ID not approved or locked, <Mono>409</Mono> sender ID already exists, <Mono>502</Mono> every message failed (wallet refunded), <Mono>503</Mono> SMS pricing or provider not configured.
          </p>
        </Section>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <strong>Idempotency:</strong> send a new unique <Mono>idempotency-key</Mono> for every send (max 128 characters). If a request times out, retry with the same key. You will get the original result back and are never charged twice.
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerServicesApiDocs({ variant }: { variant: PartnerServicesDocVariant }) {
  if (variant === "bulk-sms") return <BulkSmsDocs />;
  return variant === "data-airtime" ? <DataAirtimeDocs /> : <UtilitiesDocs />;
}
