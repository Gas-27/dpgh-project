import { supabase } from "@/integrations/supabase/client";

export type ImpersonateKind = "agent" | "subagent" | "sub_subagent";

export const IMPERSONATING_FLAG = "impersonating";

interface ImpersonateResult {
  error?: string;
  impersonate_url?: string;
}

/**
 * Asks the `admin-impersonate` edge function for a one-time sign-in link for a
 * store and opens it in a new tab. The tab is opened synchronously (before the
 * network call) so popup blockers treat it as user-initiated.
 */
export async function openStoreAsAdmin(
  storeKind: ImpersonateKind,
  storeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const popup = window.open("", "_blank");

  const fail = (message: string) => {
    popup?.close();
    return { ok: false, error: message };
  };

  try {
    const { data, error } = await supabase.functions.invoke("admin-impersonate", {
      body: { store_kind: storeKind, store_id: storeId },
    });

    const result = (data ?? {}) as ImpersonateResult;

    if (error) return fail(result.error || error.message || "Could not sign in as this store");
    if (result.error) return fail(result.error);
    if (!result.impersonate_url) return fail("No impersonation link was returned");

    if (popup) {
      popup.location.href = result.impersonate_url;
    } else {
      window.open(result.impersonate_url, "_blank");
    }
    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not sign in as this store");
  }
}
