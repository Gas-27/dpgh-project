"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Mode = "instant" | "services";
type InstantProduct = "data" | "airtime";
type ServiceCategory = "electricity" | "water" | "tv";

const networks = [
  { value: "MTN", label: "MTN", tone: "bg-yellow-400 text-slate-950" },
  { value: "TELECEL", label: "Telecel", tone: "bg-red-600 text-white" },
  { value: "AIRTELTIGO", label: "AirtelTigo", tone: "bg-blue-700 text-white" },
];

const bundles = ["1GB", "2GB", "3GB", "5GB", "10GB", "15GB", "20GB", "30GB"];
const services = {
  electricity: ["ECG Prepaid", "ECG Postpaid", "NEDCo"],
  water: ["Ghana Water Company"],
  tv: ["DStv", "GOtv", "StarTimes", "KweseTV", "GBC TV"],
};

export default function KorbaPurchasePanel({ mode, orderId }: { mode: Mode; orderId?: string }) {
  const { toast } = useToast();
  const [instantProduct, setInstantProduct] = useState<InstantProduct>("data");
  const [network, setNetwork] = useState("MTN");
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>("electricity");
  const [service, setService] = useState("ECG Prepaid");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

  function chooseServiceCategory(category: ServiceCategory) {
    setServiceCategory(category);
    setService(services[category][0]);
  }

  async function submit() {
    const customer = mode === "instant" ? phone : account;
    if (!amount || Number(amount) <= 0 || !customer) {
      toast({ title: "Complete the form", description: "Enter an amount and recipient number.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("korba-gateway", {
      body: {
        operation: "collect",
        amount: Number(amount),
        customer_number: customer,
        network_code: mode === "instant" ? network : service,
        description: mode === "instant" ? `${instantProduct === "airtime" ? "Airtime" : "Data"} purchase` : `${service} bill payment`,
        order_id: orderId,
      },
    });
    setBusy(false);
    if (error || data?.error || data?.success === false) {
      toast({ title: "Purchase could not start", description: data?.user_message || error?.message || "Please try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Purchase started", description: `Transaction ${data?.transaction_id || "received"} is processing.` });
    setAmount("");
  }

  if (mode === "instant") {
    return (
      <Card className="mx-auto w-full max-w-4xl overflow-hidden border-primary/25 shadow-sm">
        <CardHeader>
          <CardTitle>Airtime & Instant Data</CardTitle>
          <CardDescription>Choose a product, network, and bundle to continue.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Instant purchase type">
            {([['data', 'Normal Data'], ['airtime', 'Airtime']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={instantProduct === value} onClick={() => setInstantProduct(value)} className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${instantProduct === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Mobile network">
            {networks.map((item) => (
              <button key={item.value} type="button" onClick={() => setNetwork(item.value)} className={`rounded-xl px-3 py-3 text-sm font-bold ring-offset-background transition ${network === item.value ? `ring-2 ring-primary ring-offset-2 ${item.tone}` : "border bg-card text-foreground"}`}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {bundles.map((bundle, index) => (
              <button key={bundle} type="button" onClick={() => setAmount(String((index + 1) * 2))} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left text-sm transition hover:border-primary hover:bg-muted">
                <span>{bundle} {instantProduct === "airtime" ? "airtime" : "bundle"}</span><span className="font-semibold text-primary">GHS {(index + 1) * 2}.00</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="korba-amount">Amount (GHS)</Label><Input id="korba-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="20.00" /></div>
            <div className="grid gap-2"><Label htmlFor="korba-phone">Phone number</Label><Input id="korba-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0240000000" /></div>
          </div>
          <Button onClick={submit} disabled={busy}>{busy ? "Starting purchase…" : instantProduct === "airtime" ? "Buy airtime" : "Buy data"}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-5xl border-primary/25 shadow-sm">
      <CardHeader className="text-center"><CardTitle className="text-3xl">Pay Bills & Utilities</CardTitle><CardDescription>Top up ECG, settle Ghana Water, or renew TV subscriptions instantly.</CardDescription></CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Service category">
            {([['electricity', 'Electricity'], ['water', 'Water'], ['tv', 'TV']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={serviceCategory === value} onClick={() => chooseServiceCategory(value)} className={`rounded-lg px-3 py-3 text-sm font-semibold transition ${serviceCategory === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{label}</button>
            ))}
          </div>
          <div className="grid gap-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Select provider</p><div className="grid gap-3 sm:grid-cols-3">{services[serviceCategory].map((item) => <button key={item} type="button" onClick={() => setService(item)} className={`rounded-xl border px-3 py-5 text-sm font-semibold transition ${service === item ? "border-primary bg-primary/10 text-primary" : "bg-background hover:border-primary/50"}`}>{item}</button>)}</div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="korba-service-account">Meter / decoder / account number</Label><Input id="korba-service-account" inputMode="numeric" value={account} onChange={(event) => setAccount(event.target.value)} placeholder="Account number" /></div><div className="grid gap-2"><Label htmlFor="korba-service-amount">Amount (GHS)</Label><Input id="korba-service-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="2.00" /></div></div>
          <Button onClick={submit} disabled={busy}>{busy ? "Starting payment…" : "Proceed to payment"}</Button>
        </div>
        <aside className="h-fit rounded-2xl border bg-muted/40 p-5"><p className="text-sm font-bold uppercase tracking-wide">Payment summary</p><dl className="mt-5 grid gap-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Provider</dt><dd className="font-semibold">{service}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Account</dt><dd className="font-semibold">{account || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Top up amount</dt><dd className="font-semibold">GHS {amount || "0.00"}</dd></div></dl></aside>
      </CardContent>
    </Card>
  );
}
