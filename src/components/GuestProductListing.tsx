import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadGuestProductImage } from "@/lib/productImageUpload";
import { GHANA_REGIONS } from "@/lib/ghanaRegions";
import { PROHIBITED_TERMS_LABEL, findProhibitedTerm, prohibitedTermFromError } from "@/lib/marketplaceRules";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 4;
const PLANS = [
  { id: "weekly", label: "1 week", price: 2 },
  { id: "monthly", label: "1 month", price: 5 },
  { id: "monthly_boost", label: "1 month + Boost", price: 20 },
] as const;

type Plan = (typeof PLANS)[number]["id"];

export default function GuestProductListing({ storeId, storeKind }: { storeId: string; storeKind: "agent" | "subagent" | "subsubagent" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [region, setRegion] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [plan, setPlan] = useState<Plan>("weekly");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("guest_product");
    if (!productId) return;
    let cancelled = false;
    const clearParam = () => {
      params.delete("guest_product");
      params.delete("reference");
      params.delete("trxref");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    };
    toast({ title: "Confirming your payment", description: "Your product will appear as soon as the payment is confirmed." });
    const check = async (attempt: number) => {
      const { data } = await (supabase as any).from("store_products").select("id").eq("id", productId).eq("status", "active").maybeSingle();
      if (cancelled) return;
      if (data) {
        toast({ title: "Your product is live", description: "It is now showing on this store's products page." });
        clearParam();
        return;
      }
      if (attempt >= 12) {
        toast({ title: "Payment received", description: "Your product may take a minute to appear. Refresh the page shortly." });
        clearParam();
        return;
      }
      window.setTimeout(() => check(attempt + 1), 4000);
    };
    check(0);
    return () => { cancelled = true; };
  }, [toast]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    const selected = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > room) toast({ title: `Only ${MAX_IMAGES} images allowed`, variant: "destructive" });
    setUploading((count) => count + selected.length);
    await Promise.all(selected.map(async (file) => {
      try {
        const url = await uploadGuestProductImage(file);
        setImages((current) => (current.length < MAX_IMAGES ? [...current, url] : current));
      } catch {
        toast({ title: "Image upload failed, please try again", variant: "destructive" });
      } finally {
        setUploading((count) => count - 1);
      }
    }));
    if (fileInput.current) fileInput.current.value = "";
  }

  const fee = PLANS.find((item) => item.id === plan)!.price;
  const numberValid = /^\+?\d{9,15}$/.test(whatsapp.replace(/[\s-]/g, ""));
  const ready = title.trim().length >= 2 && Number(price) > 0 && numberValid && images.length > 0 && uploading === 0;

  async function submit() {
    const blockedTerm = findProhibitedTerm(`${title} ${description}`);
    if (blockedTerm) {
      toast({ title: "You cannot post about this service", description: `The word "${blockedTerm}" was detected. ${PROHIBITED_TERMS_LABEL}`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: productId, error } = await (supabase as any).rpc("create_guest_store_product", {
        p_store_kind: storeKind,
        p_store_id: storeId,
        p_title: title.trim(),
        p_description: description.trim(),
        p_price: Number(price),
        p_region: region,
        p_image_urls: images,
        p_whatsapp: whatsapp.replace(/[\s-]/g, ""),
        p_plan: plan,
      });
      const term = prohibitedTermFromError(error?.message);
      if (term) throw new Error(`The word "${term}" is not allowed in product listings.`);
      if (error || !productId) throw new Error(error?.message || "Could not save your product");

      const callbackUrl = `${window.location.origin}${window.location.pathname}?guest_product=${productId}`;
      const { data: payment, error: paymentError } = await supabase.functions.invoke("initialize-payment", {
        body: { callback_url: callbackUrl, metadata: { type: "guest_product", product_id: productId } },
      });
      if (paymentError || !payment?.authorization_url) throw new Error(payment?.error || paymentError?.message || "Could not start payment");
      window.location.href = payment.authorization_url;
    } catch (error) {
      toast({ title: "Could not continue", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="mt-4">
        <Plus className="mr-2 h-4 w-4" /> Post your product
      </Button>
      <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post your product</DialogTitle>
            <DialogDescription>Add your product to this store. Buyers will contact you on the WhatsApp number you enter. You pay after adding your details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label htmlFor="guest-title" className="text-sm font-medium">Product name</label>
              <Input id="guest-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="guest-description" className="text-sm font-medium">Description</label>
              <Textarea id="guest-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="guest-price" className="text-sm font-medium">Price (GHS)</label>
                <Input id="guest-price" type="number" inputMode="decimal" min="0" value={price} onChange={(event) => setPrice(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="guest-region" className="text-sm font-medium">Region</label>
                <select id="guest-region" value={region} onChange={(event) => setRegion(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select a region</option>
                  {GHANA_REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="guest-whatsapp" className="text-sm font-medium">WhatsApp number</label>
              <Input id="guest-whatsapp" type="tel" inputMode="tel" placeholder="0241234567" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Product images (up to {MAX_IMAGES})</p>
              <div className="grid grid-cols-4 gap-2">
                {images.map((url) => (
                  <div key={url} className="relative aspect-square overflow-hidden rounded-md border">
                    <img src={url} alt="Selected product" className="h-full w-full object-cover" />
                    <button type="button" aria-label="Remove image" onClick={() => setImages((current) => current.filter((item) => item !== url))} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {Array.from({ length: uploading }).map((_, index) => (
                  <div key={`uploading-${index}`} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border text-[10px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Uploading…</div>
                ))}
                {images.length + uploading < MAX_IMAGES && (
                  <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-square items-center justify-center rounded-md border border-dashed text-muted-foreground" aria-label="Add image"><Plus className="h-5 w-5" /></button>
                )}
              </div>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(event) => onFiles(event.target.files)} />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">How long should it show?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PLANS.map((item) => (
                  <button key={item.id} type="button" onClick={() => setPlan(item.id)} aria-pressed={plan === item.id} className={cn("rounded-md border p-3 text-left text-sm", plan === item.id ? "border-primary bg-primary/10" : "border-border")}>
                    <span className="block font-semibold">GH₵{item.price}</span>
                    <span className="text-xs text-muted-foreground">Shown for {item.label}</span>
                  </button>
                ))}
              </div>
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">What is Boost?</p>
                <p>
                  With the GH₵20 plan your product is listed for 1 month and boosted for 1 month. A boosted product is pinned at the top of the
                  marketplace so it always stays in front of buyers, and it is also shown in the Game Hub, where every player sees it while they play.
                  That means far more people see your product and contact you on WhatsApp.
                </p>
              </div>
            </fieldset>
            <Button type="button" className="w-full" onClick={submit} disabled={!ready || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading > 0 ? "Uploading images…" : `Continue to payment · GH₵${fee}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
