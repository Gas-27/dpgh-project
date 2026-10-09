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
  store_kind?: string | null;
  boost_global?: boolean;
  boost_global_expires_at?: string | null;
  boost_sitewide?: boolean;
  boost_sitewide_expires_at?: string | null;
  seller_phone?: string | null;
};

const PAGE_SIZE = 10;

function phoneDigits(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return `233${digits.slice(1)}`;
  return digits;
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
  const [effectiveSearch, setEffectiveSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setEffectiveSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadProducts = async () => {
      const fields = "id,title,description,price,image_urls,created_at,store_id,store_kind,boost_global,boost_global_expires_at,boost_sitewide,boost_sitewide_expires_at";
      const queryProducts = (query: any) => effectiveSearch
        ? query.or(`title.ilike.%${effectiveSearch.replace(/[%_]/g, "\\$&")}%,description.ilike.%${effectiveSearch.replace(/[%_]/g, "\\$&")}%`)
        : query;
      const addSellerContacts = async (items: PublicProduct[]) => {
        const idsByKind = new Map<string, string[]>();
        items.forEach((item) => {
          const kind = item.store_kind || "agent";
          idsByKind.set(kind, [...(idsByKind.get(kind) || []), item.store_id || ""].filter(Boolean));
        });
        const tableForKind: Record<string, string> = { agent: "agent_stores", subagent: "subagent_stores", subsubagent: "sub_subagent_stores" };
        const entries = await Promise.all([...idsByKind.entries()].map(async ([kind, ids]) => {
          const table = tableForKind[kind];
          if (!table || !ids.length) return [] as [string, string][];
          const { data } = await supabase.from(table).select("id,support_number,whatsapp_number").in("id", [...new Set(ids)]);
          return (data || []).map((row: any) => [row.id, row.whatsapp_number || row.support_number || ""] as [string, string]);
        }));
        const contacts = new Map(entries.flat());
        return items.map((item) => ({ ...item, seller_phone: contacts.get(item.store_id || "") || null }));
      };

      if (catalog === "store") {
        if (!storeId) {
          setStoreProducts([]);
          setStoreTotal(0);
          setLoading(false);
          return;
        }
        const result = await queryProducts(supabase.from("store_products").select(fields, { count: "exact" }).eq("store_id", storeId).eq("status", "active").eq("available", true).order("created_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1));
        if (!cancelled) {
          setStoreProducts(await addSellerContacts((result.data ?? []) as PublicProduct[]));
          setStoreTotal(result.count ?? 0);
          setLoading(false);
        }
        return;
      }

      // The shared RPC merges agent, subagent, subsubagent, and admin products
      // in the database, ranks active boosts first, and returns only this page.
      // Later pages are not fetched until the user clicks Next.
      const { data: pageRows, error: pageError } = await supabase.rpc("marketplace_products_page", {
        p_search: effectiveSearch,
        p_page: page,
        p_page_size: PAGE_SIZE,
      });
      if (pageError) throw pageError;
      const normalizeRpcProduct = (product: any): PublicProduct => ({
        ...product,
        image_urls: Array.isArray(product.image_urls) ? product.image_urls : [],
        store_kind: product.store_kind || "agent",
      });
      const products = await addSellerContacts((pageRows ?? []).map(normalizeRpcProduct));
      const total = Number((pageRows?.[0] as any)?.total_count ?? 0);
      if (!cancelled) {
        setGlobalProducts(products);
        setGlobalTotal(total);
        setLoading(false);
      }
    };

    loadProducts().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [catalog, effectiveSearch, page, siteWide, storeId, storeKind]);

  const visibleProducts = catalog === "store" ? storeProducts : globalProducts;
  const totalProducts = catalog === "store" ? storeTotal : globalTotal;
  const pageCount = Math.ceil(totalProducts / PAGE_SIZE);
  const sellerPhone = selected?.seller_phone || supportPhone;
  const productImage = selected?.image_urls?.[0];
  const shareableImage = productImage && /^https?:\/\//i.test(productImage) ? productImage : undefined;
  const sellerMessage = selected
    ? [
        `Hello, I would like to buy ${selected.title} for GHS ${Number(selected.price || 0).toFixed(2)}.`,
        `Details: ${selected.description || "No description provided"}`,
        shareableImage ? `Product image: ${shareableImage}` : "Product image: available in the product listing",
      ].join("\\n")
    : "";
  const buyLink = sellerPhone
    ? `https://wa.me/${phoneDigits(sellerPhone)}?text=${encodeURIComponent(sellerMessage)}`
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                      {product.seller_phone && <p className="text-xs text-muted-foreground">Seller: {product.seller_phone}</p>}
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
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {selected && (
            <>
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
                <DialogHeader>
                  <DialogTitle>{selected.title}</DialogTitle>
                  <DialogDescription>{selected.description}</DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-lg font-bold text-primary">GHS {Number(selected.price).toFixed(2)}</p>
                  {sellerPhone && <p className="mt-1 text-sm text-muted-foreground">Seller contact: {sellerPhone}</p>}
                </div>
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
