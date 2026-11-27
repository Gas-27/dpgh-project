import { Link } from "react-router-dom";
import { networkLabel, usePrices1GB, useSubscriptionServices } from "@/hooks/useSeoLiveData";

const formatGhs = (value: number) => `GH₵${value.toFixed(2)}`;

function Prices1GBWidget() {
  const { data, isLoading, isError } = usePrices1GB();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading today&apos;s prices…</p>;
  if (isError || !data?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Live 1GB prices are shown on the <Link to="/packages" className="underline">data packages page</Link>.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {data.map((row) => (
        <li key={row.network} className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">{networkLabel(row.network)} 1GB</p>
          <p className="text-xl font-bold text-foreground">{formatGhs(row.price)}</p>
        </li>
      ))}
    </ul>
  );
}

function SubscriptionListWidget() {
  const { data, isLoading, isError } = useSubscriptionServices();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading available subscriptions…</p>;
  if (isError || !data?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        See every available service on the <Link to="/subscription" className="underline">subscription page</Link>.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {data.map((service) => (
        <article key={service.id} className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-lg font-semibold text-foreground">{service.name} in Ghana</h3>
          {service.description && <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>}
          <p className="mt-2 text-sm text-foreground">
            Price: <span className="font-semibold">{service.isFree || service.price <= 0 ? "Free" : formatGhs(service.price)}</span>
          </p>
        </article>
      ))}
    </div>
  );
}

export default function SeoWidget({ name }: { name: string }) {
  if (name === "prices1gb") return <Prices1GBWidget />;
  if (name === "subscriptionList") return <SubscriptionListWidget />;
  return null;
}
