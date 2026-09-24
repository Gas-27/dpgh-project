"use client";

import { useEffect, useState } from "react";
import {
  buyHubtelAirtime,
  buyHubtelData,
  payHubtelBill,
  toHubtelBillService,
  toHubtelService,
  verifyHubtelMsisdn,
  getHubtelDataCatalog,
  getHubtelBillCatalog,
  type HubtelService,
} from "@/services/hubtelService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const networkBundles: Record<string, { name: string; price: string }[]> = {
  MTN: [
    ["Midnight 2.01GB", "₵1.00"],
    ["Video 158.05MB", "₵1.00"],
    ["Social Media 82.57MB", "₵1.00"],
    ["Kokrokoo 460.1MB, 5am to 8am", "₵1.22"],
    ["Midnight 4.02GB", "₵2.00"],
    ["Midnight 5.03GB", "₵2.50"],
    ["406.89MB", "₵3.00"],
    ["Midnight 8.48GB", "₵3.00"],
    ["Video 790.25MB", "₵5.00"],
    ["Social Media 412.85MB", "₵5.00"],
    ["837.55MB", "₵10.00"],
    ["Video 1.54GB", "₵10.00"],
    ["Social Media 825.7MB", "₵10.00"],
    ["1.39GB", "₵20.00"],
    ["Social Media 1.61GB", "₵20.00"],
    ["2.78GB", "₵40.00"],
    ["Video 6.17GB", "₵40.00"],
    ["4.17GB", "₵60.00"],
    ["Video 9.26GB", "₵60.00"],
    ["Social Media 4.84GB", "₵60.00"],
    ["5.56GB", "₵80.00"],
    ["9.17GB", "₵100.00"],
    ["Social Media 8.06GB", "₵100.00"],
    ["11.00GB", "₵120.00"],
    ["13.75GB", "₵150.00"],
    ["30.87GB", "₵200.00"],
    ["Video 30.87GB", "₵200.00"],
    ["38.59GB", "₵250.00"],
    ["Video 38.59GB", "₵250.00"],
    ["92.75GB", "₵300.00"],
    ["Video 46.30GB", "₵300.00"],
    ["Social Media 24.19GB", "₵300.00"],
    ["108.21GB", "₵350.00"],
    ["Video 54.02GB", "₵350.00"],
    ["217.34GB", "₵399.00"],
    ["Social Media 32.17GB", "₵399.00"],
    ["Video 77.17GB", "₵500.00"],
  ].map(([name, price]) => ({ name, price })),
  TELECEL: [
    ["No Expiry - 22.29MB", "₵0.50"],
    ["No Expiry - 50.14MB", "₵1.00"],
    ["1 Hour - 440MB", "₵1.00"],
    ["No Expiry - 111.43MB", "₵2.00"],
    ["No Expiry (12am - 5am) - 3.85GB", "₵2.00"],
    ["1 Hour - 1.1GB", "₵2.00"],
    ["No Expiry (12am - 5am) - 9.9GB", "₵3.00"],
    ["1 day - 445.72MB", "₵3.00"],
    ["No Expiry - 557.15MB", "₵5.00"],
    ["3 days - 780MB", "₵5.00"],
    ["No Expiry - 891.44MB", "₵10.00"],
    ["5 days - 1.14GB", "₵10.00"],
    ["15 days - 1GB", "₵10.00"],
    ["5 days - 2.0GB", "₵15.00"],
    ["No Expiry - 1.71GB", "₵20.00"],
    ["30 days - 2.51GB", "₵20.00"],
    ["5 days - 2.62GB", "₵20.00"],
    ["15 days - 5.13GB", "₵43.50"],
    ["No Expiry - 4.56GB", "₵50.00"],
    ["30 days - 6.27GB", "₵50.00"],
    ["No Expiry - 10.27GB", "₵100.00"],
    ["30 days - 13.12GB", "₵100.00"],
    ["No Expiry - 34.2GB", "₵200.00"],
    ["30 days - 39.93GB", "₵200.00"],
    ["No Expiry - 102.7GB", "₵300.00"],
    ["30 days - 114.1GB", "₵300.00"],
    ["No Expiry - 259.3GB", "₵400.00"],
    ["30 days - 269.7GB", "₵400.00"],
  ].map(([name, price]) => ({ name, price })),
  AIRTELTIGO: [
    ["51MB", "₵1.00"],
    ["111MB", "₵2.00"],
    ["26mins 40MB", "₵2.00"],
    ["390MB", "₵3.00"],
    ["Kokoo 446MB (GHS3-1Day(s))", "₵3.00"],
    ["557MB", "₵5.00"],
    ["66mins 120MB", "₵5.00"],
    ["Kokoo 780MB (GHS5-3Day(s))", "₵5.00"],
    ["Kokoo 1GB (GHS6-2Day(s))", "₵6.00"],
    ["891MB", "₵10.00"],
    ["138mins 260MB", "₵10.00"],
    ["Kokoo 1.1GB (GHS10-5Day(s))", "₵10.00"],
    ["Kokoo 1.2GB (GHS11-2Day(s))", "₵11.00"],
    ["210mins 400MB", "₵15.00"],
    ["Kokoo 2GB (GHS15-4Day(s))", "₵15.00"],
    ["1.7GB", "₵20.00"],
    ["280mins 500MB", "₵20.00"],
    ["Kokoo 2.5GB (GHS20-5Day(s))", "₵20.00"],
    ["450mins 1GB", "₵30.00"],
    ["4.5GB", "₵50.00"],
    ["600mins 2.4GB", "₵50.00"],
    ["Kokoo 6.1GB (GHS50-15Day(s))", "₵50.00"],
    ["XXL 12.8GB", "₵99.00"],
    ["10GB", "₵100.00"],
    ["33.4GB", "₵200.00"],
    ["XXL 39GB", "₵200.00"],
    ["100.3GB", "₵300.00"],
    ["117GB", "₵350.00"],
    ["XXL Pack 130.4GB", "₵350.00"],
    ["253.3GB", "₵400.00"],
  ].map(([name, price]) => ({ name, price })),
};
const services = {
  electricity: ["ECG Prepaid", "ECG Postpaid", "NEDCo"],
  water: ["Ghana Water Company"],
  tv: ["DStv", "GOtv", "StarTimes", "KweseTV", "GBC TV"],
};

export default function HubtelPurchasePanel({
  mode,
  orderId,
  walletOnly = false,
  walletBalance = 0,
  ownerType,
  ownerId,
}: {
  mode: Mode;
  orderId?: string;
  walletOnly?: boolean;
  walletBalance?: number;
  ownerType?: string;
  ownerId?: string;
}) {
  const { toast } = useToast();
  const [instantProduct, setInstantProduct] = useState<InstantProduct>("data");
  const [network, setNetwork] = useState("MTN");
  const [serviceCategory, setServiceCategory] =
    useState<ServiceCategory>("electricity");
  const [service, setService] = useState("ECG Prepaid");
  const [amount, setAmount] = useState("");
  const [selectedInstantItem, setSelectedInstantItem] = useState<{
    label: string;
    amount: string;
    value?: string;
  } | null>(null);
  const [liveBundles, setLiveBundles] = useState<
    Record<string, { name: string; price: string; value?: string }[]>
  >({});
  const [customAirtimeAmount, setCustomAirtimeAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifyingName, setVerifyingName] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [billAccountName, setBillAccountName] = useState<string | null>(null);
  const [billAccountDetail, setBillAccountDetail] = useState<string | null>(
    null,
  );
  const [billSessionId, setBillSessionId] = useState<string | null>(null);
  const [billLookupLoading, setBillLookupLoading] = useState(false);

  const normalizedPhone = phone.replace(/\D/g, "");
  const detectedNetwork = normalizedPhone.startsWith("0")
    ? (
        {
          "024": "MTN",
          "025": "MTN",
          "053": "MTN",
          "054": "MTN",
          "055": "MTN",
          "059": "MTN",
          "020": "TELECEL",
          "050": "TELECEL",
          "026": "AIRTELTIGO",
          "027": "AIRTELTIGO",
          "056": "AIRTELTIGO",
          "057": "AIRTELTIGO",
        } as Record<string, string>
      )[normalizedPhone.slice(0, 3)] || null
    : null;

  useEffect(() => {
    let cancelled = false;
    if (
      mode !== "instant" ||
      instantProduct !== "data" ||
      normalizedPhone.length !== 10 ||
      !/^0\d{9}$/.test(normalizedPhone)
    ) {
      return;
    }
    getHubtelDataCatalog({
      service: toHubtelService(network, "data"),
      destination: normalizedPhone,
    })
      .then((response) => {
        const items = Array.isArray((response.data as { Data?: unknown })?.Data)
          ? (
              response.data as {
                Data: Array<{
                  Display?: string;
                  Value?: string;
                  Amount?: number;
                }>;
              }
            ).Data
          : [];
        if (!cancelled && items.length) {
          setLiveBundles((current) => ({
            ...current,
            [network]: items
              .filter(
                (item) => item.Display && Number.isFinite(Number(item.Amount)),
              )
              .map((item) => ({
                name: String(item.Display),
                price: `₵${Number(item.Amount).toFixed(2)}`,
                value: String(item.Value || item.Display),
              })),
          }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, instantProduct, normalizedPhone, network]);

  useEffect(() => {
    let cancelled = false;
    if (
      mode !== "instant" ||
      normalizedPhone.length !== 10 ||
      !/^0\d{9}$/.test(normalizedPhone)
    ) {
      setVerifiedName(null);
      setVerificationError(null);
      return;
    }
    setVerifyingName(true);
    setVerificationError(null);
    verifyHubtelMsisdn(normalizedPhone)
      .then((response) => {
        if (!cancelled)
          setVerifiedName(response.name || response.data?.name || null);
      })
      .catch((error: Error) => {
        if (!cancelled) setVerificationError(error.message);
      })
      .finally(() => {
        if (!cancelled) setVerifyingName(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, normalizedPhone]);

  // ECG (meter/registered mobile) and TV (decoder/smart card) accounts can be
  // verified so the customer sees the registered name before paying. The lookup
  // is informational and never blocks the payment.
  const billService = toHubtelBillService(service);
  const supportsAccountLookup =
    mode !== "instant" &&
    !!billService &&
    ["ecg", "dstv", "gotv", "startimes", "ghana_water"].includes(billService);
  const trimmedAccount = account.trim();

  useEffect(() => {
    let cancelled = false;
    setBillAccountName(null);
    setBillAccountDetail(null);
    setBillSessionId(null);
    if (!supportsAccountLookup || trimmedAccount.replace(/\D/g, "").length < 5) {
      setBillLookupLoading(false);
      return;
    }
    setBillLookupLoading(true);
    const handle = setTimeout(() => {
      getHubtelBillCatalog({
        service: billService as HubtelService,
        accountNumber: trimmedAccount,
      })
        .then((response) => {
          if (cancelled) return;
          const payload = response as {
            name?: string | null;
            bouquet?: string | null;
            sessionId?: string | null;
            accounts?: Array<{ label?: string }>;
          };
          const firstAccount = payload.accounts?.[0]?.label || null;
          setBillAccountName(payload.name || firstAccount || null);
          setBillAccountDetail(payload.bouquet || null);
          setBillSessionId(payload.sessionId || null);
        })
        .catch(() => {
          if (!cancelled) {
            setBillAccountName(null);
            setBillAccountDetail(null);
            setBillSessionId(null);
          }
        })
        .finally(() => {
          if (!cancelled) setBillLookupLoading(false);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, service, trimmedAccount, supportsAccountLookup]);

  function chooseServiceCategory(category: ServiceCategory) {
    setServiceCategory(category);
    setService(services[category][0]);
  }

  async function submit() {
    const customer = mode === "instant" ? phone : account;
    if (
      mode === "instant" &&
      instantProduct === "data" &&
      !selectedInstantItem
    ) {
      toast({
        title: "Choose a bundle first",
        description: "Select a data bundle to continue.",
        variant: "destructive",
      });
      return;
    }
    if (
      mode === "instant" &&
      instantProduct === "airtime" &&
      (!customAirtimeAmount || Number(customAirtimeAmount) <= 0)
    ) {
      toast({
        title: "Enter an airtime amount",
        description: "Enter an amount between GHS 0.01 and GHS 100.00.",
        variant: "destructive",
      });
      return;
    }
    if (mode === "instant" && detectedNetwork && detectedNetwork !== network) {
      toast({
        title: "Network mismatch",
        description: `This number is ${detectedNetwork}. Select ${detectedNetwork} before purchasing.`,
        variant: "destructive",
      });
      return;
    }
    if (mode === "instant" && normalizedPhone.length !== 10) {
      toast({
        title: "Invalid phone number",
        description: "Enter a valid 10-digit Ghana number.",
        variant: "destructive",
      });
      return;
    }
    if (!amount || Number(amount) <= 0 || !customer) {
      toast({
        title: "Complete the form",
        description: "Enter an amount and recipient number.",
        variant: "destructive",
      });
      return;
    }
    let currentWalletBalance = Number(walletBalance);
    if (walletOnly && ownerType === "agent" && ownerId) {
      const { data: freshStore, error: balanceError } = await supabase
        .from("agent_stores")
        .select("wallet_balance")
        .eq("id", ownerId)
        .maybeSingle();
      if (!balanceError && freshStore)
        currentWalletBalance = Number(freshStore.wallet_balance ?? 0);
    }
    if (walletOnly && Number(amount) > currentWalletBalance) {
      toast({
        title: "Insufficient wallet balance",
        description: `Your wallet has GHC ${currentWalletBalance.toFixed(2)} available.`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const wallet = {
        walletOnly,
        walletOwnerType: ownerType,
        walletOwnerId: ownerId,
      };
      let response;
      if (mode === "instant") {
        const service = toHubtelService(network, instantProduct);
        response =
          instantProduct === "data"
            ? await buyHubtelData({
                service,
                destination: customer,
                amount: Number(amount),
                bundle: selectedInstantItem?.value || selectedInstantItem?.label,
                bundleName: selectedInstantItem?.label,
                packageCode: selectedInstantItem?.value || selectedInstantItem?.label,
                ...wallet,
              })
            : await buyHubtelAirtime({
                service,
                destination: customer,
                amount: Number(customAirtimeAmount),
                ...wallet,
              });
      } else {
        const billService = toHubtelBillService(service);
        if (!billService)
          throw new Error(
            "This utility service is not configured for Hubtel yet.",
          );
        response = await payHubtelBill({
          service: billService,
          accountNumber: customer,
          destination: customer,
          amount: Number(amount),
          ...wallet,
        });
      }
      toast({
        title: "Purchase started",
        description: `Transaction ${response.clientReference || "received"} is processing.`,
      });
      setAmount("");
      setCustomAirtimeAmount("");
      setSelectedInstantItem(null);
      setPhone("");
    } catch (error) {
      toast({
        title: "Purchase could not start",
        description:
          error instanceof Error
            ? error.message
            : "Hubtel could not process this request.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (mode === "instant") {
    return (
      <>
        <Card className="storefront-light-form mx-auto w-full max-w-4xl overflow-hidden border-primary/25 shadow-sm">
          <CardHeader>
            <CardTitle>Airtime & Instant Data</CardTitle>
            <CardDescription>
              Choose a product, network, and bundle to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div
              className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1"
              role="tablist"
              aria-label="Instant purchase type"
            >
              {(
                [
                  ["data", "Normal Data"],
                  ["airtime", "Airtime"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={instantProduct === value}
                  onClick={() => setInstantProduct(value)}
                  className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${instantProduct === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className="grid grid-cols-3 gap-2"
              role="tablist"
              aria-label="Mobile network"
            >
              {networks.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setNetwork(item.value)}
                  className={`rounded-xl px-3 py-3 text-sm font-bold ring-offset-background transition ${network === item.value ? `ring-2 ring-primary ring-offset-2 ${item.tone}` : "border bg-card text-foreground"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {instantProduct === "data" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {(liveBundles[network] || networkBundles[network]).map(
                  (bundle) => (
                    <button
                      key={`${network}-${bundle.name}`}
                      type="button"
                      onClick={() => {
                        const selectedAmount = bundle.price.replace(
                          /[^0-9.]/g,
                          "",
                        );
                        setAmount(selectedAmount);
                        setSelectedInstantItem({
                          label: bundle.name,
                          amount: selectedAmount,
                          value: bundle.value || bundle.name,
                        });
                      }}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-muted"
                    >
                      <span className="leading-5">{bundle.name}</span>
                      <span className="shrink-0 font-semibold text-primary">
                        {bundle.price}
                      </span>
                    </button>
                  ),
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="custom-airtime-amount">
                    Exact airtime amount (GHS)
                  </Label>
                  <Input
                    id="custom-airtime-amount"
                    inputMode="decimal"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={customAirtimeAmount}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomAirtimeAmount(value);
                      setAmount(value);
                      setSelectedInstantItem(
                        value
                          ? { label: `GHS ${value} airtime`, amount: value }
                          : null,
                      );
                    }}
                    placeholder="Enter any amount from 0.01 to 100.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hubtel allows airtime top-ups up to GHS 100 per request.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {["1", "2", "5", "10", "20", "50", "100"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setCustomAirtimeAmount(value);
                        setAmount(value);
                        setSelectedInstantItem({
                          label: `GHS ${value} airtime`,
                          amount: value,
                        });
                      }}
                      className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left text-sm transition hover:border-primary hover:bg-muted"
                    >
                      <span>GHS {value} airtime</span>
                      <span className="font-semibold text-primary">
                        GHS {value}.00
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Select a data bundle or airtime amount, then enter the recipient number. The SIM registration lookup runs automatically and is informational only.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Tap a bundle or airtime amount to open the wallet purchase form.
            </p>
          </CardContent>
        </Card>
        <Dialog
          open={selectedInstantItem !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedInstantItem(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {instantProduct === "airtime" ? "Buy airtime" : "Buy data"}
              </DialogTitle>
              <DialogDescription>
                {selectedInstantItem?.label} selected. The amount is fixed from
                your selection.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="rounded-xl border bg-muted/40 px-4 py-3">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold text-primary">
                  GHS {selectedInstantItem?.amount || "0.00"}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hubtel-instant-phone">Phone number</Label>
                <Input
                  id="hubtel-instant-phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0240000000"
                  autoFocus
                />
                {detectedNetwork && (
                  <p className="text-xs text-muted-foreground">
                    Detected network:{" "}
                    <span className="font-semibold text-foreground">
                      {detectedNetwork}
                    </span>
                  </p>
                )}
                {verifyingName && (
                  <p className="text-xs text-muted-foreground">
                      Looking up the SIM registration…
                  </p>
                )}
                {verifiedName && (
                  <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    SIM registered to{" "}
                    <span className="font-semibold">{verifiedName}</span>
                  </p>
                )}
                {verificationError && (
                    <p className="text-xs text-muted-foreground">
                    SIM lookup unavailable. You can still continue with the purchase.
                  </p>
                )}
                {!verifyingName &&
                  !verifiedName &&
                  !verificationError &&
                  normalizedPhone.length === 10 && (
                    <p className="text-xs text-muted-foreground">
                      Hubtel did not return a registered name. You can still
                      continue if the number is correct.
                    </p>
                  )}
              </div>
              {walletOnly && (
                <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  This dashboard purchase uses your wallet only. Available: GHC{" "}
                  {Number(walletBalance).toFixed(2)}.
                </p>
              )}
              <Button onClick={submit} disabled={busy || !phone}>
                {busy
                  ? "Starting purchase…"
                  : instantProduct === "airtime"
                    ? "Buy airtime"
                    : "Buy data"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Card className="storefront-light-form mx-auto w-full max-w-5xl border-primary/25 shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl">Pay Bills & Utilities</CardTitle>
        <CardDescription>
          Top up ECG, settle Ghana Water, or renew TV subscriptions instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-6">
          <div
            className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1"
            role="tablist"
            aria-label="Service category"
          >
            {(
              [
                ["electricity", "Electricity"],
                ["water", "Water"],
                ["tv", "TV"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={serviceCategory === value}
                onClick={() => chooseServiceCategory(value)}
                className={`rounded-lg px-3 py-3 text-sm font-semibold transition ${serviceCategory === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Select provider
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {services[serviceCategory].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setService(item)}
                  className={`rounded-xl border px-3 py-5 text-sm font-semibold transition ${service === item ? "border-primary bg-primary/10 text-primary" : "bg-background hover:border-primary/50"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="hubtel-service-account">
                Meter / decoder / account number
              </Label>
              <Input
                id="hubtel-service-account"
                inputMode="numeric"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="Account number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hubtel-service-amount">Amount (GHS)</Label>
              <Input
                id="hubtel-service-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="2.00"
              />
            </div>
          </div>
          {supportsAccountLookup && billLookupLoading && (
            <p className="text-xs text-muted-foreground">
              Verifying account…
            </p>
          )}
          {supportsAccountLookup && !billLookupLoading && billAccountName && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <p>
                Registered to{" "}
                <span className="font-semibold">{billAccountName}</span>
              </p>
              {billAccountDetail && (
                <p className="mt-1 text-muted-foreground">
                  {billAccountDetail}
                </p>
              )}
            </div>
          )}
          {walletOnly && (
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              This dashboard payment uses your wallet only. Available: GHC{" "}
              {Number(walletBalance).toFixed(2)}.
            </p>
          )}
          <Button
            onClick={submit}
            disabled={
              busy || (walletOnly && Number(amount) > Number(walletBalance))
            }
          >
            {busy ? "Starting payment…" : "Proceed to payment"}
          </Button>
        </div>
        <aside className="h-fit rounded-2xl border bg-muted/40 p-5">
          <p className="text-sm font-bold uppercase tracking-wide">
            Payment summary
          </p>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="font-semibold">{service}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Account</dt>
              <dd className="font-semibold">{account || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Top up amount</dt>
              <dd className="font-semibold">GHS {amount || "0.00"}</dd>
            </div>
          </dl>
        </aside>
      </CardContent>
    </Card>
  );
}
