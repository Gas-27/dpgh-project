import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { buildWhatsAppProductLink } from "@/lib/whatsappProductMessage";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Phone, BadgeCheck } from "lucide-react";

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

const PAGE_SIZE = 18;

type SortOrder = "newest" | "price_asc" | "price_desc";

export default function PublicProductsSection({
  supportPhone,
  storeId,
  storeKind,
  siteWide = false,
  allProductsOnly = false,
  onCancel,
  className,
}: {
  className?: string;
  supportPhone?: string | null;
  storeId?: string | null;
  storeKind?: string;
  siteWide?: boolean;
  allProductsOnly?: boolean;
  onCancel?: () => void;
}) {
  const navigate = useNavigate();
  const [globalProducts, setGlobalProducts] = useState<PublicProduct[]>([]);
  const [storeProducts, setStoreProducts] = useState<PublicProduct[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [storeTotal, setStoreTotal] = useState(0);
  const [catalog, setCatalog] = useState<"store" | "global">("global");
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [image, setImage] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [effectiveSearch, setEffectiveSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

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
        const result = await queryProducts(supabase.from("store_products").select(fields, { count: "exact" }).eq("store_id", storeId).eq("status", "active").eq("available", true).order(...(sortOrder === "newest" ? ["created_at", { ascending: false }] : ["price", { ascending: sortOrder === "price_asc" }]) as [string, { ascending: boolean }]).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1));
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
        p_sort: sortOrder,
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
  }, [catalog, effectiveSearch, page, sortOrder, siteWide, storeId, storeKind]);

  const visibleProducts = catalog === "store" ? storeProducts : globalProducts;
  const totalProducts = catalog === "store" ? storeTotal : globalTotal;
  const pageCount = Math.ceil(totalProducts / PAGE_SIZE);
  const sellerPhone = selected?.seller_phone || supportPhone;
  const productImage = selected?.image_urls?.[0];
  const productSlug = selected ? selected.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "product";
  const productUrl = selected ? new URL(`/marketplace/product/${selected.id}/${productSlug || "product"}`, window.location.origin).toString() : "";
  const buyLink = selected
    ? buildWhatsAppProductLink(sellerPhone, { title: selected.title, description: selected.description, price: selected.price, productUrl, imageUrl: productImage })
    : undefined;

  const contactSeller = () => {
    if (buyLink) window.open(buyLink, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={cn(onCancel ? "-mx-4 w-auto pb-20 sm:mx-0 sm:w-full" : "w-full pb-20", className)}>
      <Card className="rounded-none border-x-0 border-primary/30 sm:rounded-lg sm:border-x">
        <CardContent className="p-3 sm:p-6">
          <div className="mb-6 text-center">
            <div className="flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-bold">Products</h2>{onCancel && <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>}</div>
            {!allProductsOnly && <Tabs
              value={catalog}
              onValueChange={(value) => {
                setCatalog(value as "store" | "global");
                setPage(0);
              }}
              className="mx-auto mt-4 max-w-md"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="store">Store Products</TabsTrigger>
                <TabsTrigger value="global">All Marketplace Products</TabsTrigger>
              </TabsList>
            </Tabs>}
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
            <div className="mx-auto mt-3 flex w-full max-w-xl items-center justify-end gap-2">
              <label htmlFor="product-sort" className="text-sm text-muted-foreground">Sort by</label>
              <select
                id="product-sort"
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value as SortOrder);
                  setPage(0);
                }}
                className="rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Lowest to Highest</option>
                <option value="price_desc">Price: Highest to Lowest</option>
              </select>
            </div>
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
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {visibleProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => navigate(`/marketplace/product/${product.id}/${product.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"}`)}
                    className="overflow-hidden rounded-xl border border-primary/30 bg-card text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
                  >
                    {product.image_urls?.[0] ? (
                      <img src={product.image_urls[0]} alt={product.title} className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <div className="aspect-[4/3] bg-primary/10" aria-hidden="true" />
                    )}
                    <div className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{product.title}</h3>{((product.boost_global && (!product.boost_global_expires_at || new Date(product.boost_global_expires_at) > new Date())) || (product.boost_sitewide && (!product.boost_sitewide_expires_at || new Date(product.boost_sitewide_expires_at) > new Date()))) && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"><BadgeCheck className="h-3.5 w-3.5" /> Boosted</span>}</div>
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
                    <button type="button" onClick={() => setExpandedImage(selected.image_urls[image])} className="group block w-full cursor-zoom-in" aria-label={`Enlarge ${selected.title} image`}>
                      <img src={selected.image_urls[image]} alt={`${selected.title} image ${image + 1}`} className="max-h-[32rem] w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]" />
                      <span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow">Tap to enlarge</span>
                    </button>
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
                <Button type="button" variant="outline" className="w-full" onClick={() => navigate(`/marketplace/product/${selected.id}/${productSlug || "product"}`)}>
                  View product page <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
                {buyLink ? (
                  <Button type="button" className="w-full" onClick={contactSeller}>
                    <Phone className="mr-2 h-4 w-4" /> Contact seller to buy <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">The seller has not added a contact number yet.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!expandedImage} onOpenChange={(open) => !open && setExpandedImage(null)}>
        <DialogContent className="max-w-6xl border-0 bg-background/95 p-2 sm:p-4">
          <DialogTitle className="sr-only">Enlarged product image</DialogTitle>
          {expandedImage && <img src={expandedImage} alt="Enlarged product" className="max-h-[85vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
