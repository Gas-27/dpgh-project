import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debitOwnWallet, newOrderId } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PROHIBITED_TERMS_LABEL, findProhibitedTerm, prohibitedTermFromError } from "@/lib/marketplaceRules";
import { Loader2, Plus, Trash2, Store, Wallet } from "lucide-react";

type StoreKind = "customer" | "agent" | "subagent" | "subsubagent";
type Product = { id: string; title: string; description: string; price: number; image_urls: string[]; status: string; available: boolean; payment_mode?: "direct" | "whatsapp"; whatsapp_payment_number?: string | null; boost_global?: boolean; boost_global_expires_at?: string | null; boost_sitewide?: boolean; boost_sitewide_expires_at?: string | null };
type PlanType = "weekly" | "monthly";

const WEEKLY_PRICE = 7;
const MONTHLY_PRICE = 25;
const INCLUDED_MONTHLY_POSTS = 30;
const MONTHLY_DURATION_DAYS = 30;
const EXTRA_POST_PRICE = 1;
const INCLUDED_WEEKLY_POSTS = 5;
const BOOST_GLOBAL_PRICE = 35;
const BOOST_SITEWIDE_PRICE = 40;
const BOOST_DURATION_DAYS = 30;
const MAX_IMAGES = 4;

export default function AgentProductStorePanel({ storeId, storeKind, supportPhone, walletBalance = 0, onWalletBalanceChange }: { storeId?: string; storeKind: StoreKind; supportPhone?: string; walletBalance?: number; onWalletBalanceChange?: (balance: number) => void }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [freePostUsed, setFreePostUsed] = useState(false);
  const [paidLimit, setPaidLimit] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const [boosting, setBoosting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [paymentMode, setPaymentMode] = useState<"direct" | "whatsapp">("whatsapp");
  const [paymentNumber, setPaymentNumber] = useState(supportPhone || "");
  const [images, setImages] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const blockedTerm = findProhibitedTerm(title, description);
  const activePaid = expiresAt ? new Date(expiresAt) > new Date() : false;
  const paidPostsUsed = Math.max(0, products.length - (freePostUsed ? 1 : 0));
  const productPostingLocked = Boolean(expiresAt) && !activePaid;

  const includedRemaining = activePaid ? Math.max(0, paidLimit - paidPostsUsed) : (freePostUsed ? 0 : 1);
  const remaining = Math.max(0, includedRemaining);
  const needsExtraCharge = remaining === 0;

  async function load() {
    if (!storeId) return;
    setLoading(true);
    const [{ data: rows }, { data: entitlement }] = await Promise.all([
      supabase.from("store_products").select("id,title,description,price,image_urls,status,available,boost_global,boost_global_expires_at,boost_sitewide,boost_sitewide_expires_at").eq("store_id", storeId).order("created_at", { ascending: false }),
      supabase.from("store_product_entitlements").select("free_post_used,paid_post_limit,paid_post_expires_at,plan_type").eq("store_id", storeId).maybeSingle(),
    ]);
    const entitlementExpiresAt = entitlement?.paid_post_expires_at || null;
    const entitlementActive = entitlementExpiresAt ? new Date(entitlementExpiresAt) > new Date() : false;
    if (entitlementExpiresAt && !entitlementActive) {
      await supabase.from("store_products").update({ status: "inactive", available: false, updated_at: new Date().toISOString() }).eq("store_id", storeId).eq("status", "active");
    }
    setProducts(((rows || []) as Product[]).map((product) => entitlementExpiresAt && !entitlementActive ? { ...product, status: "inactive", available: false } : product));
    setFreePostUsed(Boolean(entitlement?.free_post_used));
    setPaidLimit(Number(entitlement?.paid_post_limit || 0));
    setExpiresAt(entitlementExpiresAt);
    setPlanType((entitlement?.plan_type as PlanType) || null);
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
    if (blockedTerm) {
      toast({ title: "You cannot post about this service", description: `The word "${blockedTerm}" was detected. Posting services the site already offers can lead to permanent account deletion.`, variant: "destructive" });
      return;
    }
    if (!storeId || !title.trim() || !price || (needsExtraCharge && walletBalance < EXTRA_POST_PRICE)) {
      if (needsExtraCharge && walletBalance < EXTRA_POST_PRICE) toast({ title: "Insufficient wallet balance", description: "Add at least GHS 1.00 to post another product.", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (needsExtraCharge) {
      try {
        const { balanceAfter } = await debitOwnWallet({ ownerType: storeKind, ownerId: storeId, amount: EXTRA_POST_PRICE, kind: "product_post", reference: newOrderId(), note: "Extra product post" });
        onWalletBalanceChange?.(balanceAfter);
      } catch (err: any) {
        toast({ title: "Could not charge wallet", description: err.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    const cleanImages = images.map(image => image.trim()).filter(Boolean).slice(0, MAX_IMAGES);
    const { error } = await supabase.from("store_products").insert({ store_id: storeId, store_kind: storeKind, title: title.trim(), description: description.trim(), price: Number(price), image_urls: cleanImages, payment_mode: paymentMode, whatsapp_payment_number: paymentMode === "whatsapp" ? paymentNumber.trim() : null });
    const serverTerm = prohibitedTermFromError(error?.message);
    if (serverTerm) toast({ title: "You cannot post about this service", description: `The word "${serverTerm}" was detected. Posting services the site already offers can lead to permanent account deletion.`, variant: "destructive" });
    else if (error) toast({ title: "Could not add product", description: error.message, variant: "destructive" });
    else { toast({ title: "Product posted", description: "Your product is now visible on your storefront." }); setTitle(""); setDescription(""); setPrice(""); setImages([]); if (!freePostUsed) await supabase.from("store_product_entitlements").upsert({ store_id: storeId, store_kind: storeKind, free_post_used: true }); await load(); }
    setSaving(false);
  }

  async function toggleProduct(product: Product) {
    const enabled = product.status !== "active" || !product.available;
    if (enabled && productPostingLocked) {
      toast({ title: "Plan expired", description: "Renew the weekly or monthly product plan before enabling products.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("store_products").update({ status: enabled ? "active" : "inactive", available: enabled, updated_at: new Date().toISOString() }).eq("id", product.id).eq("store_id", storeId);
    if (error) toast({ title: "Could not update product", description: error.message, variant: "destructive" }); else await load();
  }

  async function renewPlan(plan: PlanType) {
    if (!storeId) return;
    const price = plan === "monthly" ? MONTHLY_PRICE : WEEKLY_PRICE;
    const limit = plan === "monthly" ? INCLUDED_MONTHLY_POSTS : INCLUDED_WEEKLY_POSTS;
    const durationDays = plan === "monthly" ? MONTHLY_DURATION_DAYS : 7;
    if (walletBalance < price) { toast({ title: "Insufficient wallet balance", description: `You need GHS ${price.toFixed(2)} to renew.`, variant: "destructive" }); return; }
    setSaving(true);
    let balanceAfter: number;
    try {
      ({ balanceAfter } = await debitOwnWallet({ ownerType: storeKind, ownerId: storeId, amount: price, kind: "product_plan", reference: newOrderId(), note: `${plan} product plan` }));
    } catch (err: any) {
      toast({ title: "Renewal failed", description: err.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    onWalletBalanceChange?.(balanceAfter);
    const expires = new Date(); expires.setDate(expires.getDate() + durationDays);
    const { error: entitlementError } = await supabase.from("store_product_entitlements").upsert({ store_id: storeId, store_kind: storeKind, paid_post_limit: limit, paid_post_expires_at: expires.toISOString(), plan_type: plan, updated_at: new Date().toISOString() }, { onConflict: "store_id" });
    if (entitlementError) { toast({ title: "Plan not activated", description: "Your wallet was charged but the plan could not be activated. Contact support with this time and amount.", variant: "destructive" }); setSaving(false); return; }
    toast({ title: "Product plan renewed", description: plan === "monthly" ? "Thirty product posts are available for thirty days." : "Five product posts are available for seven days." });
    await load(); setSaving(false);
  }

  async function boostProduct(product: Product, kind: "global" | "sitewide") {
    if (!storeId) return;
    const price = kind === "sitewide" ? BOOST_SITEWIDE_PRICE : BOOST_GLOBAL_PRICE;
    if (walletBalance < price) { toast({ title: "Insufficient wallet balance", description: `You need GHS ${price.toFixed(2)} to boost this product.`, variant: "destructive" }); return; }
    setBoosting(`${product.id}-${kind}`);
    let balanceAfter: number;
    try {
      ({ balanceAfter } = await debitOwnWallet({ ownerType: storeKind, ownerId: storeId, amount: price, kind: "product_boost", reference: newOrderId(), note: `${kind} boost` }));
    } catch (err: any) {
      toast({ title: "Boost failed", description: err.message, variant: "destructive" });
      setBoosting(null);
      return;
    }
    onWalletBalanceChange?.(balanceAfter);
    const expires = new Date(); expires.setDate(expires.getDate() + BOOST_DURATION_DAYS);
    const patch = kind === "sitewide" ? { boost_sitewide: true, boost_sitewide_expires_at: expires.toISOString() } : { boost_global: true, boost_global_expires_at: expires.toISOString() };
    const { error: productError } = await supabase.from("store_products").update(patch).eq("id", product.id).eq("store_id", storeId);
    if (productError) { toast({ title: "Boost not applied", description: "Your wallet was charged but the boost could not be applied. Contact support with this time and amount.", variant: "destructive" }); setBoosting(null); return; }
    toast({ title: "Product boosted", description: kind === "sitewide" ? "This product now appears sitewide on the Package page for thirty days." : "This product now appears in Global Products for thirty days." });
    await load(); setBoosting(null);
  }

  if (!storeId) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Your store is still loading.</CardContent></Card>;
  return <div className="space-y-6">
    <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Marketplace products</CardTitle><p className="text-sm text-muted-foreground">Post products for sale across the JustBuy marketplace. Your product reaches the whole site: all agents, all customers, all subagents, all sub-subagents and visitors across the site, so you get a global reach. Buyers can place an order and contact you through your support number{supportPhone ? ` (${supportPhone})` : ""}.</p><div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground"><p className="font-semibold text-foreground">How the product session works</p><p className="mt-1">Your first product post is free. The weekly plan gives you five active product posts for seven days, while the monthly plan gives you thirty posts for thirty days. After the included posts are used, each additional post costs GHS 1. Buyers open a dedicated product page to view the images, description, price, and WhatsApp purchase button.</p><p className="mt-2"><strong>Boost to Global Products</strong> (GHS 35) promotes this product in the shared Global Products area, helping buyers outside your own storefront discover it for thirty days. <strong>Boost sitewide</strong> (GHS 40) promotes it across product listings on the Package page and storefronts, giving it broader visibility for thirty days. Boosts improve placement and reach; they do not change the product price, stock, or availability.</p><p className="mt-2">Some boosted products are also selected and posted on our WhatsApp channel for extra reach.</p></div><div role="note" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-muted-foreground"><p className="font-semibold text-destructive">Read before you post</p><p className="mt-1">Do not post anything about data, airtime, or any other service this site already offers ({PROHIBITED_TERMS_LABEL}). Posts that offer these services are detected automatically and will be deleted, and your account will be permanently deleted along with all the money left in it. Buyers can also report posts, and every report is reviewed by the admin.</p></div></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary"><Wallet className="mr-1 h-3 w-3" />Wallet: GHS {Number(walletBalance).toFixed(2)}</Badge><Badge variant="secondary">{freePostUsed ? "Free post used" : "1 free post available"}</Badge><Badge variant={activePaid ? "default" : "outline"}>{activePaid ? `${remaining} included posts left (${planType === "monthly" ? "monthly plan" : "weekly plan"})` : needsExtraCharge ? "Extra posts: GHS 1 each" : "No active plan"}</Badge>{activePaid && <span className="text-xs text-muted-foreground">Expires {new Date(expiresAt!).toLocaleDateString()}</span>}<Button size="sm" variant="outline" onClick={() => renewPlan("weekly")} disabled={saving || activePaid}><Wallet className="mr-1 h-4 w-4" />Weekly · GHS {WEEKLY_PRICE} · {INCLUDED_WEEKLY_POSTS} posts</Button><Button size="sm" variant="outline" onClick={() => renewPlan("monthly")} disabled={saving || activePaid}><Wallet className="mr-1 h-4 w-4" />Monthly · GHS {MONTHLY_PRICE} · {INCLUDED_MONTHLY_POSTS} posts</Button></div>
      {blockedTerm && <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"><p className="font-semibold">You cannot post about services this site already offers.</p><p className="mt-1">We detected the word &quot;{blockedTerm}&quot; in your post. Remove it to continue. If you persist in posting what is not allowed, your account will be permanently deleted.</p></div>}
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-3"><div><Label>Product name</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Handmade sandals" /></div><div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the product, delivery, and important details." /></div><div><Label>Price (GHS)</Label><Input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} /></div><div className="space-y-2"><Label>Payment method</Label><p className="text-xs text-muted-foreground">Direct Paystack checkout is currently unavailable for store products. Buyers can contact you on WhatsApp to arrange payment.</p><select value={paymentMode} onChange={e => setPaymentMode(e.target.value as "direct" | "whatsapp")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="direct" disabled>Accept payment directly on the site through our Paystack (Currently unavailable)</option><option value="whatsapp">Ask buyer to contact me on WhatsApp</option></select>{paymentMode === "whatsapp" && <Input value={paymentNumber} onChange={e => setPaymentNumber(e.target.value)} placeholder="WhatsApp payment number" />}</div></div><div className="space-y-3"><Label>Product images (up to 4)</Label><input ref={galleryInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleGalleryFiles} /><button type="button" onClick={() => galleryInputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center transition hover:border-primary hover:bg-primary/10"><Plus className="mb-2 h-6 w-6 text-primary" /><span className="font-medium">Choose images from gallery</span><span className="text-xs text-muted-foreground">PNG, JPG, or WebP · maximum 5 MB each</span></button>{images.length > 0 && <div className="grid grid-cols-2 gap-3">{images.map((image, index) => <div className="group relative overflow-hidden rounded-xl border" key={`${image.slice(0, 20)}-${index}`}><img src={image} alt={`Product preview ${index + 1}`} className="aspect-square w-full object-cover" /><Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2 h-8 w-8 opacity-0 transition group-hover:opacity-100" onClick={() => setImages(current => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}<p className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES} images selected</p></div></div><Button onClick={addProduct} disabled={saving || !title.trim() || !price || (needsExtraCharge && walletBalance < EXTRA_POST_PRICE)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{remaining < 1 ? "Renew to post more" : "Post product"}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Your product posts</CardTitle></CardHeader><CardContent>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : products.length === 0 ? <p className="text-sm text-muted-foreground">No products posted yet.</p> : <div className="grid gap-3 md:grid-cols-2">{products.map(product => {
      const globalActive = product.boost_global && product.boost_global_expires_at && new Date(product.boost_global_expires_at) > new Date();
      const sitewideActive = product.boost_sitewide && product.boost_sitewide_expires_at && new Date(product.boost_sitewide_expires_at) > new Date();
      return <div key={product.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{product.title}</p><p className="text-sm text-muted-foreground">GHS {Number(product.price).toFixed(2)}</p></div><Badge variant={product.status === "active" ? "default" : "outline"}>{product.status}</Badge></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {globalActive && <Badge variant="secondary">Boosted globally until {new Date(product.boost_global_expires_at!).toLocaleDateString()}</Badge>}
          {sitewideActive && <Badge variant="secondary">Boosted sitewide until {new Date(product.boost_sitewide_expires_at!).toLocaleDateString()}</Badge>}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => toggleProduct(product)}>{product.status === "active" && product.available ? "Disable" : "Enable"}</Button>
          <Button size="sm" variant="outline" disabled={boosting === `${product.id}-global` || Boolean(globalActive)} onClick={() => boostProduct(product, "global")}>{globalActive ? "Boosted globally" : `Boost to Global Products · GHS ${BOOST_GLOBAL_PRICE}`}</Button>
          <Button size="sm" variant="outline" disabled={boosting === `${product.id}-sitewide` || Boolean(sitewideActive)} onClick={() => boostProduct(product, "sitewide")}>{sitewideActive ? "Boosted sitewide" : `Boost sitewide · GHS ${BOOST_SITEWIDE_PRICE}`}</Button>
        </div>
      </div>;
    })}</div>}</CardContent></Card>
  </div>;
}
