import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { publicSupabase as supabase } from "@/integrations/supabase/public-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { getStoreNameFromSubdomain, findStoreByName, fetchAllStores } from "@/utils/storeUtils";
import SubagentRegistrationForm from "@/components/SubagentRegistrationForm";

const defaultTheme = {
  primary: "#38bdf8",
  primary_foreground: "#ffffff",
};

export default function BecomeAgent() {
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStore = async () => {
      try {
        const subdomainStoreName = getStoreNameFromSubdomain(window.location.hostname);
        if (!subdomainStoreName) {
          setLoading(false);
          return;
        }
        const stores = await fetchAllStores(supabase, "agent_stores");
        const matched = findStoreByName(subdomainStoreName, stores);
        if (matched) {
          matched.theme_config = { ...defaultTheme, ...(matched.theme_config || {}) };
          setStore(matched);
        }
      } catch (error) {
        console.error("[v0] Error loading store for Become an Agent page:", error);
      } finally {
        setLoading(false);
      }
    };
    loadStore();
  }, []);

  const theme = store?.theme_config || defaultTheme;
  const primaryColor = theme.primary || defaultTheme.primary;
  const primaryForeground = theme.primary_foreground || defaultTheme.primary_foreground;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-foreground">Store Not Found</h1>
            <p className="text-muted-foreground">We couldn&apos;t find the store you&apos;re trying to join.</p>
            <Button onClick={() => navigate("/")} className="w-full">Go to Store</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b border-border"
        style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)` }}
      >
        <div className="container py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to {store.store_name}
          </Button>
          <h1 className="font-display text-3xl font-bold text-foreground text-balance">
            Become an <span style={{ color: primaryColor }}>Agent</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-pretty">
            Sign up under {store.store_name}, get your own storefront, set your prices, and start earning.
          </p>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-border">
            <CardContent className="p-6">
              <SubagentRegistrationForm
                agentStoreId={store.id}
                agentStoreName={store.store_name}
                primaryColor={primaryColor}
                primaryForeground={primaryForeground}
                onClose={() => navigate("/")}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
