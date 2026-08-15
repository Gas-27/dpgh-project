import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Sparkles, Play, Music, PenLine, Palette, ChartNoAxesCombined, Languages, Brain, Code2, GraduationCap, FileText, Gamepad2, Search, ShoppingBag } from "lucide-react";

interface Service { id: string; slug: string; name: string; category: string; description: string; price: number; duration: string; icon: string; }
const categories = [
  { name: "Streaming & Entertainment", icon: Play }, { name: "Writing & Productivity", icon: PenLine },
  { name: "Education & Skills", icon: GraduationCap }, { name: "Developer Tools & Coding", icon: Code2 },
  { name: "Gaming Bots & Mods", icon: Gamepad2 }, { name: "Design & Creative", icon: Palette },
  { name: "Finance & Charting", icon: ChartNoAxesCombined }, { name: "Language Learning", icon: Languages },
  { name: "Document Management", icon: FileText }, { name: "AI & Research", icon: Brain },
];
const iconMap: Record<string, any> = { play: Play, music: Music, pen: PenLine, palette: Palette, chart: ChartNoAxesCombined, languages: Languages, brain: Brain, code: Code2, graduation: GraduationCap, file: FileText, gamepad: Gamepad2, search: Search };

export default function DigitalServicesCatalog({ onBuy }: { onBuy: (service: Service) => void }) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState<string | null>(categories[0].name);
  const [loading, setLoading] = useState(true);
  useEffect(() => { supabase.from("digital_services").select("id,slug,name,category,description,price,duration,icon").eq("active", true).order("name").then(({ data, error }) => { if (error) toast({ title: "Services unavailable", description: "Please try again shortly.", variant: "destructive" }); setServices((data as Service[]) || []); setLoading(false); }); }, [toast]);
  const grouped = useMemo(() => Object.fromEntries(categories.map((category) => [category.name, services.filter((service) => service.category === category.name)])), [services]);
  return <div className="mx-auto max-w-6xl space-y-6 pb-16">
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center md:p-8"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><ShoppingBag className="h-6 w-6 text-primary" /></div><h2 className="font-display text-2xl font-bold md:text-3xl">Digital Services</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Premium tools, subscriptions, and digital access — activated securely after payment.</p><div className="mt-4 flex flex-wrap justify-center gap-2">{categories.map((category) => <Badge key={category.name} variant="outline" className="border-primary/20">{category.name}</Badge>)}</div></div>
    {loading ? <div className="grid gap-4 md:grid-cols-2"><div className="h-32 animate-pulse rounded-xl bg-muted" /><div className="h-32 animate-pulse rounded-xl bg-muted" /></div> : <div className="space-y-3">{categories.map(({ name, icon: CategoryIcon }) => { const items = grouped[name] || []; const isOpen = open === name; return <Card key={name} className="overflow-hidden border-border/80"><button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : name)} className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/40"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CategoryIcon className="h-4 w-4" /></span><span><span className="block font-display font-semibold">{name}</span><span className="text-xs text-muted-foreground">{items.length} service{items.length === 1 ? "" : "s"}</span></span></span>{isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</button>{isOpen && <CardContent className="grid gap-3 border-t border-border/70 p-4 sm:grid-cols-2 lg:grid-cols-3">{items.length ? items.map((service) => { const Icon = iconMap[service.icon] || Sparkles; return <div key={service.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-4"><div><div className="mb-3 flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><Badge variant="secondary">{service.duration}</Badge></div><h3 className="font-display font-semibold">{service.name}</h3><p className="mt-1 min-h-12 text-sm leading-5 text-muted-foreground">{service.description}</p></div><div className="mt-4 flex items-center justify-between gap-3"><span className="font-display text-lg font-bold text-primary">GHC {Number(service.price).toFixed(2)}</span><Button size="sm" onClick={() => onBuy(service)}>Activate</Button></div></div>; }) : <p className="col-span-full py-4 text-center text-sm text-muted-foreground">More services are being added to this category.</p>}</CardContent>}</Card>; })}</div>}
  </div>;
}
export type { Service };
