import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteMyApiKey } from "@/lib/apiKeyAccount";

interface DeleteApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
  onDeleted: () => void;
}

export default function DeleteApiKeyDialog({ open, onOpenChange, walletBalance, onDeleted }: DeleteApiKeyDialogProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const cleared = await deleteMyApiKey();
      toast({
        title: "API key deleted",
        description: cleared > 0 ? `GHC ${cleared.toFixed(2)} was cleared from your API wallet.` : "Your API key has been removed.",
      });
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast({
        title: "Could not delete API key",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete API key?
          </DialogTitle>
          <DialogDescription>
            This permanently removes your API key. Any website or app using it will stop working immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
          <p className="font-semibold text-destructive">Your API wallet will be cleared</p>
          <p className="text-muted-foreground">
            Deleting your API key also clears the money in your API wallet
            {walletBalance > 0 ? <> (currently <span className="font-semibold text-foreground">GHC {walletBalance.toFixed(2)}</span>)</> : null}.
            That balance cannot be recovered or moved to another wallet, so spend it through your API first if you still need it.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Keep my key
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete key and clear wallet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
