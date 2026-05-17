import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

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
  n === "mtn" ? "MTN" : n === "airteltigo" ? "AirtelTigo" : n === "telecel" ? "Telecel" : n;

export default function ReportComplaintDialog({
  open,
  onOpenChange,
  order,
  complaintType,
  agentStoreId,
  subagentStoreId,
}: ReportComplaintDialogProps) {
  const [step, setStep] = useState<"form" | "sent" | "response">("form");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const complaintDetails = `
📱 Order Complaint Report
━━━━━━━━━━━━━━━━━━━━━━━━
Order Date: ${new Date(order.created_at).toLocaleString()}
Network: ${formatNetworkName(order.network)}
Data: ${order.size_gb}GB
Amount: GH₵ ${Number(order.amount).toFixed(2)}
Customer: ${order.customer_number}
Status: Delivered (Not Received)
Order ID: ${order.id}

⚠️ Issue: Data shows delivered but not received.
Please investigate and assist. Thank You.`;

  const handleSendComplaint = async () => {
    try {
      setSending(true);

      // Save complaint to database
      const { error } = await supabase.from("complaints").insert({
        complaint_type: complaintType,
        order_id: order.id,
        agent_store_id: complaintType === "agent" ? agentStoreId : null,
        subagent_store_id: complaintType === "subagent" ? subagentStoreId : null,
        customer_number: order.customer_number,
        complaint_title: "Delivered but Data Not Received",
        complaint_details: complaintDetails,
        status: "in-progress",
      });

      if (error) throw error;

      // Show sent confirmation
      setStep("sent");
      toast({
        title: "Complaint Submitted",
        description: "Your complaint has been submitted successfully.",
      });

      // Auto-show response after 9 seconds
      setTimeout(() => {
        setStep("response");
      }, 9000);
    } catch (error) {
      console.error("Error submitting complaint:", error);
      toast({
        title: "Error",
        description: "Failed to submit complaint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setStep("form");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Report Order Issue
              </DialogTitle>
              <DialogDescription>
                Deliver your complaint to our support team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Card className="border-border bg-muted/50">
                <CardContent className="pt-6">
                  <div className="text-sm whitespace-pre-wrap font-mono text-foreground">
                    {complaintDetails}
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendComplaint}
                  disabled={sending}
                  className="flex-1"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "sent" && (
          <>
            <DialogHeader>
              <DialogTitle>Report Sent ✓</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </div>
              <p className="text-foreground font-medium">
                Your complaint has been received
              </p>
              <p className="text-sm text-muted-foreground">
                Our support team is reviewing your case...
              </p>
            </div>
          </>
        )}

        {step === "response" && (
          <>
            <DialogHeader>
              <DialogTitle>Support Team Response</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Card className="border-green-600/30 bg-green-600/10">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-green-400">
                    ✓ We are working on it for you
                  </p>
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
