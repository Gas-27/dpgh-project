// The `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` env vars are set to a custom
// domain ("api.dataplug.store") that is broken (Cloudflare 522 - the domain's
// proxy cannot reach its origin). Until that custom domain is fixed or removed
// in the Supabase/Cloudflare dashboard, always use the project's direct
// supabase.co URL on the server so API routes and admin queries keep working.
const DIRECT_SUPABASE_URL = "https://uloaiqmknsrknqikbmtb.supabase.co";
const BROKEN_CUSTOM_DOMAINS = ["api.dataplug.store"];

export function getSupabaseUrl(envUrl?: string | null): string {
  if (!envUrl) return DIRECT_SUPABASE_URL;
  const isBroken = BROKEN_CUSTOM_DOMAINS.some((domain) => envUrl.includes(domain));
  return isBroken ? DIRECT_SUPABASE_URL : envUrl;
}
