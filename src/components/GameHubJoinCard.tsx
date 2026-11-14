import { useState } from "react";
import { Banknote, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import SubagentRegistrationForm from "@/components/SubagentRegistrationForm";
import SubSubagentRegistrationForm from "@/components/SubSubagentRegistrationForm";
import { useGameHubStoreContext } from "@/lib/gameHubStoreContext";

const COPY = {
  agent: { button: "Sign up as agent now", lead: "Become an agent of this store" },
  subagent: { button: "Become an agent now", lead: "Become an agent under this store" },
  subsubagent: { button: "Become an agent now", lead: "Become an agent under this store" },
  user: { button: "Sign up now", lead: "Create your free account" },
} as const;

export default function GameHubJoinCard({ signedIn }: { signedIn: boolean }) {
  const storeContext = useGameHubStoreContext();
  const [formOpen, setFormOpen] = useState(false);

  if (signedIn) return null;

  const copy = COPY[storeContext?.kind ?? "user"];

  const handleClick = () => {
    if (storeContext) setFormOpen(true);
    else window.location.assign("/signup");
  };

  return (
    <section className="mb-4 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-violet-900/60 to-amber-500/10 p-4" aria-label="Sign up to unlock the full Game Hub">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300"><Trophy className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-bold text-white">{copy.lead} to unlock the full Game Hub</h3>
          <p className="text-xs leading-relaxed text-violet-100/80">
            You are playing as a guest. With an account you get the whole Game Hub experience, your scores on the leaderboard, chat with other players, and a real chance to win cash
            {" "}<Banknote className="inline h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> paid straight into your account balance.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        className="mt-3 w-full rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-[#1a0b3b] hover:bg-amber-300"
      >
        {copy.button}
      </button>

      {storeContext ? (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto p-4">
            <DialogTitle className="sr-only">Sign up under {storeContext.storeName}</DialogTitle>
            <DialogDescription className="sr-only">Create your account under {storeContext.storeName}.</DialogDescription>
            {storeContext.kind === "agent" ? (
              <SubagentRegistrationForm
                agentStoreId={storeContext.storeId}
                agentStoreName={storeContext.storeName}
                primaryColor={storeContext.primaryColor}
                primaryForeground={storeContext.primaryForeground}
                onClose={() => setFormOpen(false)}
              />
            ) : (
              <SubSubagentRegistrationForm
                subagentStoreId={storeContext.storeId}
                subagentStoreName={storeContext.storeName}
                primaryColor={storeContext.primaryColor}
                primaryForeground={storeContext.primaryForeground}
                onClose={() => setFormOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
