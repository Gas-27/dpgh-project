import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const PAGE_SIZE = 10;

function phoneDigits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export default function PublicProductsSection({
  supportPhone,
  storeId,
  storeKind,
  siteWide = false,
}: {
  supportPhone?: string | null;
  storeId?: string | null;
  storeKind?: string;
  siteWide?: boolean;
}) {
  const [globalProducts, setGlobalProducts] = useState<PublicProduct[]>([]);
  const [storeProducts, setStoreProducts] = useState<PublicProduct[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [storeTotal, setStoreTotal] = useState(0);
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
      const fields = "id,title,description,price,image_urls,created_at,store_id,boost_global,boost_global_expires_at,boost_sitewide,boost_sitewide_expires_at";
      const queryProducts = (query: any) => searchQuery.trim()
        ? query.or(`title.ilike.%${searchQuery.trim().replace(/[%_]/g, "\\$&")}%,description.ilike.%${searchQuery.trim().replace(/[%_]/g, "\\$&")}%`)
        : query;

      if (catalog === "store") {
        if (!storeId) {
          setStoreProducts([]);
          setStoreTotal(0);
          setLoading(false);
          return;
        }
        const result = await queryProducts(supabase.from("store_products").select(fields, { count: "exact" }).eq("store_id", storeId).eq("status", "active").eq("available", true).order("created_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1));
        if (!cancelled) {
          setStoreProducts((result.data ?? []) as PublicProduct[]);
          setStoreTotal(result.count ?? 0);
          setLoading(false);
        }
        return;
      }

      const base = () => queryProducts(supabase.from("store_products").select(fields, { count: "exact" }).eq("status", "active").eq("available", true));
      const boostFilter = `and(boost_global.eq.true,boost_global_expires_at.gt.${now}),and(boost_sitewide.eq.true,boost_sitewide_expires_at.gt.${now})`;
      const boostedIdsResult = await base().or(boostFilter).select("id");
      const boostedIds = (boostedIdsResult.data ?? []).map((product: any) => product.id);
      const boostedCount = boostedIds.length;
      const regularBase = () => {
        const query = base();
        return boostedIds.length
          ? query.not("id", "in", `(${boostedIds.join(",")})`)
          : query;
      };
      const start = page * PAGE_SIZE;
      const boostedTake = Math.max(0, Math.min(PAGE_SIZE, boostedCount - start));
      const regularTake = PAGE_SIZE - boostedTake;
      const boostedPage = boostedTake
        ? await base().or(boostFilter).order("created_at", { ascending: false }).range(start, start + boostedTake - 1)
        : { data: [] as PublicProduct[] };
      const regularOffset = Math.max(0, start - boostedCount);
      const regularPage = regularTake
        ? await regularBase().order("created_at", { ascending: false }).range(regularOffset, regularOffset + regularTake - 1)
        : { data: [] as PublicProduct[] };
      const regularCountResult = await regularBase().select("id", { count: "exact", head: true });
      if (!cancelled) {
        const products = [...((boostedPage.data ?? []) as PublicProduct[]), ...((regularPage.data ?? []) as PublicProduct[])];
        setGlobalProducts(products);
        setGlobalTotal(boostedCount + (regularCountResult.count ?? 0));
        setLoading(false);
      }
    };

    loadProducts().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [catalog, page, searchQuery, siteWide, storeId, storeKind]);

  const visibleProducts = catalog === "store" ? storeProducts : globalProducts;
  const totalProducts = catalog === "store" ? storeTotal : globalTotal;
  const pageCount = Math.ceil(totalProducts / PAGE_SIZE);
  const sellerPhone = selected?.seller_phone || supportPhone;
  const buyLink = sellerPhone
    ? `https://wa.me/${phoneDigits(sellerPhone)}?text=${encodeURIComponent(`Hello, I would like to buy ${selected?.title ?? "this product"}.`)}`
    : undefined;

  return (
    <div className="w-full px-2 pb-20 sm:px-0">
      <Card className="border-primary/30">
        <CardContent className="p-3 sm:p-6">
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl font-bold">Products</h2>
            <Tabs
              value={catalog}
              onValueChange={(value) => {
                setCatalog(value as "store" | "global");
                setPage(0);
              }}
              className="mx-auto mt-4 max-w-md"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="store">Store Products</TabsTrigger>
                <TabsTrigger value="global">All Products</TabsTrigger>
              </TabsList>
            </Tabs>
            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search products"
              aria-label="Search products"
              className="mx-auto mt-4 block w-full max-w-xl rounded-xl border border-primary/30 bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-sm text-muted-foreground">Explore our products</p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Browse available products, open any product to view its details and images, then contact the seller to complete your purchase.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleProducts.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No products are available right now.</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => {
                      setSelected(product);
                      setImage(0);
                    }}
                    className="overflow-hidden rounded-xl border border-primary/30 bg-card text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
                  >
                    {product.image_urls?.[0] ? (
                      <img src={product.image_urls[0]} alt={product.title} className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <div className="aspect-[4/3] bg-primary/10" aria-hidden="true" />
                    )}
                    <div className="space-y-2 p-4">
                      <h3 className="font-semibold">{product.title}</h3>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                      <p className="font-bold text-primary">GHS {Number(product.price).toFixed(2)}</p>
                    </div>
                  </button>
                ))}
              </div>
              {pageCount > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => current - 1)} disabled={page === 0} aria-label="Previous products">
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page + 1} of {pageCount}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => current + 1)} disabled={page >= pageCount - 1} aria-label="Next products">
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-lg bg-muted">
                  {selected.image_urls?.[image] ? (
                    <img src={selected.image_urls[image]} alt={`${selected.title} image ${image + 1}`} className="max-h-80 w-full object-contain" />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No image</div>
                  )}
                  {selected.image_urls?.length > 1 && (
                    <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
                      <Button size="icon" variant="secondary" onClick={() => setImage((current) => (current - 1 + selected.image_urls.length) % selected.image_urls.length)} aria-label="Previous image"><ChevronLeft className="h-4 w-4" /></Button>
                      <Button size="icon" variant="secondary" onClick={() => setImage((current) => (current + 1) % selected.image_urls.length)} aria-label="Next image"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
                <p className="text-lg font-bold text-primary">GHS {Number(selected.price).toFixed(2)}</p>
                {buyLink ? (
                  <Button asChild className="w-full"><a href={buyLink} target="_blank" rel="noreferrer"><Phone className="mr-2 h-4 w-4" /> Contact seller to buy <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
                ) : (
                  <p className="text-sm text-muted-foreground">The seller has not added a contact number yet.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
