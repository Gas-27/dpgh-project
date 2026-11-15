import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  formatMoney,
  num,
  profitRpc,
  profitRpcOrThrow,
  type ProfitBoostService,
  type ProfitCosts,
  type ProfitDataPackage,
} from "@/lib/adminProfit";

const ALL_PROVIDERS = "*";

const toText = (value: number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

const costKey = (packageId: string, provider: string) => `${packageId}|${provider}`;

function providersFor(pkg: ProfitDataPackage): string[] {
  return (pkg.providers_used ?? []).filter((provider) => provider && provider !== ALL_PROVIDERS);
}

type ParsedValue = { ok: true; value: number | null } | { ok: false };

function parseCost(text: string, allowEmpty: boolean): ParsedValue {
  const trimmed = text.trim();
  if (trimmed === "") return allowEmpty ? { ok: true, value: null } : { ok: false };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  return { ok: true, value };
}

type Section = "settings" | "data" | "boost";

export default function AdminProfitCosts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingEdits, setSettingEdits] = useState<Record<string, string>>({});
  const [dataEdits, setDataEdits] = useState<Record<string, string>>({});
  const [boostEdits, setBoostEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Section | "all" | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-profit-costs"],
    queryFn: () => profitRpcOrThrow<ProfitCosts>("admin_profit_costs"),
  });

  const initial = useMemo(() => {
    const settings: Record<string, string> = {};
    const dataCosts: Record<string, string> = {};
    const boost: Record<string, string> = {};
    for (const setting of data?.settings ?? []) settings[setting.key] = toText(setting.value);
    for (const pkg of data?.data_packages ?? []) {
      dataCosts[costKey(pkg.package_id, ALL_PROVIDERS)] = toText(pkg.costs?.[ALL_PROVIDERS]);
      for (const provider of providersFor(pkg)) {
        dataCosts[costKey(pkg.package_id, provider)] = toText(pkg.costs?.[provider]);
      }
    }
    for (const service of data?.boost_services ?? []) boost[String(service.service_id)] = toText(service.cost_override);
    return { settings, dataCosts, boost };
  }, [data]);

  useEffect(() => {
    setSettingEdits(initial.settings);
    setDataEdits(initial.dataCosts);
    setBoostEdits(initial.boost);
  }, [initial]);

  const changedSettings = Object.keys(settingEdits).filter((key) => settingEdits[key] !== initial.settings[key]);
  const changedData = Object.keys(dataEdits).filter((key) => dataEdits[key] !== initial.dataCosts[key]);
  const changedBoost = Object.keys(boostEdits).filter((key) => boostEdits[key] !== initial.boost[key]);

  const runSave = async (sections: Section[]) => {
    const jobs: { label: string; run: () => Promise<{ error: { message: string } | null }> }[] = [];
    const invalid: string[] = [];

    if (sections.includes("settings")) {
      for (const key of changedSettings) {
        const parsed = parseCost(settingEdits[key] ?? "", false);
        const label = data?.settings.find((setting) => setting.key === key)?.label ?? key;
        if (!parsed.ok || parsed.value === null) {
          invalid.push(label);
          continue;
        }
        const value = parsed.value;
        jobs.push({ label, run: () => profitRpc("admin_set_profit_setting", { p_key: key, p_value: value }) });
      }
    }

    if (sections.includes("data")) {
      for (const key of changedData) {
        const [packageId, provider] = key.split("|");
        const parsed = parseCost(dataEdits[key] ?? "", true);
        const pkg = data?.data_packages.find((item) => item.package_id === packageId);
        const label = `${pkg?.network ?? ""} ${pkg?.size_gb_text ?? pkg?.size_gb ?? ""} (${provider === ALL_PROVIDERS ? "all providers" : provider})`;
        if (!parsed.ok) {
          invalid.push(label);
          continue;
        }
        const value = parsed.value;
        jobs.push({
          label,
          run: () => profitRpc("admin_set_data_cost", { p_package_id: packageId, p_provider: provider, p_cost: value }),
        });
      }
    }

    if (sections.includes("boost")) {
      for (const key of changedBoost) {
        const parsed = parseCost(boostEdits[key] ?? "", true);
        const service = data?.boost_services.find((item) => String(item.service_id) === key);
        const label = service?.name ?? key;
        if (!parsed.ok) {
          invalid.push(label);
          continue;
        }
        const value = parsed.value;
        const serviceId = service?.service_id ?? key;
        jobs.push({
          label,
          run: () => profitRpc("admin_set_boost_cost", { p_service_id: serviceId, p_cost_per_1000: value }),
        });
      }
    }

    if (invalid.length > 0) {
      toast({
        title: "Check these values",
        description: `Enter a number of 0 or more for: ${invalid.slice(0, 5).join(", ")}${invalid.length > 5 ? "..." : ""}`,
        variant: "destructive",
      });
      return;
    }
    if (jobs.length === 0) {
      toast({ title: "Nothing to save", description: "You have not changed any values." });
      return;
    }

    const results = await Promise.all(jobs.map(async (job) => ({ label: job.label, result: await job.run() })));
    const failures = results.filter((entry) => entry.result.error);
    const saved = results.length - failures.length;

    if (failures.length > 0) {
      toast({
        title: `Could not save ${failures.length} value${failures.length === 1 ? "" : "s"}`,
        description: `${failures[0].label}: ${failures[0].result.error?.message}`,
        variant: "destructive",
      });
    }
    if (saved > 0) {
      toast({ title: "Saved", description: `${saved} value${saved === 1 ? "" : "s"} updated.` });
      void queryClient.invalidateQueries({ queryKey: ["admin-profit-report"] });
    }
    await refetch();
  };

  const save = async (section: Section | "all") => {
    setSaving(section);
    try {
      await runSave(section === "all" ? ["settings", "data", "boost"] : [section]);
    } finally {
      setSaving(null);
    }
  };

  const packagesByNetwork = useMemo(() => {
    const groups = new Map<string, ProfitDataPackage[]>();
    for (const pkg of data?.data_packages ?? []) {
      const list = groups.get(pkg.network) ?? [];
      list.push(pkg);
      groups.set(pkg.network, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([network, list]) => [network, [...list].sort((a, b) => num(a.size_gb) - num(b.size_gb))] as const);
  }, [data]);

  const baseCost = (pkg: ProfitDataPackage): number | null => {
    const all = parseCost(dataEdits[costKey(pkg.package_id, ALL_PROVIDERS)] ?? "", true);
    if (all.ok && all.value !== null) return all.value;
    const specific = providersFor(pkg)
      .map((provider) => parseCost(dataEdits[costKey(pkg.package_id, provider)] ?? "", true))
      .flatMap((parsed) => (parsed.ok && parsed.value !== null ? [parsed.value] : []));
    return specific.length > 0 ? Math.max(...specific) : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading cost prices...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p>Could not load cost prices: {(error as Error | null)?.message ?? "No data returned."}</p>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const totalChanged = changedSettings.length + changedData.length + changedBoost.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Enter what your providers charge you. Profit is your selling price minus these costs.
        </p>
        <Button onClick={() => void save("all")} disabled={saving !== null || totalChanged === 0}>
          {saving === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save all{totalChanged > 0 ? ` (${totalChanged})` : ""}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">General settings</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void save("settings")}
            disabled={saving !== null || changedSettings.length === 0}
          >
            {saving === "settings" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save settings
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.settings.map((setting) => (
              <div key={setting.key} className="space-y-1">
                <Label htmlFor={`setting-${setting.key}`} className="text-sm">
                  {setting.label}
                </Label>
                <Input
                  id={`setting-${setting.key}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={settingEdits[setting.key] ?? ""}
                  onChange={(e) => setSettingEdits((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Data provider prices</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void save("data")}
            disabled={saving !== null || changedData.length === 0}
          >
            {saving === "data" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save data costs{changedData.length > 0 ? ` (${changedData.length})` : ""}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {packagesByNetwork.length === 0 && <p className="text-sm text-muted-foreground">No data packages found.</p>}
          {packagesByNetwork.map(([network, packages]) => (
            <div key={network} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide">{network}</h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">My price</TableHead>
                      <TableHead className="text-right">Agent price</TableHead>
                      <TableHead className="text-right">API price</TableHead>
                      <TableHead>Provider cost (all providers)</TableHead>
                      <TableHead>Per provider</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((pkg) => {
                      const cost = baseCost(pkg);
                      const margin = cost === null || pkg.agent_price === null ? null : num(pkg.agent_price) - cost;
                      const allKey = costKey(pkg.package_id, ALL_PROVIDERS);
                      return (
                        <TableRow key={pkg.package_id} className={pkg.active ? "" : "opacity-60"}>
                          <TableCell className="whitespace-nowrap font-medium">
                            {pkg.size_gb_text ?? `${num(pkg.size_gb)}GB`}
                            {!pkg.active && <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {pkg.price === null ? "-" : formatMoney(pkg.price)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {pkg.agent_price === null ? "-" : formatMoney(pkg.agent_price)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {pkg.api_price === null ? "-" : formatMoney(pkg.api_price)}
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label={`${network} ${pkg.size_gb_text ?? pkg.size_gb} provider cost for all providers`}
                              className="w-28"
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={dataEdits[allKey] ?? ""}
                              onChange={(e) => setDataEdits((prev) => ({ ...prev, [allKey]: e.target.value }))}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              {providersFor(pkg).length === 0 && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                              {providersFor(pkg).map((provider) => {
                                const key = costKey(pkg.package_id, provider);
                                return (
                                  <div key={provider} className="flex items-center gap-2">
                                    <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
                                      {provider} cost
                                    </span>
                                    <Input
                                      aria-label={`${network} ${pkg.size_gb_text ?? pkg.size_gb} ${provider} cost`}
                                      className="w-24"
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      step="any"
                                      value={dataEdits[key] ?? ""}
                                      onChange={(e) => setDataEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell
                            className={`whitespace-nowrap text-right font-medium ${
                              margin !== null && margin < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {margin === null ? "-" : formatMoney(margin)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Social Boost costs</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void save("boost")}
            disabled={saving !== null || changedBoost.length === 0}
          >
            {saving === "boost" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save boost costs{changedBoost.length > 0 ? ` (${changedBoost.length})` : ""}
          </Button>
        </CardHeader>
        <CardContent>
          {data.boost_services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Social Boost services found.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Provider rate</TableHead>
                    <TableHead className="text-right">Price per 1000</TableHead>
                    <TableHead>My cost per 1000 (override)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.boost_services.map((service: ProfitBoostService) => {
                    const id = String(service.service_id);
                    return (
                      <TableRow key={id}>
                        <TableCell className="min-w-40 font-medium">{service.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{service.provider ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {service.provider_rate === null ? "-" : num(service.provider_rate)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {service.price_per_1000 === null ? "-" : formatMoney(service.price_per_1000)}
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`${service.name} cost per 1000`}
                            className="w-28"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            placeholder="Auto"
                            value={boostEdits[id] ?? ""}
                            onChange={(e) => setBoostEdits((prev) => ({ ...prev, [id]: e.target.value }))}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
