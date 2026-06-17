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
        const registrationId = searchParams.get("registration_id");

        console.log("[v0] Verify page loaded with:", { reference, registrationId });

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

        console.log("[v0] Payment verified, now creating subagent account");

        // Get the registration record
        const { data: registration, error: regError } = await supabase
          .from("subagent_registrations")
          .select("*")
          .eq("id", registrationId)
          .single();

        if (regError || !registration) {
          setStatus("failed");
          setMessage("Registration record not found");
          console.error("[v0] Registration not found:", regError);
          return;
        }

        console.log("[v0] Registration record found:", registration);

        const registrationData = registration.registration_data || {};

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: registration.email,
          password: registrationData.password || Math.random().toString(36).slice(-8),
          options: {
            data: {
              role: "subagent",
            },
          },
        });

        if (authError) {
          console.error("[v0] Auth error:", authError);
          setStatus("failed");
          setMessage("Failed to create user account. Please contact support.");
          return;
        }

        if (!authData.user?.id) {
          setStatus("failed");
          setMessage("Failed to create user account");
          return;
        }

        console.log("[v0] User account created:", authData.user.id);

        // Create subagent store
        const { data: storeData, error: storeError } = await supabase
          .from("subagent_stores")
          .insert({
            user_id: authData.user.id,
            agent_store_id: registration.agent_store_id,
            store_name: registrationData.storeName || registration.business_name,
            whatsapp_number: registrationData.whatsappNumber,
            support_number: registrationData.supportNumber || registration.phone_number,
            momo_name: registrationData.momoName,
            momo_number: registrationData.momoNumber,
            momo_network: registrationData.momoNetwork,
            wallet_balance: 0,
            approved: true,
          })
          .select()
          .single();

        if (storeError) {
          console.error("[v0] Store creation error:", storeError);
          setStatus("failed");
          setMessage("Failed to create subagent store. Please contact support.");
          return;
        }

        console.log("[v0] Subagent store created:", storeData);

        // Assign subagent role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "subagent",
          });

        if (roleError && roleError.code !== "PGRST116") {
          console.error("[v0] Role creation error:", roleError);
        }

        // Update registration to mark as completed
        await supabase
          .from("subagent_registrations")
          .update({
            status: "completed",
            user_id: authData.user.id,
          })
          .eq("id", registrationId);

        console.log("[v0] Subagent registration completed successfully");

        // Add fee to agent wallet
        console.log("[v0] Adding registration fee to agent wallet:", registration.fee_amount);
        
        const { data: agentStore } = await supabase
          .from("agent_stores")
          .select("wallet_balance")
          .eq("id", registration.agent_store_id)
          .single();

        if (agentStore) {
          const newBalance = (agentStore.wallet_balance || 0) + registration.fee_amount;
          await supabase
            .from("agent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", registration.agent_store_id);
          
          console.log("[v0] Agent wallet updated. New balance:", newBalance);
        }

        setStatus("success");
        setMessage("Payment confirmed! Your subagent account has been created.");

        // Store data for dashboard reference
        sessionStorage.setItem("newSubagentStoreId", storeData.id);
        sessionStorage.setItem("newSubagentEmail", registration.email);

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
