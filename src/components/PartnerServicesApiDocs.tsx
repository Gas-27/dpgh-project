import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PartnerServicesDocVariant = "data-airtime" | "utilities";

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

function DataAirtimeDocs() {
  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5">
      <CardHeader>
        <CardTitle>Normal Data and Airtime API</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sell instant MTN, Telecel and AirtelTigo data bundles and airtime from your own website or app. Orders are paid from your API wallet and you earn 1.5% commission on every sale.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <SharedBasics rows={DATA_AIRTIME_RATES} />

        <Section title="2. Get the live catalogue and your wallet balance">
          <p>
            A GET request returns your wallet balance, every active data bundle with its <Mono>product_id</Mono> and price, and the commission rate for every service. Always use the returned <Mono>product_id</Mono> and price; do not hardcode them.
          </p>
          <Code>{`GET ${ENDPOINT}\n\nResponse:\n{\n  "success": true,\n  "wallet_balance": 250.5,\n  "services": [{ "service_type": "data", "commission_rate": 0.015, "commission_percent": 1.5, "requires": ["network", "product_id", "recipient"] }],\n  "data_bundles": [{ "network": "mtn", "name": "MTN 1GB", "product_id": "1GB", "amount": 4.5 }]\n}`}</Code>
        </Section>

        <Section title="3. Buy a data bundle">
          <p>
            <Mono>network</Mono> is <Mono>mtn</Mono>, <Mono>telecel</Mono> or <Mono>airteltigo</Mono>. The price is taken from the catalogue, so any <Mono>amount</Mono> you send for data is ignored. Recipients are Ghana numbers such as <Mono>0241234567</Mono> or <Mono>233241234567</Mono>.
          </p>
          <Code>{`POST ${ENDPOINT}\nidempotency-key: order-10045\n\n{\n  "action": "purchase",\n  "service_type": "data",\n  "network": "mtn",\n  "product_id": "1GB",\n  "recipient": "0241234567"\n}`}</Code>
        </Section>

        <Section title="4. Buy airtime">
          <p>
            Send the amount in GHS (greater than 0, maximum 5,000, up to two decimals).
          </p>
          <Code>{`POST ${ENDPOINT}\nidempotency-key: order-10046\n\n{\n  "action": "purchase",\n  "service_type": "airtime",\n  "network": "telecel",\n  "amount": 10,\n  "recipient": "0201234567"\n}`}</Code>
        </Section>

        <Section title="5. Successful response">
          <Code>{`{\n  "success": true,\n  "purchase": {\n    "id": "0b6f...",\n    "service_type": "data",\n    "network": "mtn",\n    "recipient": "0241234567",\n    "amount": 4.5,\n    "status": "completed",\n    "provider_reference": "KB123456",\n    "commission_rate": 0.015,\n    "commission_amount": 0.0675,\n    "created_at": "2026-10-12T10:00:00Z"\n  },\n  "wallet_balance": 246.0675\n}`}</Code>
        </Section>

        <Section title="6. Integration flow for your website">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Call the catalogue on your server and show bundles with your own resale price.</li>
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

export default function PartnerServicesApiDocs({ variant }: { variant: PartnerServicesDocVariant }) {
  return variant === "data-airtime" ? <DataAirtimeDocs /> : <UtilitiesDocs />;
}
