import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Store, ChevronRight } from "lucide-react";

export interface SourceInfo {
  type: "direct" | "subagent" | "subsubagent" | "api";
  // The store that originated the order
  storeName: string;
  storeUrl?: string;
  storePhone?: string;
  storeWhatsapp?: string;
  // Parent chain (only for subsubagent orders)
  parentSubagentName?: string;
  parentSubagentUrl?: string;
  parentAgentName?: string;
  parentAgentUrl?: string;
  // For subagent orders shown in agent dashboard
  agentName?: string;
  agentUrl?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  info: SourceInfo | null;
}

export function SourceInfoDialog({ open, onClose, info }: Props) {
  if (!info) return null;

  const typeLabel = info.type === "subsubagent"
    ? "Sub-Subagent Store"
    : info.type === "subagent"
    ? "Subagent Store"
    : info.type === "api"
    ? "API"
    : "Direct";

  const typeBadgeClass = info.type === "subsubagent"
    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
    : info.type === "subagent"
    ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
    : info.type === "api"
    ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
    : "bg-blue-500/10 text-blue-400 border-blue-500/30";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            Order Source
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type badge */}
          <Badge variant="outline" className={`text-xs ${typeBadgeClass}`}>
            {typeLabel}
          </Badge>

          {/* Store details */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Store</p>
            <p className="font-semibold text-foreground">{info.storeName}</p>
            {info.storePhone && (
              <p className="text-sm text-muted-foreground">{info.storePhone}</p>
            )}
            {info.storeUrl && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-1 text-xs"
                onClick={() => window.open(info.storeUrl, "_blank")}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Store
              </Button>
            )}
          </div>

          {/* Hierarchy chain for sub-subagent orders */}
          {info.type === "subsubagent" && (info.parentSubagentName || info.parentAgentName) && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Hierarchy</p>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-xs">Sub-Subagent:</span>
                  <span className="font-medium text-foreground truncate">{info.storeName}</span>
                </div>
                {info.parentSubagentName && (
                  <>
                    <ChevronRight className="w-3 h-3 text-muted-foreground ml-1" />
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">Under Subagent:</span>
                      <span className="font-medium text-foreground truncate">{info.parentSubagentName}</span>
                      {info.parentSubagentUrl && (
                        <button
                          onClick={() => window.open(info.parentSubagentUrl, "_blank")}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
                {info.parentAgentName && (
                  <>
                    <ChevronRight className="w-3 h-3 text-muted-foreground ml-1" />
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">Under Agent:</span>
                      <span className="font-medium text-foreground truncate">{info.parentAgentName}</span>
                      {info.parentAgentUrl && (
                        <button
                          onClick={() => window.open(info.parentAgentUrl, "_blank")}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Parent info for subagent order shown in agent dashboard */}
          {info.type === "subagent" && info.agentName && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Under Agent</p>
              <p className="font-medium text-foreground">{info.agentName}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
