import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DOMAINS } from "@/config/domains";

export default function VerifySubagentPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "success" | "failed" | "verifying" | "approving">("verifying");
  const [message, setMessage] = useState("Verifying payment...");
  const [approvalMessage, setApprovalMessage] = useState("");

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const reference = searchParams.get("reference");
        const registrationId = searchParams.get("registration_id");
        const storeId = searchParams.get("store_id");

        console.log("[v0] Verify page loaded with:", { reference, registrationId, storeId });

        if (!reference || !registrationId) {
          setStatus("failed");
          setMessage("No payment reference or registration ID provided");
          return;
        }

        console.log("[v0] Verifying subagent payment with reference:", reference);

        // Call the edge function to verify payment
        const { data, error } = await supabase.functions.invoke(
          "verify-payment",
          {
            body: { reference },
          }
        );

        console.log("[v0] Verification response:", { data, error });

        if (error || !data?.success) {
          setStatus("failed");
          setMessage("Payment verification failed. Please contact support.");
          console.error("[v0] Payment verification error:", error || data);
          return;
        }

        console.log("[v0] Payment verified successfully");
        setStatus("approving");
        setMessage("Payment confirmed! Approving your account...");
        setApprovalMessage("Your account is being set up...");

        // Get the registration record
        const { data: registration, error: regError } = await supabase
          .from("subagent_registrations")
          .select("*")
          .eq("id", registrationId)
          .single();

        if (regError || !registration) {
          console.error("[v0] Registration not found:", regError);
          throw new Error("Registration record not found");
        }

        console.log("[v0] Registration record found:", registration);

        // Update registration record to mark as paid
        const { error: regUpdateError } = await supabase
          .from("subagent_registrations")
          .update({
            payment_status: "paid",
            status: "approved",
            payment_reference: reference,
          })
          .eq("id", registrationId);

        if (regUpdateError) {
          console.error("[v0] Failed to update registration:", regUpdateError);
        }

        // Approve the subagent store
        if (registration.agent_store_id) {
          // Get or create subagent store for this registration
          const { data: existingStore } = await supabase
            .from("subagent_stores")
            .select("id")
            .eq("agent_store_id", registration.agent_store_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          let subagentStoreId = existingStore?.id;

          // If no store exists yet, create one
          if (!subagentStoreId) {
            const { data: newStore, error: storeCreateError } = await supabase
              .from("subagent_stores")
              .insert({
                agent_store_id: registration.agent_store_id,
                approved: true,
                wallet_balance: 0
              })
              .select("id")
              .single();

            if (!storeCreateError && newStore) {
              subagentStoreId = newStore.id;
            }
          }

          if (subagentStoreId) {
            sessionStorage.setItem("newSubagentStoreId", subagentStoreId);
          }
        }

        // NOTE: Registration fee is already added to agent wallet by verify-payment edge function
        // Do NOT add it again here to avoid double-crediting

        console.log("[v0] Account approval completed");

        setStatus("success");
        setMessage("Payment Confirmed!");
        setApprovalMessage("Your subagent account has been approved and is ready to use.");

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = `${window.location.origin}/subagent-dashboard`;
        }, 2000);
      } catch (error) {
        console.error("[v0] Payment verification error:", error);
        setStatus("failed");
        setMessage("An error occurred during payment verification");
        toast({
          title: "Error",
          description: "Failed to verify payment",
          variant: "destructive",
        });
      }
    };

    verifyPayment();
  }, [searchParams, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {status === "success"
              ? "Account Approved"
              : status === "failed"
              ? "Payment Failed"
              : status === "approving"
              ? "Setting Up Your Account"
              : "Verifying Payment"}
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center space-y-6">
          <div className="flex justify-center">
            {(status === "verifying" || status === "approving") && (
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            )}
            {status === "success" && <CheckCircle className="h-16 w-16 text-green-500" />}
            {status === "failed" && <AlertCircle className="h-16 w-16 text-red-500" />}
          </div>

          <p className="text-lg text-muted-foreground">{message}</p>

          {approvalMessage && (
            <p className="text-sm text-muted-foreground">{approvalMessage}</p>
          )}

          {status === "success" && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-semibold text-green-400">Your account is ready!</p>
              <p>Redirecting to your dashboard...</p>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-4">
              <Button
                onClick={() => window.history.back()}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
              <Button
                onClick={() => navigate("/")}
                className="w-full"
              >
                Go to Home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
