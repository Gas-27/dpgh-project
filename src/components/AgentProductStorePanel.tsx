import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Store, Wallet } from "lucide-react";

type StoreKind = "agent" | "subagent" | "subsubagent";
type Product = { id: string; title: string; description: string; price: number; image_urls: string[]; status: string; available: boolean };

const WEEKLY_PRICE = 6;
const EXTRA_POST_PRICE = 1;
const INCLUDED_WEEKLY_POSTS = 5;
const MAX_IMAGES = 4;
const walletTableByKind: Record<StoreKind, string> = { agent: "agent_stores", subagent: "subagent_stores", subsubagent: "sub_subagent_stores" };

export default function AgentProductStorePanel({ storeId, storeKind, supportPhone, walletBalance = 0, onWalletBalanceChange }: { storeId?: string; storeKind: StoreKind; supportPhone?: string; walletBalance?: number; onWalletBalanceChange?: (balance: number) => void }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [freePostUsed, setFreePostUsed] = useState(false);
  const [paidLimit, setPaidLimit] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const activePaid = expiresAt ? new Date(expiresAt) > new Date() : false;
  const paidPostsUsed = Math.max(0, products.length - (freePostUsed ? 1 : 0));
  const includedRemaining = activePaid ? Math.max(0, paidLimit - paidPostsUsed) : (freePostUsed ? 0 : 1);
  const remaining = Math.max(0, includedRemaining);
  const needsExtraCharge = remaining === 0;

  async function load() {
    if (!storeId) return;
    setLoading(true);
    const [{ data: rows }, { data: entitlement }] = await Promise.all([
      supabase.from("store_products").select("id,title,description,price,image_urls,status,available").eq("store_id", storeId).order("created_at", { ascending: false }),
      supabase.from("store_product_entitlements").select("free_post_used,paid_post_limit,paid_post_expires_at").eq("store_id", storeId).maybeSingle(),
    ]);
    setProducts((rows || []) as Product[]);
    setFreePostUsed(Boolean(entitlement?.free_post_used));
    setPaidLimit(Number(entitlement?.paid_post_limit || 0));
    setExpiresAt(entitlement?.paid_post_expires_at || null);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [storeId]);

  function handleGalleryFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, MAX_IMAGES - images.length);
    files.forEach(file => {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => setImages(current => [...current, String(reader.result)].slice(0, MAX_IMAGES));
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }

  async function addProduct() {
    if (!storeId || !title.trim() || !price || (needsExtraCharge && walletBalance < EXTRA_POST_PRICE)) {
      if (needsExtraCharge && walletBalance < EXTRA_POST_PRICE) toast({ title: "Insufficient wallet balance", description: "Add at least GHS 1.00 to post another product.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const walletTable = walletTableByKind[storeKind];
    const startingBalance = Number(walletBalance);
    if (needsExtraCharge) {
      const { error: walletError } = await supabase.from(walletTable).update({ wallet_balance: startingBalance - EXTRA_POST_PRICE }).eq("id", storeId).gte("wallet_balance", EXTRA_POST_PRICE);
      if (walletError) { toast({ title: "Could not charge wallet", description: walletError.message, variant: "destructive" }); setSaving(false); return; }
      onWalletBalanceChange?.(startingBalance - EXTRA_POST_PRICE);
    }
    const cleanImages = images.map(image => image.trim()).filter(Boolean).slice(0, MAX_IMAGES);
    const { error } = await supabase.from("store_products").insert({ store_id: storeId, store_kind: storeKind, title: title.trim(), description: description.trim(), price: Number(price), image_urls: cleanImages });
    if (error) toast({ title: "Could not add product", description: error.message, variant: "destructive" });
    else { toast({ title: "Product posted", description: "Your product is now visible on your storefront." }); setTitle(""); setDescription(""); setPrice(""); setImages([]); if (!freePostUsed) await supabase.from("store_product_entitlements").upsert({ store_id: storeId, store_kind: storeKind, free_post_used: true }); await load(); }
    setSaving(false);
  }

  async function toggleProduct(product: Product) {
    const enabled = product.status !== "active" || !product.available;
    const { error } = await supabase.from("store_products").update({ status: enabled ? "active" : "inactive", available: enabled, updated_at: new Date().toISOString() }).eq("id", product.id).eq("store_id", storeId);
    if (error) toast({ title: "Could not update product", description: error.message, variant: "destructive" }); else await load();
  }

  async function renew() {
    if (!storeId) return;
    if (walletBalance < WEEKLY_PRICE) { toast({ title: "Insufficient wallet balance", description: `You need GHS ${WEEKLY_PRICE.toFixed(2)} to renew.`, variant: "destructive" }); return; }
    setSaving(true);
    const walletTable = walletTableByKind[storeKind];
    const { error: walletError } = await supabase.from(walletTable).update({ wallet_balance: Number(walletBalance) - WEEKLY_PRICE }).eq("id", storeId).gte("wallet_balance", WEEKLY_PRICE);
    if (walletError) { toast({ title: "Renewal failed", description: walletError.message, variant: "destructive" }); setSaving(false); return; }
    const expires = new Date(); expires.setDate(expires.getDate() + 7);
    const { error: entitlementError } = await supabase.from("store_product_entitlements").upsert({ store_id: storeId, store_kind: storeKind, paid_post_limit: INCLUDED_WEEKLY_POSTS, paid_post_expires_at: expires.toISOString(), updated_at: new Date().toISOString() }, { onConflict: "store_id" });
    if (entitlementError) { await supabase.from(walletTable).update({ wallet_balance: Number(walletBalance) }).eq("id", storeId); toast({ title: "Renewal failed", description: entitlementError.message, variant: "destructive" }); setSaving(false); return; }
    onWalletBalanceChange?.(Number(walletBalance) - WEEKLY_PRICE); toast({ title: "Product plan renewed", description: "Five product posts are available for seven days." }); await load(); setSaving(false);
  }

  if (!storeId) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Your store is still loading.</CardContent></Card>;
  return <div className="space-y-6">
    <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Store products</CardTitle><p className="text-sm text-muted-foreground">Post products for sale on your storefront. Buyers can place an order and contact you through your support number{supportPhone ? ` (${supportPhone})` : ""}.</p></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary"><Wallet className="mr-1 h-3 w-3" />Wallet: GHS {Number(walletBalance).toFixed(2)}</Badge><Badge variant="secondary">{freePostUsed ? "Free post used" : "1 free post available"}</Badge><Badge variant={activePaid ? "default" : "outline"}>{activePaid ? `${remaining} included posts left` : needsExtraCharge ? "Extra posts: GHS 1 each" : "GHS 6 weekly plan"}</Badge>{activePaid && <span className="text-xs text-muted-foreground">Expires {new Date(expiresAt!).toLocaleDateString()}</span>}<Button size="sm" variant="outline" onClick={renew} disabled={saving || activePaid}><Wallet className="mr-1 h-4 w-4" />{activePaid ? "Plan active" : "Renew · GHS 6"}</Button></div>
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-3"><div><Label>Product name</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Handmade sandals" /></div><div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the product, delivery, and important details." /></div><div><Label>Price (GHS)</Label><Input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} /></div></div><div className="space-y-3"><Label>Product images (up to 4)</Label><input ref={galleryInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleGalleryFiles} /><button type="button" onClick={() => galleryInputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center transition hover:border-primary hover:bg-primary/10"><Plus className="mb-2 h-6 w-6 text-primary" /><span className="font-medium">Choose images from gallery</span><span className="text-xs text-muted-foreground">PNG, JPG, or WebP · maximum 5 MB each</span></button>{images.length > 0 && <div className="grid grid-cols-2 gap-3">{images.map((image, index) => <div className="group relative overflow-hidden rounded-xl border" key={`${image.slice(0, 20)}-${index}`}><img src={image} alt={`Product preview ${index + 1}`} className="aspect-square w-full object-cover" /><Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2 h-8 w-8 opacity-0 transition group-hover:opacity-100" onClick={() => setImages(current => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}<p className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES} images selected</p></div></div><Button onClick={addProduct} disabled={saving || !title.trim() || !price || (needsExtraCharge && walletBalance < EXTRA_POST_PRICE)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{remaining < 1 ? "Renew to post more" : "Post product"}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Your product posts</CardTitle></CardHeader><CardContent>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : products.length === 0 ? <p className="text-sm text-muted-foreground">No products posted yet.</p> : <div className="grid gap-3 md:grid-cols-2">{products.map(product => <div key={product.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{product.title}</p><p className="text-sm text-muted-foreground">GHS {Number(product.price).toFixed(2)}</p></div><Badge variant={product.status === "active" ? "default" : "outline"}>{product.status}</Badge></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p><Button size="sm" variant="ghost" className="mt-2" onClick={() => toggleProduct(product)}>{product.status === "active" && product.available ? "Disable" : "Enable"}</Button></div>)}</div>}</CardContent></Card>
  </div>;
}
