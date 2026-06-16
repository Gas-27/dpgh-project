import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VerifySubagentPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "success" | "failed" | "verifying">("verifying");
  const [message, setMessage] = useState("Verifying payment...");
  const [subagentData, setSubagentData] = useState<any>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const reference = searchParams.get("reference");

        if (!reference) {
          setStatus("failed");
          setMessage("No payment reference provided");
          return;
        }

        // Verify payment with Paystack
        const response = await fetch(
          `https://api.paystack.co/transaction/verify/${reference}`,
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_PAYSTACK_SECRET_KEY}`
            }
          }
        );

        const data = await response.json();

        if (!data.status || data.data.status !== "success") {
          setStatus("failed");
          setMessage("Payment verification failed");
          return;
        }

        // Payment successful - update registration
        const metadata = data.data.metadata;
        const { registrationId } = metadata;

        // Update registration status
        const { data: updated, error } = await supabase
          .from("subagent_registrations")
          .update({
            payment_status: "paid",
            status: "approved"
          })
          .eq("id", registrationId)
          .select()
          .single();

        if (error) throw error;

        // Create subagent account
        if (updated) {
          try {
            const { error: subagentError } = await supabase
              .from("subagent_stores")
              .insert({
                agent_store_id: metadata.agent_store_id,
                phone_number: metadata.phone_number,
                store_name: metadata.phone_number,
                wallet_balance: 0,
                approved: true,
                base_price_multiplier: 0.15 // Default 15% markup
              });

            if (subagentError) {
              console.error("Error creating subagent:", subagentError);
              // Don't fail - registration is already approved
            }

            setSubagentData(updated);
            setStatus("success");
            setMessage("Payment confirmed! Your subagent account has been created.");

            // Redirect to subagent dashboard after 3 seconds
            setTimeout(() => {
              navigate("/subagent-dashboard");
            }, 3000);
          } catch (err) {
            console.error("Account creation error:", err);
            setStatus("success");
            setMessage("Payment confirmed! Redirecting to your dashboard...");
            setTimeout(() => {
              navigate("/subagent-dashboard");
            }, 2000);
          }
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setStatus("failed");
        setMessage("An error occurred during payment verification");
        toast({ title: "Error", description: "Failed to verify payment", variant: "destructive" });
      }
    };

    verifyPayment();
  }, [searchParams, navigate, toast]);

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
