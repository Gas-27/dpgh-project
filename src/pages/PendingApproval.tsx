import { Zap, Clock, CreditCard, AlertCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AgentStore {
  id: string;
  store_name: string;
  approved: boolean;
}

const PendingApproval = () => {
  const [copied, setCopied] = useState(false);
  const [store, setStore] = useState<AgentStore | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

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
      setLoading(false);
    };

    fetchStore();
  }, [user, navigate]);

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

  const copyToClipboard = () => {
    navigator.clipboard.writeText("0599449202");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              You haven't created an agent store yet. Please go back and register.
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
              <p className="text-xs text-muted-foreground">Your Store Name (for payment reference)</p>
              <p className="font-mono font-bold text-lg">{store.store_name}</p>
            </div>
          </div>

          {/* Payment Instructions */}
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-semibold">Payment Required for Approval</span>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  To complete your store approval, please make a payment of:
                </p>
                <div className="text-center">
                  <span className="text-3xl font-bold text-primary">GHC 30.00</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Send payment via Mobile Money to:
                </p>
                <div className="flex items-center justify-between bg-background rounded-lg p-3 border">
                  <div>
                    <p className="font-mono font-medium">0599449202</p>
                    <p className="text-xs text-muted-foreground">MTN Mobile Money</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="shrink-0"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs text-amber-800 dark:text-amber-400 font-medium mb-1">
                  ⚠️ Important:
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Use your store name: <span className="font-bold">{store.store_name}</span> as the payment reference.
                  Failure to include your store name will result in your store not being approved.
                </p>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-800 dark:text-green-400">
                ✅ After payment, your store will be approved within 1 hour.
                After payment send a screenshot of payment to 0200511211 on WhatsApp. Once approved, you will be automatically redirected to your dashboard.
              </p>
            </div>
          </div>

          <Button variant="outline" asChild className="w-full">
            <Link to="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;