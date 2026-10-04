import { useEffect, useState } from "react";
import ClaimFreeDataDialog from "@/components/ClaimFreeDataDialog";
import { DraggableFAB } from "@/components/DraggableFAB";
import PromoCodeFreeDataIcon from "@/components/PromoCodeFreeDataIcon";
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
        .order("updated_at", { ascending: false })
        .limit(1);
      if (active) setEnabled(data?.[0]?.claim_visible === true);
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
      <DraggableFAB
        initialBottom={96}
        initialRight={0}
        storageKey="promo-code-free-data-admin"
        onClick={() => setOpen(true)}
        title="Claim Free Data"
        className="w-56 max-w-[calc(100vw-1rem)] overflow-hidden rounded-r-full rounded-l-[3rem]"
      >
        <PromoCodeFreeDataIcon />
      </DraggableFAB>
      <ClaimFreeDataDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
