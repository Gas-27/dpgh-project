import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, CheckCircle, Loader2, Upload, X, Smartphone, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface ReportComplaintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    customer_number: string;
    network: string;
    size_gb: number;
    amount: number;
    created_at: string;
    fulfillment_status: string;
    status: string;
  };
  complaintType: "storefront" | "agent" | "subagent";
  agentStoreId?: string;
  subagentStoreId?: string;
}

const formatNetworkName = (n: string) =>
  n === "mtn" ? "MTN" : n === "mtn_express" ? "MTN Express" : n === "airteltigo" ? "AirtelTigo" : n === "telecel" ? "Telecel" : n;

const isMTN = (n: string) => n === "mtn" || n === "mtn_express";

export default function ReportComplaintDialog({
  open,
  onOpenChange,
  order,
  complaintType,
  agentStoreId,
  subagentStoreId,
}: ReportComplaintDialogProps) {
  const [step, setStep] = useState<"checklist" | "screenshot" | "sending" | "sent" | "response">("checklist");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Checklist answers
  const [owingAirtime, setOwingAirtime] = useState<boolean | null>(null);
  const [owingBundle, setOwingBundle] = useState<boolean | null>(null);
  const [owingMomo, setOwingMomo] = useState<boolean | null>(null);

  // Screenshot
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const network = order.network;
  const networkLabel = formatNetworkName(network);
  const canProceedChecklist = owingAirtime !== null && owingBundle !== null && owingMomo !== null;

  const getScreenshotInstructions = () => {
    if (isMTN(network)) {
      return {
        title: "Attach Data Balance Screenshot",
        steps: [
          "Dial *124# on your MTN line",
          'Select "Data Balance" from the menu',
          "Take a screenshot of the full Balance Details screen",
          'Look for "Master Beneficiary Data Bundle" — that is where our bundle appears',
          "Upload that screenshot below",
        ],
        example: "Your screenshot should show the Balance Breakdown screen similar to the example above.",
        note: 'Our bundle appears under "Master Beneficiary Data Bundle" — NOT under Mashup Data or DATA GHS entries.',
        androidNote: "Android: dial *124# then screenshot. iPhone: dial *124# then screenshot the USSD screen.",
        exampleImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-S89mweIwdsbfiIShgiPo8VRZ8FcY9C.png",
      };
    }
    if (network === "telecel") {
      return {
        title: "Attach Telecel App Screenshot",
        steps: [
          "Open the Telecel Ghana app on your phone",
          "Go to your data balance section",
          "Take a screenshot showing your current data balance",
          "Upload that screenshot below",
        ],
        example: "Your screenshot should clearly show your Telecel data balance from the official Telecel app.",
        note: "Make sure the screenshot is from the official Telecel app and shows the full balance page.",
        androidNote: "Open Telecel app → Data Balance → Screenshot.",
        exampleImage: null,
      };
    }
    if (network === "airteltigo") {
      return {
        title: "Attach AirtelTigo App Screenshot",
        steps: [
          "Open the AirtelTigo Ghana app on your phone",
          "Go to your data balance or My Account section",
          "Take a screenshot showing your current data balance",
          "Upload that screenshot below",
        ],
        example: "Your screenshot should clearly show your AirtelTigo data balance from the official AirtelTigo app.",
        note: "Make sure the screenshot is from the official AirtelTigo app and shows the full balance page.",
        androidNote: "Open AirtelTigo app → Balance → Screenshot.",
        exampleImage: null,
      };
    }
    return {
      title: "Attach Data Balance Screenshot",
      steps: ["Check your data balance and take a screenshot", "Upload that screenshot below"],
      example: "",
      note: "",
      androidNote: "",
      exampleImage: null,
    };
  };

  const instructions = getScreenshotInstructions();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (JPG, PNG, etc.)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image under 5MB", variant: "destructive" });
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSendComplaint = async () => {
    try {
      setSending(true);
      setStep("sending");

      let screenshotUrl = "";
      if (screenshotFile) {
        try {
          const fileExt = screenshotFile.name.split(".").pop();
          const fileName = `complaint-${order.id}-${Date.now()}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("complaints")
            .upload(fileName, screenshotFile, { upsert: true });
          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage.from("complaints").getPublicUrl(uploadData.path);
            screenshotUrl = urlData?.publicUrl || "";
          }
          // If upload fails (e.g. bucket not set up), continue without screenshot
        } catch (_) {
          // Screenshot upload failed silently — complaint still submits
        }
      }

      const checklistSummary = `
Checklist Answers:
• Owing airtime on SIM: ${owingAirtime ? "YES" : "NO"}
• Owing bundle: ${owingBundle ? "YES" : "NO"}
• Owing MoMo: ${owingMomo ? "YES" : "NO"}
${screenshotUrl ? `\nScreenshot: ${screenshotUrl}` : "\nNo screenshot provided"}`;

      const complaintDetails = `📱 Order Complaint Report
━━━━━━━━━━━━━━━━━━━━━━━━
Order Date: ${new Date(order.created_at).toLocaleString()}
Network: ${networkLabel}
Data: ${order.size_gb}GB
Amount: GHC ${Number(order.amount).toFixed(2)}
Customer: ${order.customer_number}
Status: Delivered (Not Received)
Order ID: ${order.id}
${checklistSummary}
⚠️ Issue: Data shows delivered but not received.
Please investigate and assist. Thank You.`;

      // Try inserting with new columns first; fall back to base columns if they don't exist yet
      const basePayload = {
        complaint_type: complaintType,
        order_id: order.id,
        agent_store_id: agentStoreId || null,
        subagent_store_id: subagentStoreId || null,
        customer_number: order.customer_number,
        complaint_title: "Delivered but Data Not Received",
        complaint_details: complaintDetails,
        status: "in-progress",
      };

      const { error } = await supabase.from("complaints").insert({
        ...basePayload,
        screenshot_url: screenshotUrl || null,
        owing_airtime: owingAirtime,
        owing_bundle: owingBundle,
        owing_momo: owingMomo,
      });

      if (error) {
        // If new columns don't exist in schema yet, retry with base payload only
        const isSchemaError = error.code === "PGRST204" || error.message?.includes("column");
        if (isSchemaError) {
          const { error: fallbackError } = await supabase.from("complaints").insert(basePayload);
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }

      setStep("sent");
      toast({ title: "Complaint Submitted", description: "Your complaint has been submitted successfully." });

      setTimeout(() => setStep("response"), 9000);
    } catch (error) {
      console.error("Error submitting complaint:", error);
      setStep("screenshot");
      toast({ title: "Error", description: "Failed to submit complaint. Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setStep("checklist");
    setOwingAirtime(null);
    setOwingBundle(null);
    setOwingMomo(null);
    setScreenshotFile(null);
    setScreenshotPreview(null);
    onOpenChange(false);
  };

  const YesNoSelector = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean | null;
    onChange: (v: boolean) => void;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
            value === true
              ? "bg-red-500/20 border-red-500 text-red-400"
              : "border-border text-muted-foreground hover:border-red-400 hover:text-red-400"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
            value === false
              ? "bg-green-500/20 border-green-500 text-green-400"
              : "border-border text-muted-foreground hover:border-green-400 hover:text-green-400"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── STEP 1: CHECKLIST ── */}
        {step === "checklist" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Before You Submit — Quick Check
              </DialogTitle>
              <DialogDescription>
                Please answer these questions honestly before we investigate your {networkLabel} order.
              </DialogDescription>
            </DialogHeader>

            {/* Order summary */}
            <Card className="border-border bg-muted/40">
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-medium">{networkLabel}</span>
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-medium">{order.size_gb}GB</span>
                  <span className="text-muted-foreground">Number</span>
                  <span className="font-medium">{order.customer_number}</span>
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">GHC {Number(order.amount).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* MTN / MTN Express bundle note */}
            {isMTN(network) && (
              <Card className="border-yellow-500/30 bg-yellow-500/10">
                <CardContent className="pt-4 pb-3">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-yellow-300">
                      <span className="font-semibold">Important:</span> Our {networkLabel} bundle appears as{" "}
                      <span className="font-bold">"Master Beneficiary Data Bundle"</span> in your MTN app data balance
                      (dial *124# to check). Please check there before reporting — it may already be in your balance.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <YesNoSelector
                label="1. Are you currently owing airtime on this SIM?"
                value={owingAirtime}
                onChange={setOwingAirtime}
              />
              <YesNoSelector
                label="2. Are you currently owing a bundle / data on this SIM?"
                value={owingBundle}
                onChange={setOwingBundle}
              />
              <YesNoSelector
                label="3. Are you owing MoMo (Mobile Money) on this number?"
                value={owingMomo}
                onChange={setOwingMomo}
              />
            </div>

            {(owingAirtime === true || owingBundle === true || owingMomo === true) && (
              <Card className="border-orange-500/30 bg-orange-500/10">
                <CardContent className="pt-3 pb-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-orange-300">
                      Outstanding airtime, bundle, or MoMo debts can cause data bundles to be held or redirected by the
                      network. Please clear any outstanding debts on this number and check your balance again before
                      submitting a complaint.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => setStep("screenshot")}
                disabled={!canProceedChecklist}
                className="flex-1"
              >
                Next: Add Screenshot
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 2: SCREENSHOT ── */}
        {step === "screenshot" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                {instructions.title}
              </DialogTitle>
              <DialogDescription>
                Attach proof of your current data balance on your {networkLabel} number.
              </DialogDescription>
            </DialogHeader>

            {/* Step-by-step instructions */}
            <Card className="border-border bg-muted/40">
              <CardContent className="pt-4 pb-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to get the screenshot</p>
                <ol className="space-y-1.5">
                  {instructions.steps.map((s, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                {instructions.androidNote && (
                  <p className="text-xs text-muted-foreground pt-1">{instructions.androidNote}</p>
                )}
              </CardContent>
            </Card>

            {/* MTN example image */}
            {instructions.exampleImage && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Example Screenshot</p>
                <div className="rounded-lg overflow-hidden border border-border">
                  <img
                    src={instructions.exampleImage}
                    alt="Example MTN balance screenshot showing Master Beneficiary Data Bundle"
                    className="w-full max-h-48 object-contain bg-muted"
                  />
                </div>
                {instructions.note && (
                  <p className="text-xs text-muted-foreground">{instructions.note}</p>
                )}
              </div>
            )}

            {/* Upload area */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Upload Your Screenshot</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {!screenshotPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 hover:border-primary/60 transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Tap to upload screenshot</p>
                  <p className="text-xs text-muted-foreground/70">JPG, PNG — max 5MB</p>
                </button>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={screenshotPreview} alt="Your screenshot" className="w-full max-h-52 object-contain bg-muted" />
                  <button
                    type="button"
                    onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
                    className="absolute top-2 right-2 bg-background/80 rounded-full p-1 border border-border hover:bg-destructive/20"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Screenshot is required for faster resolution. If you cannot provide one, you can still submit but resolution may take longer.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("checklist")} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleSendComplaint}
                disabled={sending}
                className="flex-1"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Report
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* ── SENDING ── */}
        {step === "sending" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Submitting your report...</p>
          </div>
        )}

        {/* ── SENT ── */}
        {step === "sent" && (
          <>
            <DialogHeader>
              <DialogTitle>Report Sent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </div>
              <p className="text-foreground font-medium">Your complaint has been received</p>
              <p className="text-sm text-muted-foreground">Our support team is reviewing your case...</p>
            </div>
          </>
        )}

        {/* ── RESPONSE ── */}
        {step === "response" && (
          <>
            <DialogHeader>
              <DialogTitle>Support Team Response</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Card className="border-green-600/30 bg-green-600/10">
                <CardContent className="pt-4 pb-3">
                  <p className="text-sm font-medium text-green-400">We are working on it for you</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your data will be delivered shortly. No further action needed from your end. We appreciate your patience.
                  </p>
                </CardContent>
              </Card>
              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
