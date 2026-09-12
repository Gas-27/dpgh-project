import { useState } from "react";
import { ChevronDown, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import OrderNumberApprovalForm from "@/components/OrderNumberApprovalForm";

type Props = { source: string; storeId?: string | null; onTrack?: (value: string) => void | Promise<void>; onCancel?: () => void; hasResults?: boolean; searching?: boolean; primaryColor?: string };

export default function TrackOrderDropdown({ source, storeId, onTrack, onCancel, hasResults = false, searching = false, primaryColor = "#2563eb" }: Props) {
  const [open, setOpen] = useState(false);
  const [lookup, setLookup] = useState("");
  return <div className="overflow-hidden rounded-[22px] border border-cyan-400/80 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 shadow-lg shadow-blue-950/30">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left text-white sm:px-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-500/25"><Package className="h-5 w-5 text-cyan-200" /></span>
      <span className="min-w-0 flex-1 border-l border-white/20 pl-3"><span className="block text-base font-bold">Track Your Order</span><span className="block text-xs text-blue-100/80">Enter your phone number or order ID to check your purchase status.</span></span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500 shadow-md"><ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} /></span>
    </button>
    {open && <div className="space-y-3 border-t border-white/15 bg-slate-950/35 p-4 sm:p-5">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const value = lookup.trim(); if (value) void onTrack?.(value); }}><Input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="0599427208 or order ID" className="border-cyan-400 bg-white/10 text-white placeholder:text-blue-100/60 focus-visible:ring-cyan-400" /><Button type="submit" disabled={!lookup.trim() || searching} style={{ backgroundColor: primaryColor }}><Search className="mr-2 h-4 w-4" />{searching ? "Searching…" : "Track"}</Button>{hasResults && <Button type="button" variant="outline" onClick={() => { setLookup(""); onCancel?.(); }}>Cancel Search</Button>}</form>
      <details className="rounded-lg border border-white/15 bg-white/5 p-3"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white [&::-webkit-details-marker]:hidden">Need approval for this number?<ChevronDown className="h-4 w-4" /></summary><div className="pt-3"><OrderNumberApprovalForm source={`${source}-track-order`} storeId={storeId} compact /></div></details>
    </div>}
  </div>;
}
