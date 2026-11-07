import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AlreadyReportedButton({ full = false }: { full?: boolean }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled
      aria-disabled="true"
      className={full ? "w-full border-muted-foreground/30 text-muted-foreground" : "border-muted-foreground/30 text-muted-foreground"}
    >
      <CheckCircle className="mr-2 h-4 w-4" />
      Already reported
    </Button>
  );
}
