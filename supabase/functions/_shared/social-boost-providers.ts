// Provider routing shared by the social-boost gateway and the paystack-webhook.
// Every provider speaks the same SMM "v2" form-encoded API, so only the URL, key and service ID differ.

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

export type SocialBoostProvider = {
  id: string;
  label: string;
  api_url: string;
  api_key_env: string;
  enabled: boolean;
  is_default: boolean;
};

export type ProviderRoute = {
  provider: SocialBoostProvider;
  apiKey: string;
  providerServiceId: string;
};

export type RouteFailure = { error: string; status: number; retryable: boolean };

// Orders created before multi-provider support have provider = null and were always sent to ExoBoost.
export const LEGACY_PROVIDER_ID = "exoboost";

const BUILT_IN_PROVIDERS: SocialBoostProvider[] = [
  { id: LEGACY_PROVIDER_ID, label: "ExoBoost", api_url: "https://exosupplier.com/api/v2", api_key_env: "EXOBOOST_API_KEY", enabled: true, is_default: true },
];

export async function loadProviders(supabase: SupabaseAdmin): Promise<SocialBoostProvider[]> {
  const { data, error } = await supabase
    .from("social_boost_providers")
    .select("id,label,api_url,api_key_env,enabled,is_default")
    .order("sort_order");
  // Keeps ordering working with ExoBoost if the migration has not been applied yet.
  if (error || !Array.isArray(data) || data.length === 0) return BUILT_IN_PROVIDERS;
  return data as SocialBoostProvider[];
}

function defaultProvider(providers: SocialBoostProvider[]) {
  return providers.find((p) => p.is_default && p.enabled) ?? providers.find((p) => p.enabled) ?? null;
}

// Decides where a NEW order for a local service ID is sent, and which service ID to send.
// A disabled or unmapped provider fails closed: sending a mismatched ID to a different provider
// could buy the wrong service, so the order stays pending until an admin fixes the routing.
export async function resolveRoute(supabase: SupabaseAdmin, localServiceId: unknown): Promise<{ route: ProviderRoute } | RouteFailure> {
  const serviceId = String(localServiceId ?? "").split(":", 1)[0].trim();
  if (!/^\d+$/.test(serviceId)) return { error: "Invalid Social Boost service ID.", status: 400, retryable: false };

  const providers = await loadProviders(supabase);
  const { data: pricing } = await supabase.from("social_boost_service_pricing").select("provider").eq("service_id", serviceId).maybeSingle();
  const pinnedId: string | null = pricing?.provider ?? null;
  const provider = pinnedId ? providers.find((p) => p.id === pinnedId) : defaultProvider(providers);

  if (!provider) return { error: "No Social Boost provider is configured.", status: 503, retryable: true };
  if (!provider.enabled) return { error: `${provider.label} is turned off for new orders. The order is waiting for an admin to re-enable it or re-route the service.`, status: 503, retryable: true };

  const { data: mapping } = await supabase
    .from("social_boost_service_routes")
    .select("provider_service_id")
    .eq("service_id", serviceId)
    .eq("provider_id", provider.id)
    .maybeSingle();

  let providerServiceId = serviceId;
  if (mapping?.provider_service_id != null) {
    providerServiceId = String(mapping.provider_service_id);
  } else if (provider.id !== LEGACY_PROVIDER_ID) {
    return { error: `Service ${serviceId} has no ${provider.label} service ID mapping. The order is waiting for an admin to add it.`, status: 409, retryable: true };
  }

  const apiKey = Deno.env.get(provider.api_key_env);
  if (!apiKey) return { error: `${provider.label} is not configured (missing ${provider.api_key_env}).`, status: 500, retryable: true };

  return { route: { provider, apiKey, providerServiceId } };
}

// Status, refill, cancel and balance calls must reach the provider that owns the order, even when the
// default has since changed or that provider has been turned off for new orders.
export async function resolveActionProvider(supabase: SupabaseAdmin, input: Record<string, unknown>): Promise<{ provider: SocialBoostProvider; apiKey: string } | RouteFailure> {
  const providers = await loadProviders(supabase);
  const requested = typeof input.provider === "string" ? input.provider.trim() : "";
  let provider = requested ? providers.find((p) => p.id === requested) : undefined;

  if (!provider) {
    const ids = String(input.order ?? input.orders ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 50);
    if (ids.length > 0) {
      const { data } = await supabase.from("social_boost_orders").select("provider").in("provider_order_id", ids).limit(1);
      const ownerId: string = data?.[0]?.provider ?? LEGACY_PROVIDER_ID;
      provider = providers.find((p) => p.id === ownerId);
    } else {
      provider = defaultProvider(providers) ?? undefined;
    }
  }

  if (!provider) return { error: "Social Boost provider could not be determined.", status: 400, retryable: false };
  const apiKey = Deno.env.get(provider.api_key_env);
  if (!apiKey) return { error: `${provider.label} is not configured (missing ${provider.api_key_env}).`, status: 500, retryable: true };
  return { provider, apiKey };
}
