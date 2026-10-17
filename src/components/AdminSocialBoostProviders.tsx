import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, KeyRound, Plus, Route, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { groupByPlatform } from "@/lib/socialBoostPlatforms";

type Provider = { id: string; label: string; api_url: string; api_key_env: string; enabled: boolean; is_default: boolean; sort_order: number };
type ServiceRow = { service_id: number; service_name: string | null; category: string | null; provider: string | null };
type RouteRow = { service_id: number; provider_id: string; provider_service_id: string };
type RoutingData = { providers: Provider[]; services: ServiceRow[]; routes: RouteRow[] };

const FOLLOW_DEFAULT = "__default__";
const LEGACY_PROVIDER_ID = "exoboost";
const db = supabase as any;

async function fetchRouting(): Promise<RoutingData> {
  const [providers, services, routes] = await Promise.all([
    db.from("social_boost_providers").select("*").order("sort_order"),
    db.from("social_boost_service_pricing").select("service_id,service_name,category,provider").order("service_id"),
    db.from("social_boost_service_routes").select("service_id,provider_id,provider_service_id"),
  ]);
  const failure = providers.error ?? services.error ?? routes.error;
  if (failure) throw new Error(failure.message);
  return { providers: providers.data ?? [], services: services.data ?? [], routes: routes.data ?? [] };
}

export default function AdminSocialBoostProviders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ["social-boost-routing"], queryFn: fetchRouting });
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({ id: "", label: "", api_url: "", api_key_env: "" });

  const providers = data?.providers ?? [];
  const defaultProvider = providers.find((p) => p.is_default);
  const routeKey = (serviceId: number, providerId: string) => `${serviceId}:${providerId}`;
  const mappings = useMemo(() => new Map((data?.routes ?? []).map((r) => [routeKey(r.service_id, r.provider_id), r.provider_service_id])), [data?.routes]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["social-boost-routing"] });

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (data?.services ?? []).filter((s) => !term || `${s.service_name} ${s.category} ${s.service_id}`.toLowerCase().includes(term));
    return groupByPlatform(list, (s) => ({ category: s.category, name: s.service_name }));
  }, [data?.services, search]);

  const run = async (label: string, action: () => Promise<{ error: { message: string } | null }>, success: string) => {
    setBusy(label);
    const { error: failure } = await action();
    setBusy(null);
    if (failure) toast({ title: "Change not saved", description: failure.message, variant: "destructive" });
    else { toast({ title: success }); await refresh(); }
    return !failure;
  };

  const makeDefault = (provider: Provider) => run(`default:${provider.id}`, () => db.rpc("set_default_social_boost_provider", { p_provider_id: provider.id }), `${provider.label} is now the default`);
  const toggleEnabled = (provider: Provider, enabled: boolean) => {
    if (!enabled && provider.is_default) { toast({ title: "Pick another default first", description: "The default provider cannot be turned off.", variant: "destructive" }); return; }
    void run(`enabled:${provider.id}`, () => db.from("social_boost_providers").update({ enabled, updated_at: new Date().toISOString() }).eq("id", provider.id), `${provider.label} ${enabled ? "turned on" : "turned off"}`);
  };
  const pinService = (service: ServiceRow, value: string) => run(`pin:${service.service_id}`, () => db.from("social_boost_service_pricing").update({ provider: value === FOLLOW_DEFAULT ? null : value }).eq("service_id", service.service_id), "Service routing updated");
  const saveMapping = (service: ServiceRow, provider: Provider, raw: string) => {
    const value = raw.trim();
    const current = mappings.get(routeKey(service.service_id, provider.id)) ?? "";
    if (value === current) return;
    if (value && !/^\d+$/.test(value)) { toast({ title: "Provider service ID must be a number", variant: "destructive" }); void refresh(); return; }
    void run(`map:${service.service_id}:${provider.id}`,
      () => value
        ? db.from("social_boost_service_routes").upsert({ service_id: service.service_id, provider_id: provider.id, provider_service_id: value, updated_at: new Date().toISOString() }, { onConflict: "service_id,provider_id" })
        : db.from("social_boost_service_routes").delete().eq("service_id", service.service_id).eq("provider_id", provider.id),
      `${provider.label} service ID saved`);
  };

  const addProvider = async () => {
    const id = draft.id.trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,32}$/.test(id) || !draft.label.trim() || !/^https:\/\//.test(draft.api_url.trim()) || !/^[A-Z][A-Z0-9_]{2,63}$/.test(draft.api_key_env.trim())) {
      toast({ title: "Check the provider details", description: "ID: letters/numbers. API URL: https://… Secret name: UPPER_SNAKE_CASE.", variant: "destructive" });
      return;
    }
    const ok = await run("add", () => db.from("social_boost_providers").insert({ id, label: draft.label.trim(), api_url: draft.api_url.trim(), api_key_env: draft.api_key_env.trim(), enabled: true, is_default: false, sort_order: providers.length + 1 }), `${draft.label.trim()} added`);
    if (ok) setDraft({ id: "", label: "", api_url: "", api_key_env: "" });
  };

  if (isLoading) return <section className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">Loading provider routing…</section>;
  if (error) return <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"><p className="font-semibold">Provider routing is not available yet</p><p className="mt-1 text-muted-foreground">{(error as Error).message}. Apply the multi-provider migration, then refresh.</p></section>;

  return (
    <section className="space-y-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
      <div className="flex items-start gap-3">
        <Route className="mt-1 h-5 w-5 shrink-0 text-cyan-500" aria-hidden="true" />
        <div>
          <h3 className="text-lg font-semibold">Social Boost providers</h3>
          <p className="text-sm text-muted-foreground">Choose which provider fulfils new orders. The default covers every service; pin a single service to a different provider below. Orders already placed always stay with the provider that accepted them.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {providers.map((provider) => (
          <article key={provider.id} className={`rounded-xl border p-4 ${provider.is_default ? "border-cyan-500 bg-background shadow-sm" : "border-border bg-background"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">{provider.label}</h4>
                  {provider.is_default && <Badge className="gap-1"><Star className="h-3 w-3" aria-hidden="true" />Default</Badge>}
                  {!provider.enabled && <Badge variant="secondary">Off</Badge>}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{provider.api_url}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><KeyRound className="h-3 w-3" aria-hidden="true" />Secret: <code>{provider.api_key_env}</code></p>
              </div>
              <Switch checked={provider.enabled} disabled={busy !== null} onCheckedChange={(checked) => toggleEnabled(provider, checked)} aria-label={`${provider.label} enabled`} />
            </div>
            <Button className="mt-3" size="sm" variant={provider.is_default ? "secondary" : "default"} disabled={provider.is_default || !provider.enabled || busy !== null} onClick={() => void makeDefault(provider)}>
              {provider.is_default ? <><Check className="mr-1 h-4 w-4" />Active for all services</> : "Make default"}
            </Button>
          </article>
        ))}
      </div>

      <details className="rounded-xl border border-dashed border-cyan-500/40 bg-background p-4">
        <summary className="cursor-pointer font-semibold">Add another provider</summary>
        <p className="mt-2 text-xs text-muted-foreground">Works with any provider that uses the standard SMM v2 API. Save its API key as an edge-function secret named exactly as below — keys are never stored in the database.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input aria-label="Provider ID" placeholder="ID (e.g. peakerr)" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
          <Input aria-label="Provider name" placeholder="Display name" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <Input aria-label="Provider API URL" placeholder="https://provider.com/api/v2" value={draft.api_url} onChange={(e) => setDraft({ ...draft, api_url: e.target.value })} />
          <Input aria-label="API key secret name" placeholder="PEAKERR_API_KEY" value={draft.api_key_env} onChange={(e) => setDraft({ ...draft, api_key_env: e.target.value })} />
        </div>
        <Button className="mt-3" size="sm" disabled={busy !== null} onClick={() => void addProvider()}><Plus className="mr-1 h-4 w-4" />Add provider</Button>
      </details>

      <div>
        <h4 className="font-semibold">Service routing</h4>
        <p className="mb-3 text-sm text-muted-foreground">
          {defaultProvider ? <>Services set to “Follow default” currently go to <strong>{defaultProvider.label}</strong>.</> : "No default provider is set."} Providers number their services differently, so enter each provider&apos;s own service ID — a service with no ID for its provider waits instead of buying the wrong thing.
        </p>
        <Input className="mb-4 sm:max-w-sm" aria-label="Search services" placeholder="Search by service name, category, or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="space-y-5">
          {grouped.length === 0 && <p className="text-sm text-muted-foreground">No services found. Add services under Social Boost pricing first.</p>}
          {grouped.map(([platform, items]) => (
            <div key={platform}>
              <h5 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{platform}</h5>
              <div className="divide-y rounded-xl border bg-background">
                {items.map((service) => {
                  const effective = providers.find((p) => p.id === (service.provider ?? defaultProvider?.id));
                  const missing = effective && effective.id !== LEGACY_PROVIDER_ID && !mappings.get(routeKey(service.service_id, effective.id));
                  const off = effective && !effective.enabled;
                  return (
                    <div key={service.service_id} className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1.4fr)_200px_minmax(0,2fr)] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{service.service_name || `Service ${service.service_id}`}</p>
                        <p className="text-xs text-muted-foreground">Local ID {service.service_id} · {service.category}</p>
                        {(missing || off) && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-amber-500"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{off ? `${effective?.label} is off — orders will wait` : `Add a ${effective?.label} service ID or orders will wait`}</p>
                        )}
                      </div>
                      <select
                        aria-label={`Provider for ${service.service_name ?? service.service_id}`}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={service.provider ?? FOLLOW_DEFAULT}
                        disabled={busy !== null}
                        onChange={(e) => void pinService(service, e.target.value)}
                      >
                        <option value={FOLLOW_DEFAULT}>Follow default ({defaultProvider?.label ?? "none"})</option>
                        {providers.map((p) => <option key={p.id} value={p.id}>{p.label}{p.enabled ? "" : " (off)"}</option>)}
                      </select>
                      <div className="flex flex-wrap gap-2">
                        {providers.map((p) => (
                          <label key={p.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {p.label}
                            <Input
                              key={`${service.service_id}:${p.id}:${mappings.get(routeKey(service.service_id, p.id)) ?? ""}`}
                              className="h-8 w-24"
                              inputMode="numeric"
                              placeholder={p.id === LEGACY_PROVIDER_ID ? String(service.service_id) : "ID"}
                              defaultValue={mappings.get(routeKey(service.service_id, p.id)) ?? ""}
                              onBlur={(e) => saveMapping(service, p, e.target.value)}
                              aria-label={`${p.label} service ID for ${service.service_name ?? service.service_id}`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
