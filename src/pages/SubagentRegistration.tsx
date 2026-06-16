import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface AgentStore {
  id: string;
  store_name: string;
  subagent_fee_enabled: boolean;
  subagent_fee_amount: number;
}

interface Registration {
  id: string;
  agent_store_id: string;
  phone_number: string;
  email?: string;
  business_name?: string;
  fee_amount: number;
  payment_required: boolean;
  payment_status: string;
  payment_reference?: string;
  status: string;
  created_at: string;
}

export default function SubagentRegistration() {
  const { agentStoreId, registrationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [agent, setAgent] = useState<AgentStore | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({ phone: "", email: "", businessName: "" });
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "failed">("idle");

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!agentStoreId) return;

        // Load agent store details
        const { data: agentData, error: agentError } = await supabase
          .from("agent_stores")
          .select("id, store_name, subagent_fee_enabled, subagent_fee_amount")
          .eq("id", agentStoreId)
          .single();

        if (agentError) throw agentError;
        setAgent(agentData);

        // If registrationId exists, load existing registration
        if (registrationId) {
          const { data: regData, error: regError } = await supabase
            .from("subagent_registrations")
            .select("*")
            .eq("id", registrationId)
            .single();

          if (regError) throw regError;
          setRegistration(regData);
          setFormData({
            phone: regData.phone_number,
            email: regData.email || "",
            businessName: regData.business_name || ""
          });
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast({ title: "Error", description: "Failed to load registration", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [agentStoreId, registrationId, toast]);

  const handleInitiateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentStoreId) return;

    setProcessing(true);
    try {
      const feeAmount = agent?.subagent_fee_enabled ? agent.subagent_fee_amount : 0;

      // Create or update registration
      if (registration?.id) {
        const { error } = await supabase
          .from("subagent_registrations")
          .update({
            phone_number: formData.phone,
            email: formData.email,
            business_name: formData.businessName,
            fee_amount: feeAmount,
            payment_required: feeAmount > 0,
            updated_at: new Date().toISOString()
          })
          .eq("id", registration.id);

        if (error) throw error;
      } else {
        const { data: newReg, error } = await supabase
          .from("subagent_registrations")
          .insert({
            agent_store_id: agentStoreId,
            phone_number: formData.phone,
            email: formData.email,
            business_name: formData.businessName,
            fee_amount: feeAmount,
            payment_required: feeAmount > 0,
            payment_status: feeAmount > 0 ? "pending" : "free"
          })
          .select()
          .single();

        if (error) throw error;
        setRegistration(newReg);
      }

      toast({ title: "Saved", description: "Registration details saved" });

      // If fee is required, process payment
      if (feeAmount > 0) {
        handlePayment();
      }
    } catch (error) {
      console.error("Error saving registration:", error);
      toast({ title: "Error", description: "Failed to save registration", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!registration || !agent) return;

    setPaymentProcessing(true);
    try {
      // Initialize Paystack payment
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_PAYSTACK_SECRET_KEY}`
        },
        body: JSON.stringify({
          email: formData.email || `subagent-${registration.id}@dataplyug.com`,
          amount: Math.round(agent.subagent_fee_amount * 100), // Convert to pesewas
          metadata: {
            registration_id: registration.id,
            agent_store_id: agent.id,
            phone_number: formData.phone,
            type: "subagent_registration_fee"
          }
        })
      });

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message || "Payment initialization failed");
      }

      // Store the payment reference
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
      toast({ title: "Error", description: "Failed to initialize payment", variant: "destructive" });
      setPaymentProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Agent Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">The agent store could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="border-border">
          <CardHeader className="border-b">
            <CardTitle className="text-2xl">Become a {agent.store_name} Subagent</CardTitle>
            <CardDescription>Complete your registration to start selling under this store</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Fee Information */}
            {agent.subagent_fee_enabled && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-blue-400 mb-1">Registration Fee</p>
                    <p className="text-sm text-muted-foreground">
                      A one-time registration fee of <span className="font-bold text-blue-300">GH₵ {agent.subagent_fee_amount.toFixed(2)}</span> is required to proceed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleInitiateRegistration} className="space-y-4">
              <div>
                <Label htmlFor="phone" className="text-sm font-semibold">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0201234567"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-semibold">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="business" className="text-sm font-semibold">Business Name (Optional)</Label>
                <Input
                  id="business"
                  placeholder="Your business name"
                  value={formData.businessName}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                  className="mt-1.5"
                />
              </div>

              <Button
                type="submit"
                disabled={processing || paymentProcessing || !formData.phone}
                className="w-full gap-2"
                size="lg"
              >
                {processing || paymentProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {agent.subagent_fee_enabled ? "Processing Payment..." : "Registering..."}
                  </>
                ) : (
                  agent.subagent_fee_enabled ? `Pay GH₵ ${agent.subagent_fee_amount.toFixed(2)} to Register` : "Register as Subagent"
                )}
              </Button>
            </form>

            {/* Fee Waiver Note */}
            {!agent.subagent_fee_enabled && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <CheckCircle className="h-5 w-5 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-green-400">Registration is FREE with this store!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
