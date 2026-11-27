import { UserPlus } from "lucide-react";
import { getBecomeAgentUrl, useGameHubStoreContext } from "@/lib/gameHubStoreContext";

type Props = {
  className?: string;
};

export default function GameHubBecomeAgentButton({ className }: Props) {
  const storeCtx = useGameHubStoreContext();
  const href = getBecomeAgentUrl(storeCtx);

  return (
    <a
      href={href}
      target="_top"
      className={
        className ??
        "flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-3 text-sm font-bold text-emerald-950"
      }
    >
      <UserPlus className="h-4 w-4" aria-hidden="true" />
      Become an agent{storeCtx ? ` of ${storeCtx.kind === "subsubagent" && storeCtx.parentStoreName ? storeCtx.parentStoreName : storeCtx.storeName}` : ""}
    </a>
  );
}
