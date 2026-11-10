import { supabase } from "@/integrations/supabase/client";
import { normalizeApprovalNumber } from "@/lib/orderNumberApproval";

/**
 * True when the number has already been submitted for approval (pending or approved),
 * so the "New Number Detected" warning should not be shown for it.
 * Any lookup error resolves to false so the normal warning still appears.
 */
export async function isNumberSubmittedForApproval(phone: string): Promise<boolean> {
  const normalized = normalizeApprovalNumber(phone.trim());
  if (!normalized) return false;
  try {
    // order_number_submissions is not in the generated Supabase types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("order_number_submissions")
      .select("id")
      .eq("normalized_phone", normalized)
      .in("status", ["pending", "approved"])
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
