import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Answer = "yes" | "no" | "";

interface ApiKeyConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function YesNoQuestion({ id, question, value, onChange }: { id: string; question: string; value: Answer; onChange: (value: Answer) => void }) {
  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{question}</legend>
      <RadioGroup value={value} onValueChange={(next) => onChange(next as Answer)} className="flex gap-6">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="yes" id={`${id}-yes`} />
          <Label htmlFor={`${id}-yes`}>Yes</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="no" id={`${id}-no`} />
          <Label htmlFor={`${id}-no`}>No</Label>
        </div>
      </RadioGroup>
    </fieldset>
  );
}

export default function ApiKeyConsentDialog({ open, onOpenChange, onConfirm }: ApiKeyConsentDialogProps) {
  const [knowsApi, setKnowsApi] = useState<Answer>("");
  const [hasWebsite, setHasWebsite] = useState<Answer>("");
  const [understands, setUnderstands] = useState(false);

  useEffect(() => {
    if (!open) {
      setKnowsApi("");
      setHasWebsite("");
      setUnderstands(false);
    }
  }, [open]);

  const answeredNo = knowsApi === "no" || hasWebsite === "no";
  const canContinue = knowsApi === "yes" && hasWebsite === "yes" && understands;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Before you generate an API key</DialogTitle>
          <DialogDescription>Answer these questions to continue. An API key is only for people who run their own system.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <YesNoQuestion id="api-consent-knows" question="1. Do you know what an API is?" value={knowsApi} onChange={setKnowsApi} />
          <YesNoQuestion
            id="api-consent-website"
            question="2. Do you have your own website or system that you built, or are you building one?"
            value={hasWebsite}
            onChange={setHasWebsite}
          />

          {answeredNo && (
            <div role="alert" className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                If you do not know what you are doing, do not proceed to generate an API key. You do not need one to buy data, social boost, utilities and more
                on this site. Close this window and use your dashboard instead.
              </p>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox id="api-consent-understand" checked={understands} onCheckedChange={(checked) => setUnderstands(checked === true)} className="mt-0.5" />
            <Label htmlFor="api-consent-understand" className="text-sm font-normal leading-relaxed">
              3. I understand an API key lets my own system connect to your platform to source data, social boost, utilities and more. Money in my API wallet can
              only be spent through my API key, not on the dashboard.
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Continue and generate key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
