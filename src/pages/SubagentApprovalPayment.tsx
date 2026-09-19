import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Clock, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RegistrationData {
  id: string;
  agent_store_id: string;
  phone_number: string;
  email: string;
  business_name: string;
  fee_amount: number;
  payment_required: boolean;
  payment_status: string;
  status: string;
}

interface AgentStore {
  id: string;
  store_name: string;
}

export default function SubagentApprovalPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [agent, setAgent] = useState<AgentStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const registrationId = searchParams.get("registration_id");

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!registrationId) {
          toast({ title: "Error", description: "No registration ID provided", variant: "destructive" });
          setLoading(false);
          return;
        }

        // Fetch registration details
        const { data: regData, error: regError } = await supabase
          .from("subagent_registrations")
          .select("*")
          .eq("id", registrationId)
          .single();

        if (regError || !regData) {
          toast({ title: "Error", description: "Registration not found", variant: "destructive" });
          setLoading(false);
          return;
        }

        setRegistration(regData);

        // Fetch agent store details
        const { data: agentData, error: agentError } = await supabase
          .from("agent_stores")
          .select("id, store_name")
          .eq("id", regData.agent_store_id)
          .single();

        if (agentError || !agentData) {
          toast({ title: "Error", description: "Agent store not found", variant: "destructive" });
          setLoading(false);
          return;
        }

        setAgent(agentData);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({ title: "Error", description: "Failed to load approval page", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [registrationId, toast]);

  const handlePayment = async () => {
    if (!registration || !agent) return;

    setPaymentProcessing(true);
    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_PAYSTACK_SECRET_KEY}`
        },
        body: JSON.stringify({
          email: registration.email || `subagent-${registration.id}@dataplyug.com`,
          amount: Math.round(registration.fee_amount * 100),
          metadata: {
            subagent_registration_id: registration.id,
            agent_store_id: agent.id,
            type: "subagent_registration_fee",
            base_amount: registration.fee_amount
          }
        })
      });

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message || "Payment initialization failed");
      }

      // Update registration with payment reference
      await supabase
        .from("subagent_registrations")
        .update({
          payment_reference: data.data.reference,
          payment_status: "pending"
        })
        .eq("id", registration.id);

      // Redirect to Paystack checkout
      window.location.href = data.data.authorization_url;
    } catch (error) {
      console.error("Payment error:", error);
      toast({ title: "Error", description: "Failed to initialize payment. Please try again.", variant: "destructive" });
      setPaymentProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (!registration || !agent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Registration Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">The registration could not be found. Please try registering again.</p>
            <Button onClick={() => navigate(-1)} className="mt-4 w-full">Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-md w-full">
        <Card className="shadow-lg border-primary/20">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10 pb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-full p-3">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Activate Your Store</CardTitle>
                  <CardDescription className="text-sm">Complete payment to go live</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Agent Info */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Agent Store</p>
              <p className="font-semibold text-lg text-foreground">{agent.store_name}</p>
            </div>

            {/* Registration Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Your Details</h3>
              <div className="grid gap-4 text-sm">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
                  <span className="text-muted-foreground">Business:</span>
                  <span className="font-medium text-foreground">{registration.business_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground text-xs truncate">{registration.email}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium text-foreground">{registration.phone_number}</span>
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div className="bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 border border-primary/30 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-primary">Registration Fee</p>
              </div>
              <div className="text-3xl font-bold text-primary">
                GHC {registration.fee_amount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                One-time payment to activate your subagent store
              </p>
            </div>

            {/* Payment Button */}
            <div className="space-y-3">
              <Button
                onClick={handlePayment}
                disabled={paymentProcessing}
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-base"
              >
                {paymentProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay Now with Paystack
                  </>
                )}
              </Button>
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Go Back
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Secure payment with Paystack</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Instant account activation</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Start selling immediately</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
