import { Zap, Clock, CreditCard, AlertCircle, Store, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AgentStore {
  id: string;
  store_name: string;
  approved: boolean;
}

interface AppSettings {
  agent_registration_fee: number;
}

const PendingApproval = () => {
  const [store, setStore] = useState<AgentStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [registrationFee, setRegistrationFee] = useState(30);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch the agent store for the current user
  useEffect(() => {
    if (!user) return;

    const fetchStore = async () => {
      const { data, error } = await supabase
        .from("agent_stores")
        .select("id, store_name, approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching store:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setStore(data);
        if (data.approved) {
          // Already approved – redirect immediately
          navigate("/agent", { replace: true });
          return;
        }
      }
      
      // Fetch registration fee from app_settings
      const { data: settings } = await supabase
        .from("app_settings")
        .select("agent_registration_fee")
        .eq("id", 1)
        .single();
      
      if (settings?.agent_registration_fee) {
        setRegistrationFee(settings.agent_registration_fee);
      }
      
      setLoading(false);
    };

    fetchStore();
  }, [user, navigate]);

  // Check for payment verification from URL params
  useEffect(() => {
    if (!user || !store) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get("reference") || urlParams.get("trxref");
    const sessionRef = sessionStorage.getItem("pending_agent_registration_payment");
    const ref = urlRef || sessionRef;
    
    if (!ref) return;
    
    if (urlRef) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Verify payment
    supabase.functions.invoke("verify-payment", { body: { reference: ref } })
      .then(({ data }) => {
        if (data?.success && data?.approved) {
          toast({ title: "Payment successful!", description: "Your store has been approved!" });
          navigate("/agent", { replace: true });
        } else if (data?.already_processed) {
          // Check if store is now approved
          supabase
            .from("agent_stores")
            .select("approved")
            .eq("id", store.id)
            .single()
            .then(({ data: storeData }) => {
              if (storeData?.approved) {
                navigate("/agent", { replace: true });
              }
            });
        }
        sessionStorage.removeItem("pending_agent_registration_payment");
      })
      .catch(() => {
        sessionStorage.removeItem("pending_agent_registration_payment");
      });
  }, [user, store, navigate, toast]);

  // Auto-check for approval every 5 seconds (only if store exists and not approved)
  useEffect(() => {
    if (!user || !store || store.approved) return;

    const checkApproval = async () => {
      const { data } = await supabase
        .from("agent_stores")
        .select("approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.approved) {
        // Approved! Redirect to agent dashboard
        navigate("/agent", { replace: true });
      }
    };

    const interval = setInterval(checkApproval, 5000);
    return () => clearInterval(interval);
  }, [user, store, navigate]);
  
  // Handle Paystack payment
  const handlePaystackPayment = async () => {
    if (!user?.email || !store?.id) {
      toast({ title: "Error", description: "Please log in to continue", variant: "destructive" });
      return;
    }
    
    setPaymentLoading(true);
    try {
      const res = await supabase.functions.invoke("initialize-payment", {
        body: {
          amount: registrationFee,
          email: user.email,
          phone: "0000000000",
          callback_url: `${window.location.origin}/pending-approval`,
          metadata: {
            type: "agent_registration",
            agent_store_id: store.id,
            store_name: store.store_name,
          }
        }
      });
      
      if (res.error) throw new Error(res.error.message);
      if (!res.data?.authorization_url) throw new Error("No authorization URL");
      
      sessionStorage.setItem("pending_agent_registration_payment", res.data.reference);
      window.location.href = res.data.authorization_url;
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    } finally {
      setPaymentLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 flex justify-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <Zap className="h-10 w-10 text-primary animate-pulse" />
              <p className="text-muted-foreground">Loading your store details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no store found (should not happen normally, but handle gracefully)
  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 space-y-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">No Store Found</h2>
            <p className="text-muted-foreground">
              You haven&apos;t created an agent store yet. Please go back and register.
            </p>
            <Button asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardContent className="p-8 space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Clock className="h-10 w-10 text-primary" />
          </div>

          <div className="text-center">
            <h1 className="font-display text-2xl font-bold mb-2">Pending Approval</h1>
            <p className="text-muted-foreground">
              Pay to get your own site to sell data and also you get to customize your agent store with colours and design of your choice. Plus you also get cheaper prices as well.
            </p>
          </div>

          {/* Display Store Name for Reference */}
          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 flex items-center gap-3">
            <Store className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Your Store Name</p>
              <p className="font-mono font-bold text-lg">{store.store_name}</p>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">Registration Fee</p>
            <span className="text-4xl font-bold text-primary">GH₵ {registrationFee.toFixed(2)}</span>
          </div>

          {/* Paystack Payment Button */}
          <Button 
            variant="hero" 
            size="lg" 
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handlePaystackPayment}
            disabled={paymentLoading}
          >
            {paymentLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</>
            ) : (
              <><CreditCard className="h-5 w-5 mr-2" /> Pay with Paystack</>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Pay instantly with card or mobile money. Your store will be approved immediately after payment.
          </p>

          <Button variant="outline" asChild className="w-full">
            <Link to="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
