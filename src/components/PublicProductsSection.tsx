import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PublicProduct = { id: string; title: string; description: string; price: number; image_urls: string[]; boost_global?: boolean; boost_global_expires_at?: string | null; boost_sitewide?: boolean; boost_sitewide_expires_at?: string | null };
export default function PublicProductsSection({ supportPhone, storeId, storeKind, siteWide = false }: { supportPhone?: string | null; storeId?: string | null; storeKind?: string; siteWide?: boolean }) {
  const [globalProducts, setGlobalProducts] = useState<PublicProduct[]>([]);
  const [storeProducts, setStoreProducts] = useState<PublicProduct[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [catalog, setCatalog] = useState<"store" | "global">("store");
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [image, setImage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    const nowIso = new Date().toISOString();
    let boostedQuery = supabase.from("store_products").select("id,title,description,price,image_urls,boost_global,boost_global_expires_at,boost_sitewide,boost_sitewide_expires_at").eq("status", "active").eq("available", true);
    boostedQuery = siteWide
      ? boostedQuery.eq("boost_sitewide", true).gt("boost_sitewide_expires_at", nowIso)
      : boostedQuery.or(`and(boost_global.eq.true,boost_global_expires_at.gt.${nowIso}),and(boost_sitewide.eq.true,boost_sitewide_expires_at.gt.${nowIso})`);
    Promise.all([
      supabase.from("public_store_products").select("id,title,description,price,image_urls").eq("active", true).order("created_at", { ascending: false }),
      storeId ? supabase.from("store_products").select("id,title,description,price,image_urls").eq("store_id", storeId).eq("status", "active").eq("available", true).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      supabase.from("store_products").select("id,title,description,price,image_urls").eq("status", "active").eq("available", true).order("created_at", { ascending: false }),
    ]).then(([globalResult, storeResult, allProductsResult]) => {
      const curated = (globalResult.data ?? []) as PublicProduct[];
      const boosted = (allProductsResult.data ?? []) as PublicProduct[];
      const seen = new Set<string>();
      const global = [...boosted, ...curated].filter((product) => (seen.has(product.id) ? false : (seen.add(product.id), true)));
      const store = (storeResult.data ?? []) as PublicProduct[];
      setGlobalProducts(global); setStoreProducts(store); setProducts(store.length ? store : global);
    });
  }, [storeId, storeKind, siteWide]);
  useEffect(() => { const source = catalog === "store" ? (storeProducts.length ? storeProducts : globalProducts) : globalProducts; const query = searchQuery.trim().toLowerCase(); setProducts(query ? source.filter((product) => `${product.title} ${product.description}`.toLowerCase().includes(query)) : source); }, [catalog, storeProducts, globalProducts, searchQuery]);
  return <div className="w-full px-2 pb-20 sm:px-0"><Card className="border-primary/30"><CardContent className="p-3 sm:p-6"><div className="mb-6 text-center"><h2 className="font-display text-2xl font-bold">Products</h2><Tabs value={catalog} onValueChange={(value) => setCatalog(value as "store" | "global")} className="mx-auto mt-4 max-w-md"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="store">Store Products</TabsTrigger><TabsTrigger value="global">All Products</TabsTrigger></TabsList></Tabs><div className="mx-auto mt-4 max-w-xl"><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search products" aria-label="Search products" className="w-full rounded-xl border border-primary/30 bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></div><p className="text-sm text-muted-foreground">Explore our products</p><p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Browse available products, open any product to view its details and images, then follow the purchase instructions shown for that product. Product availability and pricing are managed by the store administrator.</p></div>{products.length === 0 ? <p className="py-12 text-center text-muted-foreground">No products are available right now.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <button type="button" key={product.id} onClick={() => { setSelected(product); setImage(0); }} className="overflow-hidden rounded-xl border border-primary/30 bg-card text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">{product.image_urls?.[0] ? <img src={product.image_urls[0]} alt={product.title} className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-primary/10" />}<div className="space-y-2 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{product.title}</h3><span className="font-bold text-primary">GHS {Number(product.price).toFixed(2)}</span></div><p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p><span className="text-sm font-medium text-primary">More details</span></div></button>)}</div>}</CardContent></Card><Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Product details</DialogDescription></DialogHeader>{selected && <div className="grid gap-5 md:grid-cols-2"><div className="space-y-2">{selected.image_urls?.[image] ? <img src={selected.image_urls[image]} alt={`${selected.title} image ${image + 1}`} className="aspect-[4/3] w-full rounded-xl object-cover" /> : <div className="aspect-[4/3] rounded-xl bg-muted" />}{selected.image_urls?.length > 1 && <div className="flex gap-2 overflow-x-auto">{selected.image_urls.map((url, index) => <button type="button" key={url} onClick={() => setImage(index)}><img src={url} alt="" className={`h-14 w-14 rounded object-cover ${image === index ? "ring-2 ring-primary" : ""}`} /></button>)}</div>}</div><div className="space-y-4"><p className="text-2xl font-bold text-primary">GHS {Number(selected.price).toFixed(2)}</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{selected.description}</p><Button className="w-full" onClick={() => window.open(`https://wa.me/${String(supportPhone ?? "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hello, I want to buy ${selected.title} for GHS ${Number(selected.price).toFixed(2)}.`)}`, "_blank")}>Buy this product</Button></div></div>}</DialogContent></Dialog></div>;
}
