import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  variant?: "card" | "row";
  children: ReactNode;
};

// Children are only mounted while the section is open, so anything that fetches data
// inside them waits until the admin actually opens the dropdown.
export default function CollapsibleSection({ title, description, icon, badge, defaultOpen = false, forceOpen = false, variant = "card", children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = open || forceOpen;
  const isCard = variant === "card";

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setOpen}
      className={cn(isCard ? "rounded-2xl border border-cyan-500/30 bg-cyan-500/5" : "rounded-xl border bg-background")}
    >
      <CollapsibleTrigger className={cn("flex w-full items-center justify-between gap-3 text-left", isCard ? "p-4" : "px-3 py-2.5")}>
        <span className="flex min-w-0 items-start gap-3">
          {icon}
          <span className="min-w-0">
            <span className={cn("flex flex-wrap items-center gap-2 font-semibold", isCard ? "text-lg" : "text-sm")}>
              {title}
              {badge}
            </span>
            {description && <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{description}</span>}
          </span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isOpen && <div className={cn(isCard ? "px-4 pb-4" : "px-3 pb-3")}>{children}</div>}
      </CollapsibleContent>
    </Collapsible>
  );
}
