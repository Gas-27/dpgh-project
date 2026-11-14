import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface ProgressKeyFieldProps {
  progressKey: string | null;
}

export function ProgressKeyField({ progressKey }: ProgressKeyFieldProps) {
  if (!progressKey) return null;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(progressKey);
      toast({ title: "Copied", description: "Delivery progress key copied to clipboard" });
    } catch {
      toast({ title: "Error", description: "Could not copy the key. Please copy it manually.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="delivery-progress-key" className="text-sm">
        Delivery Progress Key (read-only, safe for your website)
      </Label>
      <div className="flex gap-2">
        <Input id="delivery-progress-key" value={progressKey} readOnly className="font-mono text-xs" />
        <Button type="button" variant="outline" size="sm" onClick={copyKey} className="gap-2">
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        This key can only read the delivery progress card. It cannot place orders or read your wallet.
      </p>
    </div>
  );
}
