import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Crown, Loader2, Package, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type AdminProduct = {
  id: string;
  source: "store" | "admin";
  title: string;
  description: string | null;
  price: number | null;
  store_kind: string | null;
  status: string | null;
  available: boolean | null;
  admin_boost: boolean;
  created_at: string;
  first_image: string | null;
  total_count: number;
};

const PAGE_SIZE = 20;

export default function AdminProductsBoostManager() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const total = products[0]?.total_count ? Number(products[0].total_count) : 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_products", { p_search: query, p_page: page, p_page_size: PAGE_SIZE });
      if (error) throw error;
      setProducts((data ?? []) as AdminProduct[]);
    } catch (error) {
      toast({ title: "Could not load products", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [query, page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(0);
    setQuery(search.trim());
  };

  const toggleBoost = async (product: AdminProduct) => {
    setBusyId(product.id);
    try {
      const { error } = await supabase.rpc("admin_set_product_boost", { p_source: product.source, p_product_id: product.id, p_enabled: !product.admin_boost });
      if (error) throw error;
      toast({ title: product.admin_boost ? "Golden boost removed" : "Golden boost applied", description: product.admin_boost ? "The product returns to normal ordering." : "This product now shows first across every product section." });
      await load();
    } catch (error) {
      toast({ title: "Boost failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" aria-hidden="true" /> All Products ({total})</CardTitle>
        <p className="text-sm text-muted-foreground text-pretty">
          Search every product on the platform. A golden boost keeps a product first across all product sections, even above products boosted by sellers.
        </p>
        <form onSubmit={submitSearch} className="flex gap-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products by title or description" aria-label="Search products" />
          <Button type="submit" variant="secondary"><Search className="mr-2 h-4 w-4" aria-hidden="true" />Search</Button>
        </form>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading products" /></div>
        ) : products.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No products found.</p>
        ) : (
          <ul className="space-y-2">
            {products.map((product) => (
              <li
                key={`${product.source}-${product.id}`}
                className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center ${product.admin_boost ? "border-amber-400 bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-950" : "bg-card"}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {product.first_image ? (
                    <img src={product.first_image} alt={product.title} className="h-14 w-14 shrink-0 rounded-md object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Package className="h-6 w-6" aria-hidden="true" /></span>
                  )}
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className="truncate">{product.title}</span>
                      {product.admin_boost && <Badge className="border-amber-500 bg-amber-500 text-amber-950 hover:bg-amber-500"><Crown className="mr-1 h-3 w-3" aria-hidden="true" />Golden Boost</Badge>}
                    </p>
                    <p className="text-xs opacity-70">
                      GHS {Number(product.price ?? 0).toFixed(2)} · {product.source === "admin" ? "Admin product" : `${product.store_kind ?? "store"} product`} · {product.status ?? "unknown"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === product.id}
                  variant={product.admin_boost ? "outline" : "default"}
                  className={product.admin_boost ? "border-amber-600 bg-transparent text-amber-900 hover:bg-amber-200" : "bg-amber-500 text-amber-950 hover:bg-amber-400"}
                  onClick={() => void toggleBoost(product)}
                >
                  {busyId === product.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {product.admin_boost ? "Remove golden boost" : "Golden boost"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {lastPage + 1}</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= lastPage || loading} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
