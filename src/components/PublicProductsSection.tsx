import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Phone } from "lucide-react";

type PublicProduct = {
  id: string;
  title: string;
  description: string;
  price: number;
  image_urls: string[];
  created_at?: string;
  store_id?: string | null;
  boost_global?: boolean;
  boost_global_expires_at?: string | null;
  boost_sitewide?: boolean;
  boost_sitewide_expires_at?: string | null;
  seller_phone?: string | null;
};

const PAGE_SIZE = 15;

function phoneDigits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export default function PublicProductsSection({ supportPhone, storeId, storeKind, siteWide = false }: { supportPhone?: string | null; storeId?: string | null; storeKind?: string; siteWide?: boolean }) {
  const [globalProducts, setGlobalProducts] = useState<PublicProduct[]>([]);
  const [storeProducts, setStoreProducts] = useState<PublicProduct[]>([]);
  const [catalog, setCatalog] = useState<"store" | "global">("store");
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [image, setImage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const loadProducts = async () => {
      const now = new Date().toISOString();
      const productFields = "id,title,description,price,image_urls,created_at,store_id,boost_global,boost_global_expires_at,boost_sitewide,boost_sitewide_expires_at,seller_phone";
      const [curatedResult, storeResult, allResult] = await Promise.all([
        supabase.from("public_store_products").select(productFields).eq("active", true).order("created_at", { ascending: false }),
        storeId ? supabase.from("store_products").select(productFields).eq("store_id", storeId).eq("status", "active").eq("available", true).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from("store_products").select(productFields).eq("status", "active").eq("available", true).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const curated = (curatedResult.data ?? []) as PublicProduct[];
      const all = (allResult.data ?? []) as PublicProduct[];
      const boosted = all.filter((product) => {
        const globalBoost = product.boost_global === true && !!product.boost_global_expires_at && product.boost_global_expires_at > now;
        const siteBoost = product.boost_sitewide === true && !!product.boost_sitewide_expires_at && product.boost_sitewide_expires_at > now;
        return siteWide ? siteBoost : globalBoost || siteBoost;
      });
      const boostedIds = new Set(boosted.map((product) => product.id));
      const global = [...boosted, ...all.filter((product) => !boostedIds.has(product.id)), ...curated]
        .filter((product, index, list) => list.findIndex((candidate) => candidate.id === product.id) === index);
      setGlobalProducts(global);
      setStoreProducts((storeResult.data ?? []) as PublicProduct[]);
      setLoading(false);
    };
    loadProducts().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId, storeKind, siteWide]);

  const filteredProducts = useMemo(() => {
    const source = catalog === "store" && storeProducts.length ? storeProducts : globalProducts;
    const query = searchQuery.trim().toLowerCase();
    return query ? source.filter((product) => `${product.title} ${product.description}`.toLowerCase().includes(query)) : source;
  }, [catalog, storeProducts, globalProducts, searchQuery]);
  const pageCount = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const visibleProducts = filteredProducts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const sellerPhone = selected?.seller_phone || supportPhone;
  const buyLink = sellerPhone ? `https://wa.me/${phoneDigits(sellerPhone)}?text=${encodeURIComponent(`Hello, I would like to buy ${selected?.title ?? "this product"}.`)}` : undefined;

  return <div className="w-full px-2 pb-20 sm:px-0"><Card className="border-primary/30"><CardContent className="p-3 sm:p-6"><div className="mb-6 text-center"><h2 className="font-display text-2xl font-bold">Products</h2><Tabs value={catalog} onValueChange={(value) => { setCatalog(value as "store" | "global"); setPage(0); }} className="mx-auto mt-4 max-w-md"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="store">Store Products</TabsTrigger><TabsTrigger value="global">All Products</TabsTrigger></TabsList></Tabs><div className="mx-auto mt-4 max-w-xl"><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(0); }} placeholder="Search products" aria-label="Search products" className="w-full rounded-xl border border-primary/30 bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></div><p className="text-sm text-muted-foreground">Explore our products</p><p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Browse available products, open any product to view its details and images, then contact the seller to complete your purchase.</p></div>{loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : visibleProducts.length === 0 ? <p className="py-12 text-center text-muted-foreground">No products are available right now.</p> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => <button type="button" key={product.id} onClick={() => { setSelected(product); setImage(0); }} className="overflow-hidden rounded-xl border border-primary/30 bg-card text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">{product.image_urls?.[0] ? <img src={product.image_urls[0]} alt={product.title} className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-primary/10" />}<div className="space-y-2 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{product.title}</h3><span className="font-bold text-primary">GHC {Number(product.price).toFixed(2)}</span></div><p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p></div></button>)}</div><div className="mt-6 flex items-center justify-center gap-3"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button><span className="text-sm text-muted-foreground">Page {page + 1} of {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((current) => current + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button></div></>}</CardContent></Card><Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{selected?.description}</DialogDescription></DialogHeader>{selected && <div className="space-y-4">{selected.image_urls?.length ? <img src={selected.image_urls[image]} alt={selected.title} className="max-h-80 w-full rounded-lg object-contain" /> : null}{selected.image_urls?.length > 1 && <div className="flex justify-center gap-2">{selected.image_urls.map((url, index) => <button type="button" key={url} onClick={() => setImage(index)} className={`h-2 w-2 rounded-full ${index === image ? "bg-primary" : "bg-muted"}`} aria-label={`Show image ${index + 1}`} />)}</div>}<div className="flex items-center justify-between"><span className="text-xl font-bold text-primary">GHC {Number(selected.price).toFixed(2)}</span>{buyLink ? <Button asChild><a href={buyLink} target="_blank" rel="noreferrer"><Phone className="mr-2 h-4 w-4" /> Buy from seller</a></Button> : <p className="text-sm text-muted-foreground">Seller contact unavailable</p>}</div></div>}</DialogContent></Dialog></div>;
}
