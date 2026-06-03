'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Check } from "lucide-react";
import AFAPackagesDisplay from "./AFAPackagesDisplay";
import AFARegistrationForm from "./AFARegistrationForm";

interface AFABundleSectionProps {
  agentStoreId?: string | null;
  subagentStoreId?: string | null;
  storeType?: "agent" | "subagent";
  themeColor?: string;
}

export default function AFABundleSection({
  agentStoreId,
  subagentStoreId,
  storeType = "agent",
  themeColor = "#000000",
}: AFABundleSectionProps) {
  const [selectedPackage, setSelectedPackage] = useState<{
    id: string;
    name: string;
    price: number;
  } | null>(null);
  
  const [agentBundlePrice, setAgentBundlePrice] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAFABundlePrice();
  }, [agentStoreId, subagentStoreId]);

  const loadAFABundlePrice = async () => {
    try {
      if (agentStoreId) {
        const { data } = await supabase
          .from("agent_stores")
          .select("afa_bundle_price")
          .eq("id", agentStoreId)
          .single();
        
        setAgentBundlePrice(data?.afa_bundle_price || 0);
      } else if (subagentStoreId) {
        const { data } = await supabase
          .from("subagent_stores")
          .select("afa_bundle_price")
          .eq("id", subagentStoreId)
          .single();
        
        setAgentBundlePrice(data?.afa_bundle_price || 0);
      }
    } catch (err) {
      console.error("[v0] Failed to load AFA bundle price:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = (packageId: string, packageName: string, price: number) => {
    setSelectedPackage({ id: packageId, name: packageName, price });
  };

  const handleRegistrationSuccess = () => {
    setSelectedPackage(null);
    loadAFABundlePrice();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const storeId = agentStoreId || subagentStoreId;

  return (
    <div className="space-y-6">
      {/* AFA Packages Display */}
      <AFAPackagesDisplay
        agentStoreId={agentStoreId}
        subagentStoreId={subagentStoreId}
        onRegisterClick={handlePackageSelect}
        themeColor={themeColor}
      />

      {/* AFA Registration Form - shown when package is selected */}
      {selectedPackage && storeId && (
        <Card className="border-blue-500/30 bg-blue-50/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Register for {selectedPackage.name}
            </CardTitle>
            <CardDescription>
              Registration Fee: <span className="font-bold text-blue-600">GH₵{agentBundlePrice.toFixed(2)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AFARegistrationForm
              storeId={storeId}
              storeType={storeType}
              packageId={selectedPackage.id}
              packageName={selectedPackage.name}
              amount={agentBundlePrice}
              onSuccess={handleRegistrationSuccess}
            />
          </CardContent>
        </Card>
      )}

      {/* Info about AFA Bundle Registration */}
      {!selectedPackage && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">About AFA Bundle Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <p>Choose an AFA package above to register</p>
            </div>
            <div className="flex gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <p>Fill in your details in the registration form</p>
            </div>
            <div className="flex gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <p>Pay the registration fee to activate your account</p>
            </div>
            <div className="flex gap-2">
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
              <p>Gain instant access to AFA bundle resources</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
