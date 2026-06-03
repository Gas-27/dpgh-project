'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Check } from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAFAData();
  }, [agentStoreId, subagentStoreId]);

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

      // Fetch admin AFA bundle price (minimum registration fee)
      let adminBundlePrice = 0;
      try {
        const { data: afaSettings } = await supabase
          .from("afa_settings")
          .select("bundle_price")
          .single();
        if (afaSettings?.bundle_price) {
          adminBundlePrice = afaSettings.bundle_price;
          setBundlePrice(adminBundlePrice);
        }
      } catch (err) {
        console.log("[v0] AFA settings not found");
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
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">AFA Registration</h2>
          </div>
          <p className="text-muted-foreground">
            Register for our AFA (Agriculture and Farming Association) program to access exclusive agricultural resources and support.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>AFA Registration Form</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Registration details will be configured by the administrator. Please check back soon.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5" style={{ color: themeColor }} />
        <h2 className="text-xl font-bold">Activate AFA Bundle</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Register for educational packages and gain access to premium learning resources. Choose your preferred plan below.
      </p>

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
    </div>
  );
}
