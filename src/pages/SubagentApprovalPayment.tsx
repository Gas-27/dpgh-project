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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="h-6 w-6" />
              Approval Pending
            </CardTitle>
            <CardDescription>Complete your payment to activate your account</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Registration Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Registration Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Agent Store:</span>
                  <span className="font-medium text-right">{agent.store_name}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Business Name:</span>
                  <span className="font-medium text-right">{registration.business_name || "Not provided"}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-right break-words">{registration.email}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium text-right">{registration.phone_number}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Payment Information */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-400 mb-2">Registration Fee</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Pay the registration fee to activate your subagent store account and start selling.
                  </p>
                  <div className="text-2xl font-bold text-blue-300">
                    GH₵ {registration.fee_amount.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Button */}
            <Button
              onClick={handlePayment}
              disabled={paymentProcessing}
              size="lg"
              className="w-full"
            >
              {paymentProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay with Paystack
                </>
              )}
            </Button>

            {/* Info Messages */}
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Secure payment powered by Paystack</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Your account will be activated immediately after payment</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>You can start selling right away</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
