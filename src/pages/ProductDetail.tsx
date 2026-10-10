import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
}

export default function ProductDetail() {
  const navigate = useNavigate();
  const { storeName, productId } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let owner: any = null;
      let item: any = null;

      if (storeName) {
        const ownerResult = await supabase.from("agent_stores").select("id,store_name,support_number,whatsapp_number").eq("store_name", storeName).maybeSingle();
        owner = ownerResult.data;
        if (owner && productId) {
          const itemResult = await supabase.from("store_products").select("id,title,description,price,image_urls,store_id").eq("id", productId).eq("store_id", owner.id).eq("status", "active").eq("available", true).maybeSingle();
          item = itemResult.data;
        }
      } else if (productId) {
        const storeResult = await supabase.from("store_products").select("id,title,description,price,image_urls,store_id,store_kind,status,available").eq("id", productId).eq("status", "active").eq("available", true).maybeSingle();
        item = storeResult.data;
        if (item?.store_id) {
          const table = item.store_kind === "subagent" ? "subagent_stores" : item.store_kind === "subsubagent" ? "sub_subagent_stores" : "agent_stores";
          const ownerResult = await supabase.from(table).select("id,store_name,support_number,whatsapp_number").eq("id", item.store_id).maybeSingle();
          owner = ownerResult.data;
        }
        if (!item) {
          const adminResult = await supabase.from("public_store_products").select("id,title,description,price,image_urls,active").eq("id", productId).eq("active", true).maybeSingle();
          item = adminResult.data;
          owner = item ? { store_name: "Marketplace", support_number: null, whatsapp_number: null } : null;
        }
      }

      if (!cancelled) {
        setStore(owner);
        setProduct(item);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [productId, storeName]);

  if (loading) return <main className="mx-auto max-w-3xl p-6"><p className="text-muted-foreground">Loading product...</p></main>;
  useEffect(() => {
    if (!product) return;
    const title = `${product.title} | JustBuyGH Marketplace`;
    const description = product.description || `Buy ${product.title} on JustBuyGH Marketplace.`;
    const image = product.image_urls?.[0] || `${window.location.origin}/justbuygh-icon.png`;
    const url = window.location.href;
    document.title = title;
    const tags = [
      ["property", "og:title", title],
      ["property", "og:description", description],
      ["property", "og:image", image],
      ["property", "og:url", url],
      ["name", "twitter:title", title],
      ["name", "twitter:description", description],
      ["name", "twitter:image", image],
    ];
    tags.forEach(([attribute, key, content]) => {
      const selector = `meta[${attribute}="${key}"]`;
      const meta = document.querySelector<HTMLMetaElement>(selector) || document.head.appendChild(Object.assign(document.createElement("meta"), { [attribute]: key }));
      meta.setAttribute(attribute, key);
      meta.content = content;
    });
  }, [product]);

  if (!product) return <main className="mx-auto max-w-3xl p-6"><p className="text-muted-foreground">Product not found or no longer available.</p></main>;

  const rawDigits = String(store?.whatsapp_number || store?.support_number || "").replace(/\D/g, "");
  const digits = rawDigits.startsWith("233") ? rawDigits.slice(0, 12) : rawDigits.startsWith("0") ? `233${rawDigits.slice(1, 10)}` : rawDigits.length === 9 ? `233${rawDigits}` : rawDigits;
  const productUrl = new URL(`/marketplace/product/${product.id}/${slugify(product.title)}`, window.location.origin).toString();
  const message = encodeURIComponent([
    `Hello, I want to buy ${product.title} for GHS ${Number(product.price).toFixed(2)}.`,
    `Details: ${product.description || "No description provided"}`,
    `Product page: ${productUrl}`,
  ].join("\n"));

  return <main className="mx-auto max-w-4xl p-4 md:p-8">
    <Card><CardContent className="grid gap-6 p-5 md:grid-cols-2 md:p-8">
      <div className="grid grid-cols-2 gap-3">{(product.image_urls?.length ? product.image_urls : [null]).map((image: string | null, index: number) => image ? <img key={image} src={image} alt={`${product.title} ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" /> : <div key="empty" className="aspect-square rounded-xl bg-muted" />)}</div>
      <div className="flex flex-col justify-center gap-4"><p className="text-sm text-muted-foreground">{store?.store_name}</p><h1 className="text-3xl font-bold text-balance">{product.title}</h1><p className="text-2xl font-semibold text-primary">GHS {Number(product.price).toFixed(2)}</p><p className="whitespace-pre-wrap text-muted-foreground">{product.description}</p>{digits ? <Button asChild><a href={`https://wa.me/${digits}?text=${message}`} target="_blank" rel="noopener noreferrer">Buy on WhatsApp</a></Button> : <p className="text-sm text-muted-foreground">Contact the seller for purchase details.</p>}<Button variant="outline" onClick={() => navigate(-1)}>Back to products</Button></div>
    </CardContent></Card>
  </main>;
}

// Product images are stored as Supabase Storage public URLs when published, so this page
// displays the stored image directly and the WhatsApp message shares this stable page URL.
