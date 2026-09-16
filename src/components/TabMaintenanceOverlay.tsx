import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { label: string; message?: string; availableFrom?: string; availableUntil?: string };

export default function TabMaintenanceOverlay({ label, message, availableFrom, availableUntil }: Props) {
  const windowText = availableFrom || availableUntil
    ? `Availability: ${availableFrom ? new Date(availableFrom).toLocaleString() : "now"}${availableUntil ? ` – ${new Date(availableUntil).toLocaleString()}` : ""}.`
    : "We will let you know as soon as this service is available.";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label={`${label} maintenance`}>
      <div className="w-full max-w-md rounded-3xl border border-cyan-300/40 bg-[#321274] p-6 text-center text-white shadow-2xl">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-200"><AlertTriangle className="size-7" /></div>
        <h2 className="text-xl font-extrabold">{label} is temporarily unavailable</h2>
        <p className="mt-3 leading-6 text-white/90">{message || "We are working to bring this service to you. Please expect it soon."}</p>
        <p className="mt-3 text-sm text-cyan-100">{windowText}</p>
        <Button type="button" disabled className="mt-5 w-full cursor-not-allowed bg-white/15 text-white">Please check back later</Button>
      </div>
    </div>
  );
}
