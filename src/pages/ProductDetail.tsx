import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ProductDetail() {
  const { storeName, productId } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  useEffect(() => {
    async function load() {
      const { data: owner } = await supabase.from("agent_stores").select("id,store_name,support_number,whatsapp_number").eq("store_name", storeName).maybeSingle();
      if (!owner) return;
      const { data: item } = await supabase.from("store_products").select("id,title,description,price,image_urls").eq("id", productId).eq("store_id", owner.id).eq("status", "active").eq("available", true).maybeSingle();
      setStore(owner); setProduct(item);
    }
    void load();
  }, [productId, storeName]);
  if (!product) return <main className="mx-auto max-w-3xl p-6"><p className="text-muted-foreground">Product not found or no longer available.</p></main>;
  const digits = String(store?.whatsapp_number || store?.support_number || "").replace(/\D/g, "");
  const message = encodeURIComponent(`Hello, I want to buy ${product.title} for GHS ${Number(product.price).toFixed(2)}.`);
  return <main className="mx-auto max-w-4xl p-4 md:p-8"><Card><CardContent className="grid gap-6 p-5 md:grid-cols-2 md:p-8"><div className="grid grid-cols-2 gap-3">{(product.image_urls?.length ? product.image_urls : [null]).map((image: string | null, index: number) => image ? <img key={image} src={image} alt={`${product.title} ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" /> : <div key="empty" className="aspect-square rounded-xl bg-muted" />)}</div><div className="flex flex-col justify-center gap-4"><p className="text-sm text-muted-foreground">{store.store_name}</p><h1 className="text-3xl font-bold text-balance">{product.title}</h1><p className="text-2xl font-semibold text-primary">GHS {Number(product.price).toFixed(2)}</p><p className="whitespace-pre-wrap text-muted-foreground">{product.description}</p>{digits ? <Button asChild><a href={`https://wa.me/${digits}?text=${message}`} target="_blank" rel="noopener noreferrer">Buy on WhatsApp</a></Button> : <p className="text-sm text-muted-foreground">Contact the seller for purchase details.</p>}</div></CardContent></Card></main>;
}
