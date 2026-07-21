import { useState } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; description: string }
> = {
  delivered: {
    label: "Delivered",
    className: "bg-green-600/20 text-green-400 border border-green-600/30",
    description:
      "Your data has been successfully delivered to the recipient number.",
  },
  completed: {
    label: "Completed",
    className: "bg-green-600/20 text-green-400 border border-green-600/30",
    description: "This order has been fully processed and completed.",
  },
  processing: {
    label: "Processing",
    className: "bg-blue-600/20 text-blue-400 border border-blue-600/30",
    description:
      "Your order is currently being processed. This usually takes a few seconds.",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30",
    description:
      "Your order is queued and waiting to be picked up for processing.",
  },
  waiting: {
    label: "Waiting for Portal",
    className: "bg-purple-600/20 text-purple-400 border border-purple-600/30",
    description:
      "The order is waiting for the network provider portal to become available. This may take a few minutes.",
  },
  waiting_for_portal: {
    label: "Waiting for Portal",
    className: "bg-purple-600/20 text-purple-400 border border-purple-600/30",
    description:
      "The order is waiting for the network provider portal to become available. This may take a few minutes.",
  },
  failed: {
    label: "Failed",
    className: "bg-red-600/20 text-red-400 border border-red-600/30",
    description:
      "This order could not be delivered. Please contact support if the issue persists.",
  },
  refunded: {
    label: "Refunded",
    className: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    description:
      "The payment for this order has been refunded to your wallet or payment method.",
  },
  number_verifying: {
    label: "Number Verifying",
    className: "bg-cyan-600/20 text-cyan-400 border border-cyan-600/30",
    description:
      "The recipient number is being verified against the network before delivery.",
  },
  verifying: {
    label: "Verifying",
    className: "bg-cyan-600/20 text-cyan-400 border border-cyan-600/30",
    description:
      "The recipient number is being verified against the network before delivery.",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-zinc-600/20 text-zinc-400 border border-zinc-600/30",
    description: "This order was cancelled and will not be processed.",
  },
};

const DEFAULT_CONFIG = {
  label: "Unknown",
  className: "bg-zinc-600/20 text-zinc-400 border border-zinc-600/30",
  description: "The current status of this order is not recognised.",
};

function normalizeStatus(raw: string | undefined | null): string {
  if (!raw) return "pending";
  return raw.toLowerCase().trim().replace(/\s+/g, "_");
}

interface OrderStatusBadgeProps {
  status: string | undefined | null;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const key = normalizeStatus(status);
  const config = STATUS_CONFIG[key] ?? DEFAULT_CONFIG;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-help ${config.className}`}
          >
            {config.label}
            <Info className="h-3 w-3 flex-shrink-0 opacity-70" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs leading-relaxed"
        >
          {config.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
