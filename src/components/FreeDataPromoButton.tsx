import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import ClaimFreeDataDialog from "@/components/ClaimFreeDataDialog";
import { supabase } from "@/integrations/supabase/client";

export default function FreeDataPromoButton() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSetting = async () => {
      const { data } = await supabase
        .from("promo_code_settings")
        .select("claim_visible")
        .eq("store_type", "admin")
        .eq("claim_visible", true)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (active) setEnabled(Boolean(data?.[0]?.claim_visible));
    };
    loadSetting();
    const channel = supabase
      .channel("free-data-visibility")
      .on("postgres_changes", { event: "*", schema: "public", table: "promo_code_settings", filter: "store_type=eq.admin" }, () => {
        loadSetting();
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  if (!enabled) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Claim free data" title="Claim Free Data" className="fixed bottom-24 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-primary-foreground shadow-lg transition hover:scale-105 hover:bg-emerald-700">
        <Gift className="h-6 w-6" />
      </button>
      <ClaimFreeDataDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
