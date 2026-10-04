import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import ClaimFreeDataDialog from "@/components/ClaimFreeDataDialog";
import { supabase } from "@/integrations/supabase/client";

export default function FreeDataPromoButton() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from("app_settings").select("free_data_enabled").eq("id", 1).maybeSingle().then(({ data }) => {
      if (active) setEnabled(data?.free_data_enabled !== false);
    });
    return () => { active = false; };
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
