"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Mode = "instant" | "services";

const networks = [
  { value: "MTN", label: "MTN" },
  { value: "TELECEL", label: "Telecel" },
  { value: "AIRTELTIGO", label: "AirtelTigo" },
];

const services = [
  { value: "ECG", label: "ECG" },
  { value: "DSTV", label: "DStv" },
  { value: "GOTV", label: "GOtv" },
  { value: "STARTIMES", label: "StarTimes" },
  { value: "GWCL", label: "GWCL" },
  { value: "GBC", label: "GBC TV" },
];

export default function KorbaPurchasePanel({ mode, orderId }: { mode: Mode; orderId?: string }) {
  const { toast } = useToast();
  const [product, setProduct] = useState(mode === "instant" ? "data" : "ECG");
  const [network, setNetwork] = useState("MTN");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

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
        network_code: mode === "instant" ? network : product,
        description: mode === "instant" ? `${product === "airtime" ? "Airtime" : "Data"} purchase` : `${product} bill payment`,
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

  return (
    <Card className="mx-auto w-full max-w-3xl border-primary/25 shadow-sm">
      <CardHeader>
        <CardTitle>{mode === "instant" ? "Airtime & Instant Data" : "Bills & Services"}</CardTitle>
        <CardDescription>{mode === "instant" ? "Buy airtime or normal data bundles instantly." : "Pay ECG, DStv, GOtv, StarTimes, GWCL and more."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`${mode}-product`}>{mode === "instant" ? "What do you need?" : "Service"}</Label>
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger id={`${mode}-product`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(mode === "instant" ? [{ value: "data", label: "Normal Data" }, { value: "airtime", label: "Airtime" }] : services).map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {mode === "instant" ? <div className="grid gap-2"><Label htmlFor="korba-network">Network</Label><Select value={network} onValueChange={setNetwork}><SelectTrigger id="korba-network"><SelectValue /></SelectTrigger><SelectContent>{networks.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div> : null}
        <div className="grid gap-2"><Label htmlFor={`${mode}-amount`}>Amount (GHS)</Label><Input id={`${mode}-amount`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="20.00" /></div>
        <div className="grid gap-2"><Label htmlFor={`${mode}-recipient`}>{mode === "instant" ? "Phone number" : "Meter / decoder / account number"}</Label><Input id={`${mode}-recipient`} inputMode="numeric" value={mode === "instant" ? phone : account} onChange={(event) => mode === "instant" ? setPhone(event.target.value) : setAccount(event.target.value)} placeholder={mode === "instant" ? "0240000000" : "Account number"} /></div>
        <Button className="sm:col-span-2" onClick={submit} disabled={busy}>{busy ? "Starting purchase…" : mode === "instant" ? "Buy now" : "Pay service"}</Button>
      </CardContent>
    </Card>
  );
}
