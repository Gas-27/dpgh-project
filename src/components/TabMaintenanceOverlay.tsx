import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { label: string; message?: string; availableFrom?: string; availableUntil?: string; onReturn?: () => void };

export default function TabMaintenanceOverlay({ label, message, availableFrom, availableUntil, onReturn }: Props) {
  const windowText = availableFrom || availableUntil
    ? `Availability: ${availableFrom ? new Date(availableFrom).toLocaleString() : "now"}${availableUntil ? ` – ${new Date(availableUntil).toLocaleString()}` : ""}.`
    : "We will let you know as soon as this service is available.";
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#111827]/80 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-label={`${label} maintenance`}>
      <div className="w-full max-w-md rounded-2xl border-2 border-cyan-300 bg-[#35127d] p-5 text-center text-white shadow-[0_0_28px_rgba(34,211,238,0.7)]">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-200"><AlertTriangle className="size-7" /></div>
        <h2 className="text-xl font-extrabold">{label} is temporarily unavailable</h2>
        <p className="mt-3 leading-6 text-white/90">{message || "We are working to bring this service to you. Please expect it soon."}</p>
        <p className="mt-3 text-sm text-cyan-100">{windowText}</p>
        <Button type="button" onClick={onReturn} className="mt-5 w-full bg-[#4d2a9a] text-white shadow-none hover:bg-[#5d36ad]">Please check back later</Button>
      </div>
    </div>
  );
}
