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

  const [status, setStatus] = useState<"loading" | "success" | "failed" | "verifying">("verifying");
  const [message, setMessage] = useState("Verifying payment...");

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const reference = searchParams.get("reference");

        if (!reference) {
          setStatus("failed");
          setMessage("No payment reference provided");
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

        // Payment verified and account created on the edge function
        console.log("[v0] Subagent account created successfully:", data);

        setStatus("success");
        setMessage("Payment confirmed! Your subagent account has been created.");

        // Store data for dashboard reference
        if (data.metadata) {
          sessionStorage.setItem("newSubagentStoreId", data.subagent_store_id);
          sessionStorage.setItem("newSubagentEmail", data.metadata.email);
        }

        // Redirect to subagent dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = DOMAINS.getSubagentDashboardUrl();
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
              ? "Payment Successful"
              : status === "failed"
              ? "Payment Failed"
              : "Verifying Payment"}
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center space-y-6">
          <div className="flex justify-center">
            {status === "verifying" && <Loader2 className="h-16 w-16 animate-spin text-primary" />}
            {status === "success" && <CheckCircle className="h-16 w-16 text-green-500" />}
            {status === "failed" && <AlertCircle className="h-16 w-16 text-red-500" />}
          </div>

          <p className="text-lg text-muted-foreground">{message}</p>

          {status === "success" && (
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">Your subagent account is ready!</p>
              <p>Redirecting to your dashboard in a few moments...</p>
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
