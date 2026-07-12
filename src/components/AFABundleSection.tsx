'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Check } from "lucide-react";
import AFAPackagesDisplay from "./AFAPackagesDisplay";
import AFARegistrationForm from "./AFARegistrationForm";
import AFAVideoPlayer from "./AFAVideoPlayer";
import { getAFAMediaForRegistration, AFAMedia } from "@/services/afa-media-service";

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
  const [mediaList, setMediaList] = useState<AFAMedia[]>([]);

  useEffect(() => {
    loadAFABundlePrice();
    loadAFAMedia();
  }, [agentStoreId, subagentStoreId]);

  const loadAFAMedia = async () => {
    try {
      const media = await getAFAMediaForRegistration();
      setMediaList(media);
    } catch (error) {
      console.error('[v0] Error loading AFA media:', error);
    }
  };

  // Subscribe to real-time changes in agent_stores for bundle price updates
  useEffect(() => {
    if (!agentStoreId) return;

    console.log('[v0] AFABundleSection: Setting up agent subscription for', agentStoreId);
    const subscription = supabase
      .channel(`agent_stores_${agentStoreId}_realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_stores',
          filter: `id=eq.${agentStoreId}`,
        },
        (payload) => {
          console.log('[v0] AFABundleSection: Agent store updated, refreshing bundle price:', payload);
          if (payload.new && 'afa_bundle_price' in payload.new) {
            const newPrice = payload.new.afa_bundle_price ?? 0;
            console.log('[v0] AFABundleSection: Updating price to', newPrice);
            setAgentBundlePrice(newPrice);
          }
        }
      )
      .subscribe((status) => {
        console.log('[v0] AFABundleSection: Agent subscription status:', status);
      });

    return () => {
      console.log('[v0] AFABundleSection: Unsubscribing from agent channel');
      subscription.unsubscribe();
    };
  }, [agentStoreId]);

  // Subscribe to real-time changes in subagent_stores for bundle price updates
  useEffect(() => {
    if (!subagentStoreId) return;

    console.log('[v0] AFABundleSection: Setting up subagent subscription for', subagentStoreId);
    const subscription = supabase
      .channel(`subagent_stores_${subagentStoreId}_realtime`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subagent_stores',
          filter: `id=eq.${subagentStoreId}`,
        },
        (payload) => {
          console.log('[v0] AFABundleSection: Subagent store updated, refreshing bundle price:', payload);
          if (payload.new && 'afa_bundle_price' in payload.new) {
            const newPrice = payload.new.afa_bundle_price ?? 0;
            console.log('[v0] AFABundleSection: Updating subagent price to', newPrice);
            setAgentBundlePrice(newPrice);
          }
        }
      )
      .subscribe((status) => {
        console.log('[v0] AFABundleSection: Subagent subscription status:', status);
      });

    return () => {
      console.log('[v0] AFABundleSection: Unsubscribing from subagent channel');
      subscription.unsubscribe();
    };
  }, [subagentStoreId]);

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
        <>
          <Card className="border-blue-500/30 bg-blue-50/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Register for {selectedPackage.name}
              </CardTitle>
              <CardDescription>
                Registration Fee: <span className="font-bold text-blue-600">GHC{agentBundlePrice.toFixed(2)}</span>
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

          {/* AFA Explainer Video */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Learn More About AFA</h3>
            {mediaList.length > 0 ? (
              <div className="space-y-4">
                {mediaList.map((media) => (
                  <AFAVideoPlayer
                    key={media.id}
                    media={media}
                    showTitle={true}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-full aspect-video bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Video explaining AFA benefits</p>
                      <p className="text-xs text-muted-foreground mt-1">Upload a video via admin panel to display here</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
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
