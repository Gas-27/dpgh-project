import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ENDPOINT = "https://api.dataplug.store/functions/v1/delivery-progress";

const BROWSER_EXAMPLE = `const res = await fetch(
  "${ENDPOINT}?network=mtn&key=YOUR_DPK_KEY"
);
const { data } = await res.json();
console.log(data.message, data.estimatedDelivery.text);`;

const HEADER_EXAMPLE = `curl "${ENDPOINT}?network=mtn" \\
  -H "x-progress-key: dpk_YOUR_KEY"`;

const RESPONSE_EXAMPLE = `{
  "success": true,
  "data": {
    "network": "mtn",
    "label": "Mtn",
    "enabled": true,
    "statusColor": "green",
    "message": "MTN PORTAL IS STABLE DELIVERY IS A NORMAL",
    "estimatedDelivery": {
      "minMinutes": 11,
      "maxMinutes": 34,
      "text": "11 minutes – 34 minutes"
    },
    "lastDelivered": {
      "customerNumber": "054****252",
      "placedAt": "2026-11-12T15:42:39Z",
      "deliveredAt": "2026-11-12T16:16:42Z",
      "placedText": "12 Nov at 03:42 PM",
      "deliveredText": "12 Nov at 04:16 PM",
      "durationMinutes": 34,
      "durationText": "34 minutes"
    },
    "infoMessage": "This is an estimated delivery window, not a guarantee. Track your own order for its actual status.",
    "updatedAt": "2026-11-11T08:23:16Z"
  },
  "meta": { "version": "5" }
}`;

const codeClass =
  "overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-3 font-mono text-xs";

export function DeliveryProgressApiDocs() {
  return (
    <Card id="cd-delivery" className="scroll-mt-32 border-purple-500/30 bg-purple-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-400" />
          Delivery Progress API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Display the same delivery-progress card, status messages, estimates, and latest delivery details on your own website.
        </p>

        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Call this endpoint from the browser with your <span className="font-mono font-semibold">dpk_</span> Delivery Progress Key only.
          Never put your main API key in website code. The main API key is rejected if it is used from browser code or passed in the URL.
        </div>

        <p className="text-sm font-semibold">Endpoint</p>
        <div className="break-all rounded-lg border border-border bg-muted p-3 font-mono text-xs">
          GET {ENDPOINT}?network=mtn&amp;key=YOUR_DPK_KEY
        </div>

        <p className="text-sm font-semibold">Parameters</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-mono">network</span>: one of{" "}
            <span className="font-mono">mtn</span>, <span className="font-mono">mtn_express</span>,{" "}
            <span className="font-mono">telecel</span>, <span className="font-mono">airteltigo</span>
          </li>
          <li>
            <span className="font-mono">key</span>: your Delivery Progress Key (starts with <span className="font-mono">dpk_</span>)
          </li>
        </ul>

        <p className="text-sm font-semibold">Browser example</p>
        <pre className={codeClass}>{BROWSER_EXAMPLE}</pre>

        <p className="text-sm font-semibold">Sending the key as a header</p>
        <p className="text-sm text-muted-foreground">
          The key can also be sent as the header <span className="font-mono">x-progress-key: dpk_...</span>.
        </p>
        <pre className={codeClass}>{HEADER_EXAMPLE}</pre>

        <p className="text-sm font-semibold">Example response</p>
        <pre className={codeClass}>{RESPONSE_EXAMPLE}</pre>

        <p className="text-xs text-muted-foreground">
          The response includes your configured message, provider status, estimated delivery window, last delivered order, timestamps, and delivery duration.
        </p>
      </CardContent>
    </Card>
  );
}
