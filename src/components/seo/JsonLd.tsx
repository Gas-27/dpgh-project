interface JsonLdProps {
  data: unknown | unknown[] | null | undefined;
}

export default function JsonLd({ data }: JsonLdProps) {
  if (!data) return null;
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.filter(Boolean).map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
