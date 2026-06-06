'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Check } from "lucide-react";
import AFABundlesInfo from "./AFABundlesInfo";

interface AFAPackage {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  commission_percent: number;
  is_active: boolean;
}

interface AFADisplayProps {
  agentStoreId?: string | null;
  subagentStoreId?: string | null;
  onRegisterClick: (packageId: string, packageName: string, price: number) => void;
  themeColor?: string;
  loading?: boolean;
}

export default function AFAPackagesDisplay({
  agentStoreId,
  subagentStoreId,
  onRegisterClick,
  themeColor = "#000000",
  loading: externalLoading = false,
}: AFADisplayProps) {
  const [packages, setPackages] = useState<AFAPackage[]>([]);
  const [pricing, setPricing] = useState<Record<string, { sell_price: number }>>({});
  const [bundlePrice, setBundlePrice] = useState(0);
  const [agentBundlePrice, setAgentBundlePrice] = useState(0);
  const [afaEnabled, setAfaEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAFAData();
  }, [agentStoreId, subagentStoreId]);

  // Subscribe to real-time changes to afa_settings
  useEffect(() => {
    // First load the current state
    const loadAfaStatus = async () => {
      try {
        const { data } = await supabase
          .from('afa_settings')
          .select('registration_enabled, registration_fee')
          .single();
        
        if (data) {
          setAfaEnabled(data.registration_enabled !== false);
          setBundlePrice(data.registration_fee || 0);
        }
      } catch (err) {
        console.log('[v0] Error loading AFA status');
      }
    };

    loadAfaStatus();

    const subscription = supabase
      .channel('afa_settings_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'afa_settings',
        },
        (payload) => {
          console.log('[v0] AFA settings changed, refreshing data:', payload);
          if (payload.new) {
            setBundlePrice(payload.new.registration_fee || 0);
            setAfaEnabled(payload.new.registration_enabled !== false);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Subscribe to real-time changes to agent_stores (for agent bundle price changes)
  useEffect(() => {
    if (!agentStoreId) return;

    const subscription = supabase
      .channel(`agent_stores_${agentStoreId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_stores',
          filter: `id=eq.${agentStoreId}`,
        },
        (payload) => {
          console.log('[v0] Agent store changed, refreshing bundle price:', payload);
          if (payload.new?.afa_bundle_price) {
            setAgentBundlePrice(payload.new.afa_bundle_price);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [agentStoreId]);

  const fetchAFAData = async () => {
    setLoading(true);
    try {
      // Fetch active AFA packages
      const { data: pkgsData, error: pkgsError } = await supabase
        .from("afa_packages")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (pkgsError) throw pkgsError;
      console.log("[v0] AFA Packages fetched:", pkgsData);
      setPackages(pkgsData || []);

      // Fetch admin AFA registration fee (base price)
      let adminBundlePrice = 0;
      try {
        const { data: afaSettings } = await supabase
          .from("afa_settings")
          .select("registration_fee, registration_enabled")
          .single();
        if (afaSettings?.registration_fee) {
          adminBundlePrice = afaSettings.registration_fee;
          setBundlePrice(adminBundlePrice);
        }
        if (afaSettings?.registration_enabled !== undefined) {
          setAfaEnabled(afaSettings.registration_enabled !== false);
        }
        console.log("[v0] AFA settings loaded:", afaSettings);
      } catch (err) {
        console.log("[v0] AFA settings not found:", err);
      }

      // Fetch agent's AFA bundle price (agent markup)
      if (agentStoreId) {
        const { data: agentData } = await supabase
          .from("agent_stores")
          .select("afa_bundle_price")
          .eq("id", agentStoreId)
          .single();
        setAgentBundlePrice(agentData?.afa_bundle_price || adminBundlePrice);

        const { data: priceData } = await supabase
          .from("agent_afa_prices")
          .select("afa_package_id, sell_price")
          .eq("agent_store_id", agentStoreId);

        const priceMap = (priceData || []).reduce(
          (acc, p) => ({
            ...acc,
            [p.afa_package_id]: { sell_price: p.sell_price },
          }),
          {}
        );
        setPricing(priceMap);
      } else if (subagentStoreId) {
        const { data: subagentData } = await supabase
          .from("subagent_stores")
          .select("afa_bundle_price")
          .eq("id", subagentStoreId)
          .single();
        setAgentBundlePrice(subagentData?.afa_bundle_price || adminBundlePrice);

        const { data: priceData } = await supabase
          .from("subagent_afa_prices")
          .select("afa_package_id, sell_price")
          .eq("subagent_store_id", subagentStoreId);

        const priceMap = (priceData || []).reduce(
          (acc, p) => ({
            ...acc,
            [p.afa_package_id]: { sell_price: p.sell_price },
          }),
          {}
        );
        setPricing(priceMap);
      }
    } catch (err) {
      console.error("Failed to fetch AFA data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || externalLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <AFABundlesInfo 
        agentId={agentStoreId || subagentStoreId || undefined}
        showAgentPrice={!!(agentStoreId || subagentStoreId)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Show disabled message if AFA is disabled */}
      {!afaEnabled && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
              AFA Bundle Registration is currently disabled. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Display admin bundle price and agent bundle price */}
      {(bundlePrice > 0 || agentBundlePrice > 0) && (
        <Card className="border-green-500/30 bg-green-900/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">AFA Bundle Registration</p>
            <div className="flex items-baseline gap-3">
              {agentBundlePrice > 0 ? (
                <>
                  <p className="text-lg text-muted-foreground line-through">₵{bundlePrice.toFixed(2)}</p>
                  <p className="text-3xl font-bold text-green-600">₵{agentBundlePrice.toFixed(2)}</p>
                  <Badge className="ml-auto">Agent Price</Badge>
                </>
              ) : (
                <p className="text-3xl font-bold">₵{bundlePrice.toFixed(2)}</p>
              )}
            </div>
            {agentBundlePrice > 0 && bundlePrice > 0 && (
              <p className="text-sm text-green-600 mt-2">Your markup: ₵{(agentBundlePrice - bundlePrice).toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
      )}
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5" style={{ color: themeColor }} />
        <h2 className="text-xl font-bold">Activate AFA Bundle</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Register for educational packages and gain access to premium learning resources. Choose your preferred plan below.
      </p>

      {afaEnabled ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => {
          const displayPrice = pricing[pkg.id]?.sell_price || pkg.base_price;

          return (
            <Card key={pkg.id} className="flex flex-col hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    {pkg.description && (
                      <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap">
                    <Zap className="h-3 w-3" />
                    Active
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-4">
                <div className="space-y-2 flex-1">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Package Price</p>
                    <p className="text-2xl font-bold" style={{ color: themeColor }}>
                      GH₵ {displayPrice.toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: themeColor }} />
                    <p className="text-xs text-muted-foreground">One-time registration fee</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: themeColor }} />
                    <p className="text-xs text-muted-foreground">Instant activation</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: themeColor }} />
                    <p className="text-xs text-muted-foreground">Lifetime access</p>
                  </div>
                </div>

                <Button
                  onClick={() => onRegisterClick(pkg.id, pkg.name, displayPrice)}
                  style={{ backgroundColor: themeColor }}
                  className="w-full text-white hover:opacity-90 transition-opacity"
                >
                  Register Now
                </Button>
              </CardContent>
            </Card>
          );
        })}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">
          AFA Bundle registration is currently disabled. Please check back soon.
        </p>
      )}
    </div>
  );
}
