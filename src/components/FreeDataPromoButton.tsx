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
      const { data } = await supabase.from("app_settings").select("free_data_enabled").eq("id", 1).maybeSingle();
      if (active) setEnabled(data?.free_data_enabled === true);
    };
    loadSetting();
    const channel = supabase
      .channel("free-data-visibility")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings", filter: "id=eq.1" }, (payload) => {
        if (active) setEnabled(payload.new.free_data_enabled === true);
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
