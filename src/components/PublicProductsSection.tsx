import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PublicProduct = { id: string; title: string; description: string; price: number; image_urls: string[]; support_phone?: string | null; whatsapp_number?: string | null };

const digitsOnly = (value: string) => value.replace(/[^0-9]/g, "");

export default function PublicProductsSection({ supportPhone }: { supportPhone?: string | null }) {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [image, setImage] = useState(0);

  useEffect(() => {
    supabase.from("public_store_products").select("id,title,description,price,image_urls,support_phone,whatsapp_number").eq("active", true).order("created_at", { ascending: false }).then(({ data }) => setProducts((data ?? []) as PublicProduct[]));
  }, []);

  const buyProduct = (product: PublicProduct) => {
    const phone = digitsOnly(product.whatsapp_number || product.support_phone || supportPhone || "");
    if (!phone) return;
    const message = [
      "Hello, I want to buy this product:",
      `Product: ${product.title}`,
      `Price: GHS ${Number(product.price).toFixed(2)}`,
      `Details: ${product.description || "No additional details provided."}`,
      `Image: ${product.image_urls?.[0] || "No image attached"}`,
    ].join("\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return <div className="container pb-20"><Card className="border-primary/30"><CardContent className="p-4 sm:p-6"><div className="mb-6 text-center"><h2 className="font-display text-2xl font-bold">Products</h2><p className="text-sm text-muted-foreground">Explore our products</p><p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Browse available products, open any product to view its details and images, then follow the purchase instructions shown for that product. Product availability and pricing are managed by the store administrator.</p></div>{products.length === 0 ? <p className="py-12 text-center text-muted-foreground">No products are available right now.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <button type="button" key={product.id} onClick={() => { setSelected(product); setImage(0); }} className="overflow-hidden rounded-xl border border-primary/30 bg-card text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">{product.image_urls?.[0] ? <img src={product.image_urls[0]} alt={product.title} className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-primary/10" />}<div className="space-y-2 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{product.title}</h3><span className="font-bold text-primary">GHS {Number(product.price).toFixed(2)}</span></div><p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p><span className="text-sm font-medium text-primary">More details</span></div></button>)}</div>}</CardContent></Card><Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Product details</DialogDescription></DialogHeader>{selected && <div className="grid gap-5 md:grid-cols-2"><div className="space-y-2">{selected.image_urls?.[image] ? <img src={selected.image_urls[image]} alt={`${selected.title} image ${image + 1}`} className="aspect-[4/3] w-full rounded-xl object-cover" /> : <div className="aspect-[4/3] rounded-xl bg-primary/10" />}{selected.image_urls?.length > 1 && <div className="grid grid-cols-4 gap-2">{selected.image_urls.map((url, index) => <button type="button" key={url} onClick={() => setImage(index)} className={`aspect-square overflow-hidden rounded-lg border-2 ${image === index ? "border-primary" : "border-transparent"}`}><img src={url} alt={`${selected.title} thumbnail ${index + 1}`} className="h-full w-full object-cover" /></button>)}</div>}</div><div className="space-y-4"><div><p className="text-sm text-muted-foreground">Price</p><p className="text-2xl font-bold text-primary">GHS {Number(selected.price).toFixed(2)}</p></div><p className="whitespace-pre-wrap leading-relaxed">{selected.description || "No additional details provided."}</p><Button className="w-full" onClick={() => buyProduct(selected)}>Buy this product</Button></div></div>}</DialogContent></Dialog></div>;
}
