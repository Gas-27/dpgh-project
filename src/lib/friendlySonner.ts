import { toast as sonnerToast } from "sonner";
import { getFriendlyBlockedMessage } from "@/lib/blockedMessages";

type Fn = (message: any, data?: any) => any;

function friendlyArgs(message: unknown, data: any): [unknown, any] {
  const friendlyDescription =
    data && typeof data.description === "string" ? getFriendlyBlockedMessage(data.description) : null;
  const nextData = friendlyDescription ? { ...data, description: friendlyDescription } : data;
  const friendlyTitle = typeof message === "string" ? getFriendlyBlockedMessage(message) : null;
  return [friendlyTitle ?? message, nextData];
}

function wrap(fn: Fn): Fn {
  return (message, data) => {
    const [nextMessage, nextData] = friendlyArgs(message, data);
    return fn(nextMessage, nextData);
  };
}

// Same API as sonner's toast, but blocked-number / frozen-wallet errors get friendly text.
export const toast = Object.assign(wrap(sonnerToast as unknown as Fn), sonnerToast, {
  error: wrap(sonnerToast.error as unknown as Fn),
  warning: wrap(sonnerToast.warning as unknown as Fn),
  info: wrap(sonnerToast.info as unknown as Fn),
  message: wrap(sonnerToast.message as unknown as Fn),
}) as typeof sonnerToast;
