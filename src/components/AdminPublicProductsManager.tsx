import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type PublicProduct = { id: string; title: string; description: string; price: number; image_urls: string[]; active: boolean };
const emptyProduct = { title: "", description: "", price: "", image_urls: "", active: true };

export default function AdminPublicProductsManager() {
  const { toast } = useToast();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [draft, setDraft] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const load = async () => { const { data, error } = await supabase.from("public_store_products").select("*").order("created_at", { ascending: false }); if (error) toast({ title: "Could not load products", description: error.message, variant: "destructive" }); else setProducts((data ?? []) as PublicProduct[]); };
  useEffect(() => { void load(); }, []);
  const handleGalleryFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 8);
    files.forEach((file) => {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => setDraft((current) => ({ ...current, image_urls: `${current.image_urls}${current.image_urls ? "\\n" : ""}${String(reader.result)}` }));
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };
  const add = async () => {
    if (!draft.title.trim() || !draft.price) return;
    setSaving(true);
    const { error } = await supabase.from("public_store_products").insert({ title: draft.title.trim(), description: draft.description.trim(), price: Number(draft.price), image_urls: draft.image_urls.split("\n").map((url) => url.trim()).filter(Boolean), active: draft.active });
    setSaving(false);
    if (error) { console.error("[v0] Product publish failed:", error); toast({ title: "Could not publish product", description: error.code === "42501" ? "Your admin session is not authorized to publish products. Sign out, sign back in, and try again." : error.message, variant: "destructive" }); } else { setDraft(emptyProduct); await load(); toast({ title: "Product published" }); }
  };
  const toggle = async (product: PublicProduct) => { const { error } = await supabase.from("public_store_products").update({ active: !product.active, updated_at: new Date().toISOString() }).eq("id", product.id); if (error) toast({ title: "Could not update product", description: error.message, variant: "destructive" }); else await load(); };
  const remove = async (id: string) => { const { error } = await supabase.from("public_store_products").delete().eq("id", id); if (error) toast({ title: "Could not remove product", description: error.message, variant: "destructive" }); else await load(); };
  return <Card><CardHeader><CardTitle>Public storefront products</CardTitle></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 md:grid-cols-2"><Input placeholder="Product name" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /><Input type="number" min="0" step="0.01" placeholder="Price (GHS)" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /><Textarea className="md:col-span-2" placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /><div className="md:col-span-2 space-y-2"><div className="flex items-center justify-between"><Label>Product images</Label><span className="text-xs text-muted-foreground">Up to 8 images, 5 MB each</span></div><input ref={galleryInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleGalleryFiles} /><Button type="button" variant="outline" onClick={() => galleryInputRef.current?.click()}>Choose from gallery</Button><Textarea placeholder="Selected images will appear here" value={draft.image_urls} readOnly className="font-mono text-xs" /></div></div><Button onClick={add} disabled={saving || !draft.title.trim() || !draft.price}><Plus className="mr-2 h-4 w-4" />Publish product</Button><div className="grid gap-3">{products.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-semibold">{product.title}</p><p className="text-sm text-muted-foreground">GHS {Number(product.price).toFixed(2)} · {product.active ? "Visible" : "Hidden"}</p></div><div className="flex items-center gap-3"><Switch checked={product.active} onCheckedChange={() => toggle(product)} aria-label={`Toggle ${product.title}`} /><Button variant="ghost" size="icon" onClick={() => remove(product.id)} aria-label={`Delete ${product.title}`}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div></CardContent></Card>;
}
