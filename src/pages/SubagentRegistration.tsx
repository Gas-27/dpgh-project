import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

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
  const [formData, setFormData] = useState({ phone: "", email: "", businessName: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "failed">("idle");
  const [agreeToBenefits, setAgreeToBenefits] = useState(false);
  const [showBenefitsModal, setShowBenefitsModal] = useState(true);

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
            businessName: regData.business_name || "",
            password: ""
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
    if (!agentStoreId || !agent) return;

    setProcessing(true);
    try {
      const feeAmount = agent.subagent_fee_enabled ? agent.subagent_fee_amount : 0;

      // Create registration record
      const { data: newReg, error } = await supabase
        .from("subagent_registrations")
        .insert({
          agent_store_id: agentStoreId,
          phone_number: formData.phone,
          email: formData.email,
          business_name: formData.businessName,
          fee_amount: feeAmount,
          payment_required: feeAmount > 0,
          payment_status: feeAmount > 0 ? "pending" : "free",
          status: feeAmount > 0 ? "pending_payment" : "approved"
        })
        .select()
        .single();

      if (error) {
        console.error("[v0] Registration error:", error);
        throw error;
      }

      console.log("[v0] Registration created:", newReg.id);
      setRegistration(newReg);

      if (feeAmount > 0) {
        // Show success toast and redirect to approval page
        toast({ 
          title: "Account Created!", 
          description: "Proceeding to payment...",
          className: "bg-green-50 border-green-200"
        });
        
        console.log("[v0] Redirecting to approval page:", `/subagent-approval-payment?registration_id=${newReg.id}`);
        // Redirect immediately to approval page
        navigate(`/subagent-approval-payment?registration_id=${newReg.id}`, { replace: true });
      } else {
        // No fee required - auto-approve and redirect to dashboard
        await supabase
          .from("subagent_registrations")
          .update({ status: "approved", payment_status: "free" })
          .eq("id", newReg.id);
        
        toast({ 
          title: "Success!", 
          description: "Your subagent account is ready to use",
          className: "bg-green-50 border-green-200"
        });
        
        console.log("[v0] Redirecting to dashboard");
        // Redirect to dashboard
        window.location.href = `${window.location.origin}/subagent-dashboard`;
      }
    } catch (error) {
      console.error("[v0] Registration error:", error);
      setProcessing(false);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      let displayMessage = "Failed to process registration. Please try again.";
      
      if (errorMessage.includes("already")) {
        displayMessage = "This email or phone is already registered as a subagent. Please use a different one or contact support.";
      } else if (errorMessage.includes("schema") || errorMessage.includes("user_id")) {
        displayMessage = "A technical error occurred. Please contact support.";
      } else if (errorMessage.includes("not found")) {
        displayMessage = "Registration data is incomplete. Please try again.";
      }
      
      toast({ 
        title: "Registration Error", 
        description: displayMessage,
        variant: "destructive" 
      });
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
      {/* Benefits Modal */}
      <Dialog open={showBenefitsModal} onOpenChange={setShowBenefitsModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Become an Agent</DialogTitle>
            <DialogDescription>
              Expand your business and start earning with our platform
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">What You Can Do as an Agent</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Sell data bundles with your own profit margins</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Get your own personalized storefront link to share</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Recruit other agents under you and earn commissions</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Set prices for agents working under you</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Manage your agents from your personal dashboard</p>
              </div>
            </div>
            
            <div className="border-t border-border" />
            
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Benefits</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Set your own prices and profit margins</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Withdraw your earnings anytime</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Automated order processing 24/7</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Earn commissions from agents you recruit</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Full support and business tools included</p>
              </div>
            </div>
            
            <div className="border-t border-border" />
            
            <Button 
              onClick={() => {
                setShowBenefitsModal(false);
                setAgreeToBenefits(true);
              }}
              size="lg" 
              className="w-full"
            >
              Continue to Registration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-2xl mx-auto">
        {!showBenefitsModal && (
          <Card className="border-border">
            <CardHeader className="border-b">
              <CardTitle className="text-2xl">Become an Agent with {agent?.store_name}</CardTitle>
              <CardDescription>Complete your registration to start selling</CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Fee Information */}
              {agent?.subagent_fee_enabled && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-400 mb-1">Registration Fee Required</p>
                      <p className="text-sm text-muted-foreground">
                        To complete your registration, you need to pay a one-time fee of <span className="font-bold text-blue-300">GHC {agent.subagent_fee_amount.toFixed(2)}</span>. Your agent account will be created immediately after successful payment.
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

                <div>
                  <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={processing || !formData.phone || !formData.password}
                  className="w-full gap-2"
                  size="lg"
                >
                  {processing || paymentProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {agent?.subagent_fee_enabled ? "Processing Payment..." : "Creating Account..."}
                    </>
                  ) : (
                    agent?.subagent_fee_enabled ? `Pay GHC ${agent.subagent_fee_amount.toFixed(2)} to Register` : "Create My Agent Account"
                  )}
                </Button>
              </form>

              {/* Fee Waiver Note */}
              {!agent?.subagent_fee_enabled && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-green-400">Registration is FREE with this store!</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
