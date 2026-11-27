import { Link } from "react-router-dom";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/data/seo/schema.mjs";

export interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {items.map((item, index) => (
            <li key={item.label} className="flex items-center gap-2">
              {item.to && index < items.length - 1 ? (
                <Link to={item.to} className="hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={index === items.length - 1 ? "page" : undefined} className="text-foreground">
                  {item.label}
                </span>
              )}
              {index < items.length - 1 && <span aria-hidden="true">/</span>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbSchema(items)} />
    </>
  );
}
