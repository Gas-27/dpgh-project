'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Check } from "lucide-react";
import AFABundlesInfo from "./AFABundlesInfo";
import PackageStatusIndicator, { PackageStatus } from "./PackageStatusIndicator";

interface AFAPackage {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  commission_percent: number;
  is_active: boolean;
  is_online?: boolean;
  status?: PackageStatus;
}

interface AFADisplayProps {
  agentStoreId?: string | null;
  subagentStoreId?: string | null;
  subsubagentStoreId?: string | null;
  onRegisterClick: (packageId: string, packageName: string, price: number) => void;
  themeColor?: string;
  loading?: boolean;
}

export default function AFAPackagesDisplay({
  agentStoreId,
  subagentStoreId,
  subsubagentStoreId,
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
  }, [agentStoreId, subagentStoreId, subsubagentStoreId]);

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
        // ignore
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
      .channel(`agent_stores_${agentStoreId}_afa_pricing`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_stores',
          filter: `id=eq.${agentStoreId}`,
        },
        (payload) => {
          if (payload.new && 'afa_bundle_price' in payload.new) {
            setAgentBundlePrice(payload.new.afa_bundle_price ?? 0);
          }
        }
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [agentStoreId]);

  // Subscribe to subagent_stores updates
  useEffect(() => {
    if (!subagentStoreId) return;

    const subscription = supabase
      .channel(`subagent_stores_${subagentStoreId}_afa_pricing`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subagent_stores',
          filter: `id=eq.${subagentStoreId}`,
        },
        (payload) => {
          if (payload.new && 'afa_bundle_price' in payload.new) {
            setAgentBundlePrice(payload.new.afa_bundle_price ?? 0);
          }
        }
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [subagentStoreId]);

  // Subscribe to sub_subagent_stores updates
  useEffect(() => {
    if (!subsubagentStoreId) return;

    const subscription = supabase
      .channel(`sub_subagent_stores_${subsubagentStoreId}_afa_pricing`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sub_subagent_stores',
          filter: `id=eq.${subsubagentStoreId}`,
        },
        (payload) => {
          if (payload.new && 'afa_bundle_price' in payload.new) {
            setAgentBundlePrice(payload.new.afa_bundle_price ?? 0);
          }
        }
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [subsubagentStoreId]);

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
      setPackages(pkgsData || []);

      // Fetch admin AFA registration fee (base price)
      let adminBundlePrice = 0;
      try {
        const { data: afaSettings } = await supabase
          .from("afa_settings")
          .select("registration_fee, registration_enabled")
          .single();
        if (afaSettings?.registration_fee) {
          adminBundlePrice = Number(afaSettings.registration_fee);
          setBundlePrice(adminBundlePrice);
        }
        if (afaSettings?.registration_enabled !== undefined) {
          setAfaEnabled(afaSettings.registration_enabled !== false);
        }
      } catch (err) {
        // AFA settings not found — fall back to 0
      }

      // ── SUB-SUBAGENT STOREFRONT ──
      // Price shown: sub-subagent's own afa_bundle_price
      // Fallback:    parent subagent's afa_subsubagent_base_price → parent subagent's afa_bundle_price → admin price
      if (subsubagentStoreId) {
        const { data: subsubData } = await supabase
          .from("sub_subagent_stores")
          .select("afa_bundle_price, subagent_store_id")
          .eq("id", subsubagentStoreId)
          .single();

        const ownPrice = subsubData?.afa_bundle_price ? Number(subsubData.afa_bundle_price) : 0;

        if (ownPrice > 0) {
          setAgentBundlePrice(ownPrice);
        } else {
          // Fallback: use parent subagent's price set for sub-subagents
          let fallback = adminBundlePrice;
          if (subsubData?.subagent_store_id) {
            const { data: parentSubagent } = await supabase
              .from("subagent_stores")
              .select("afa_subsubagent_base_price, afa_bundle_price")
              .eq("id", subsubData.subagent_store_id)
              .single();
            if (parentSubagent) {
              fallback =
                Number((parentSubagent as any).afa_subsubagent_base_price || 0) ||
                Number(parentSubagent.afa_bundle_price || 0) ||
                adminBundlePrice;
            }
          }
          setAgentBundlePrice(fallback);
        }
        return; // Price resolved
      }

      // ── SUBAGENT STOREFRONT ──
      // Price shown: subagent's own afa_bundle_price
      // Fallback:    agent's afa_subagent_base_price → agent's afa_bundle_price → admin price
      if (subagentStoreId && !agentStoreId) {
        const { data: subagentData } = await supabase
          .from("subagent_stores")
          .select("afa_bundle_price, agent_store_id")
          .eq("id", subagentStoreId)
          .single();

        const ownPrice = subagentData?.afa_bundle_price ? Number(subagentData.afa_bundle_price) : 0;

        if (ownPrice > 0) {
          setAgentBundlePrice(ownPrice);
        } else {
          // Fallback: agent's dedicated subagent base price → agent's customer price → admin price
          let fallback = adminBundlePrice;
          if (subagentData?.agent_store_id) {
            const { data: agentStore } = await supabase
              .from("agent_stores")
              .select("afa_subagent_base_price, afa_bundle_price")
              .eq("id", subagentData.agent_store_id)
              .single();
            if (agentStore) {
              fallback =
                Number((agentStore as any).afa_subagent_base_price || 0) ||
                Number(agentStore.afa_bundle_price || 0) ||
                adminBundlePrice;
            }
          }
          setAgentBundlePrice(fallback);
        }
        return;
      }

      // ── AGENT STOREFRONT ──
      // Price shown: agent's own afa_bundle_price → admin price
      if (agentStoreId) {
        const { data: agentData } = await supabase
          .from("agent_stores")
          .select("afa_bundle_price")
          .eq("id", agentStoreId)
          .single();
        const agentPrice = agentData?.afa_bundle_price ? Number(agentData.afa_bundle_price) : 0;
        setAgentBundlePrice(agentPrice > 0 ? agentPrice : adminBundlePrice);

        const { data: priceData } = await supabase
          .from("agent_afa_prices")
          .select("afa_package_id, sell_price")
          .eq("agent_store_id", agentStoreId);

        const priceMap = (priceData || []).reduce(
          (acc: Record<string, { sell_price: number }>, p: any) => ({
            ...acc,
            [p.afa_package_id]: { sell_price: p.sell_price },
          }),
          {}
        );
        setPricing(priceMap);
      } else if (subagentStoreId) {
        // subagentStoreId provided alongside agentStoreId — use subagent price with correct fallback
        const { data: subagentData } = await supabase
          .from("subagent_stores")
          .select("afa_bundle_price, agent_store_id")
          .eq("id", subagentStoreId)
          .single();
        const ownPrice = subagentData?.afa_bundle_price ? Number(subagentData.afa_bundle_price) : 0;
        if (ownPrice > 0) {
          setAgentBundlePrice(ownPrice);
        } else {
          let fallback = adminBundlePrice;
          if (subagentData?.agent_store_id) {
            const { data: agentStore } = await supabase
              .from("agent_stores")
              .select("afa_subagent_base_price, afa_bundle_price")
              .eq("id", subagentData.agent_store_id)
              .single();
            if (agentStore) {
              fallback =
                Number((agentStore as any).afa_subagent_base_price || 0) ||
                Number(agentStore.afa_bundle_price || 0) ||
                adminBundlePrice;
            }
          }
          setAgentBundlePrice(fallback);
        }

        const { data: priceData } = await supabase
          .from("subagent_afa_prices")
          .select("afa_package_id, sell_price")
          .eq("subagent_store_id", subagentStoreId);

        const priceMap = (priceData || []).reduce(
          (acc: Record<string, { sell_price: number }>, p: any) => ({
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
        agentId={agentStoreId || undefined}
        subagentId={subagentStoreId || undefined}
        subsubagentId={subsubagentStoreId || undefined}
        showAgentPrice={!!(agentStoreId || subagentStoreId || subsubagentStoreId)}
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
                  <p className="text-3xl font-bold text-green-600">₵{agentBundlePrice.toFixed(2)}</p>
                  <Badge className="ml-auto">Agent Price</Badge>
                </>
              ) : (
                <p className="text-3xl font-bold">₵{bundlePrice.toFixed(2)}</p>
              )}
            </div>
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
          // For AFA bundles, the store-owner's set price (agentBundlePrice) takes priority over
          // the per-package sell_price entry or the admin base_price.
          const displayPrice = agentBundlePrice > 0
            ? agentBundlePrice
            : (pricing[pkg.id]?.sell_price || pkg.base_price);
          const packageStatus: PackageStatus = pkg.is_online === false ? 'offline' : (pkg.is_active ? 'available' : 'not_available');

          return (
            <Card key={pkg.id} className="flex flex-col hover:shadow-lg transition-shadow">
              {packageStatus !== 'available' && (
                <CardContent className="pt-4 pb-0">
                  <PackageStatusIndicator status={packageStatus} />
                </CardContent>
              )}
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
                      GHC {displayPrice.toFixed(2)}
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
