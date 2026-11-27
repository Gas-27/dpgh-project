import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ApprovedSender = { id: string; sender_id: string };

export default function SenderIdApprovedPopup({ disabled = false }: { disabled?: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  const { data: senders = [] } = useQuery({
    queryKey: ["unseen-approved-sender-ids"],
    enabled: !disabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ApprovedSender[]> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const { data, error } = await (supabase as any).rpc("my_unseen_approved_sender_ids");
      if (error) return [];
      return (data || []) as ApprovedSender[];
    },
  });

  const open = !dismissed && senders.length > 0;

  const acknowledge = async () => {
    setDismissed(true);
    await (supabase as any).rpc("mark_sender_ids_approval_seen", { p_ids: senders.map((s) => s.id) });
  };

  const names = senders.map((s) => s.sender_id);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) void acknowledge(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <BadgeCheck className="h-8 w-8" aria-hidden="true" />
          </span>
          <DialogTitle className="mt-2 text-xl">
            {names.length > 1 ? "Your sender IDs are approved" : "Your sender ID is approved"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {names.length > 1 ? "These sender IDs you submitted have" : "The sender ID you submitted has"} been approved by our team and
            you can now use {names.length > 1 ? "them" : "it"} to send SMS.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-wrap justify-center gap-2">
          {names.map((name) => (
            <li key={name} className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-500">
              {name}
            </li>
          ))}
        </ul>
        <Button onClick={() => void acknowledge()} className="w-full">Got it</Button>
      </DialogContent>
    </Dialog>
  );
}
