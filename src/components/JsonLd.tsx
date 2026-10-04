import { useEffect } from "react";

type JsonLdProps = { data: Record<string, unknown> | Record<string, unknown>[] };

export default function JsonLd({ data }: JsonLdProps) {
  useEffect(() => {
    const id = "dataplug-json-ld";
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
    return () => script?.remove();
  }, [data]);
  return null;
}
