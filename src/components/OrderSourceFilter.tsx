import { Button } from "@/components/ui/button";
import { ORDER_SOURCE_LABELS, type OrderSourceFilterKey } from "@/lib/orderSource";

interface OrderSourceFilterProps {
  value: OrderSourceFilterKey;
  onChange: (value: OrderSourceFilterKey) => void;
  options: OrderSourceFilterKey[];
  counts: Partial<Record<OrderSourceFilterKey, number>>;
}

export function OrderSourceFilter({ value, onChange, options, counts }: OrderSourceFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter orders by source">
      {options.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={value === option ? "default" : "outline"}
          onClick={() => onChange(option)}
          className="text-xs"
          aria-pressed={value === option}
        >
          {ORDER_SOURCE_LABELS[option]}
          <span className="ml-1.5 rounded-full bg-background/20 px-1.5 text-[10px] font-semibold">{counts[option] ?? 0}</span>
        </Button>
      ))}
    </div>
  );
}
