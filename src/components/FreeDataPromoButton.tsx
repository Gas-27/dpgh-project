import { useRef, useState } from "react";
import { useEffect } from "react";
import ClaimFreeDataDialog from "@/components/ClaimFreeDataDialog";
import { supabase } from "@/integrations/supabase/client";

export default function FreeDataPromoButton() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const didDrag = useRef(false);

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
      <button
        type="button"
        onClick={() => {
          if (!didDrag.current) setOpen(true);
          didDrag.current = false;
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragStart.current = { x: event.clientX, y: event.clientY, offsetX: dragOffset.x, offsetY: dragOffset.y };
          didDrag.current = false;
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const nextX = dragStart.current.offsetX + event.clientX - dragStart.current.x;
          const nextY = dragStart.current.offsetY + event.clientY - dragStart.current.y;
          if (Math.abs(nextX - dragStart.current.offsetX) > 4 || Math.abs(nextY - dragStart.current.offsetY) > 4) didDrag.current = true;
          setDragOffset({ x: nextX, y: nextY });
        }}
        aria-label="Claim free data"
        title="Claim Free Data"
        className="fixed bottom-24 right-0 z-40 w-[min(31rem,calc(100vw-1rem))] cursor-grab touch-none overflow-hidden rounded-r-full rounded-l-[3rem] shadow-lg active:cursor-grabbing"
        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
      >
        <img src="/images/free-data-promo.jpeg" alt="Free Data" className="block h-auto w-full select-none" draggable={false} />
      </button>
      <ClaimFreeDataDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
