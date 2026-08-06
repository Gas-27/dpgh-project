import { useState } from "react";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
      "Order sent to MTN for delivery.\nYour order is being processed by the network. The status will update automatically once delivered.",
  },
  pending: {
    label: "Order Placed",
    className: "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30",
    description:
      "Order is placed and sent to the portal and now waiting for the portal to pick it up for processing.\nYour order has been received and is in the queue. It will be picked up by the portal for processing shortly.",
  },
  "in-queue": {
    label: "In Queue",
    className: "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30",
    description: "Payment is complete and the order is waiting for fulfillment.",
  },
  waiting: {
    label: "Number Verifying",
    className: "bg-cyan-600/20 text-cyan-400 border border-cyan-600/30",
    description:
      "Your number is being added to our beneficiary list.\nMTN's new rule requires your number to be part of our beneficiary list before you can make purchases through our MTN portal. Your number is now being added and we're submitting your contact to MTN for approval. This is a one-time process. Once MTN approves and adds your contact to their list, your order will start processing immediately. Every new order from your contact will then go smoothly straight to processing.",
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
      "Your number is being added to our beneficiary list.\nMTN's new rule requires your number to be part of our beneficiary list before you can make purchases through our MTN portal. Your number is now being added and we're submitting your contact to MTN for approval. This is a one-time process. Once MTN approves and adds your contact to their list, your order will start processing immediately. Every new order from your contact will then go smoothly straight to processing.",
  },
  verifying: {
    label: "Number Verifying",
    className: "bg-cyan-600/20 text-cyan-400 border border-cyan-600/30",
    description:
      "Your number is being added to our beneficiary list.\nMTN's new rule requires your number to be part of our beneficiary list before you can make purchases through our MTN portal. Your number is now being added and we're submitting your contact to MTN for approval. This is a one-time process. Once MTN approves and adds your contact to their list, your order will start processing immediately. Every new order from your contact will then go smoothly straight to processing.",
  },
  contact: {
    label: "Number Verifying",
    className: "bg-cyan-600/20 text-cyan-400 border border-cyan-600/30",
    description:
      "Your number is being added to our beneficiary list.\nMTN's new rule requires your number to be part of our beneficiary list before you can make purchases through our MTN portal. Your number is now being added and we're submitting your contact to MTN for approval. This is a one-time process. Once MTN approves and adds your contact to their list, your order will start processing immediately. Every new order from your contact will then go smoothly straight to processing.",
  },
  adding_contact: {
    label: "Number Verifying",
    className: "bg-cyan-600/20 text-cyan-400 border border-cyan-600/30",
    description:
      "Your number is being added to our beneficiary list.\nMTN's new rule requires your number to be part of our beneficiary list before you can make purchases through our MTN portal. Your number is now being added and we're submitting your contact to MTN for approval. This is a one-time process. Once MTN approves and adds your contact to their list, your order will start processing immediately. Every new order from your contact will then go smoothly straight to processing.",
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
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer select-none ${config.className}`}
        >
          {config.label}
          <Info className="h-3 w-3 flex-shrink-0 opacity-70" />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="max-w-sm text-xs leading-relaxed p-3"
      >
        {config.description.split("\n").map((line, i) => (
          <p key={i} className={i > 0 ? "mt-1.5" : ""}>{line}</p>
        ))}
      </PopoverContent>
    </Popover>
  );
}
