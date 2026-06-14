'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AFARegistrationFormStandalone from './AFARegistrationFormStandalone';

interface AFABundlesInfoProps {
  agentId?: string;
  showAgentPrice?: boolean;
}

export default function AFABundlesInfo({ agentId, showAgentPrice = false }: AFABundlesInfoProps) {
  const [showForm, setShowForm] = useState(false);
  const [registrationFee, setRegistrationFee] = useState<number | null>(null);
  const [agentBundlePrice, setAgentBundlePrice] = useState<number | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFee = async () => {
      try {
        // Get admin settings including registration enabled status
        const { data, error } = await supabase
          .from('afa_settings')
          .select('registration_fee, registration_enabled')
          .single();
        
        if (error) {
          console.log("[v0] AFABundlesInfo error:", error.message);
          setRegistrationFee(15);
        } else {
          setRegistrationFee(data?.registration_fee || 15);
          setRegistrationEnabled(data?.registration_enabled !== false);
        }

        // Get agent's custom price if agent ID provided
        if (agentId && showAgentPrice) {
          const { data: agentStore } = await supabase
            .from('agent_stores')
            .select('afa_bundle_price')
            .eq('id', agentId)
            .single();
          
          console.log("[v0] Agent AFA bundle price:", agentStore);
          // If agent has set a custom price, use it; otherwise leave as null to fall back to admin fee
          if (agentStore?.afa_bundle_price !== null && agentStore?.afa_bundle_price !== undefined) {
            setAgentBundlePrice(agentStore.afa_bundle_price);
          } else {
            // Agent hasn't set a price, so use null to trigger fallback to admin registration fee
            setAgentBundlePrice(null);
          }
        }
      } catch (err) {
        console.log('[v0] Error loading AFA fees:', err);
        setRegistrationFee(15);
        setRegistrationEnabled(true);
      } finally {
        setLoading(false);
      }
    };

    loadFee();

    // Subscribe to real-time changes in afa_settings
    const afaSettingsSubscription = supabase
      .channel('afa_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'afa_settings',
        },
        (payload) => {
          console.log('[v0] AFA settings updated:', payload);
          if (payload.new) {
            setRegistrationFee(payload.new.registration_fee || 15);
            setRegistrationEnabled(payload.new.registration_enabled !== false);
          }
        }
      )
      .subscribe();

    // Subscribe to real-time changes in agent_stores for bundle price updates
    let agentStoresSubscription: any = null;
    if (agentId && showAgentPrice) {
      agentStoresSubscription = supabase
        .channel(`agent_stores_${agentId}_bundle`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'agent_stores',
            filter: `id=eq.${agentId}`,
          },
          (payload) => {
            console.log('[v0] Agent store bundle price updated:', payload);
            if (payload.new && 'afa_bundle_price' in payload.new) {
              // Agent might have updated their price to any value, including null
              const newPrice = payload.new.afa_bundle_price;
              console.log('[v0] Setting agent bundle price to:', newPrice);
              setAgentBundlePrice(newPrice);
            }
          }
        )
        .subscribe();
    }

    return () => {
      afaSettingsSubscription.unsubscribe();
      if (agentStoresSubscription) {
        agentStoresSubscription.unsubscribe();
      }
    };
  }, [agentId, showAgentPrice]);

  // If registration is disabled, show a message instead of the form
  if (!registrationEnabled && !loading) {
    console.log('[v0] AFABundlesInfo: Registration disabled, showing closed message');
    return (
      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950 border-yellow-200 dark:border-yellow-800">
        <CardContent className="p-6 text-center">
          <div className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
            AFA Registration is Temporarily Closed
          </div>
          <p className="text-yellow-800 dark:text-yellow-200">
            AFA Bundle registrations are currently disabled. Please check back later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* AFA Info Marketing Section */}
      <Card className="w-full bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800 rounded-none md:rounded-lg">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-blue-900 dark:text-blue-100 mb-3 md:mb-4">🎉 What is AFA Registration?</h3>
            <p className="text-blue-800 dark:text-blue-200 text-sm md:text-base mb-4 leading-relaxed">
              AFA Registration activates your MTN number for the MTN AFA platform, giving you access to special call and bundle offers not available to regular users. 📱🔥
            </p>
          </div>

          <div>
            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2 md:mb-3 text-sm md:text-base">🎁 What do you get after activation?</h4>
            <ul className="space-y-2 text-blue-800 dark:text-blue-200 text-xs md:text-sm">
              <li className="flex items-center gap-2">
                <span>✅</span>
                <span>220 MTN call minutes</span>
              </li>
              <li className="flex items-center gap-2">
                <span>✅</span>
                <span>20 minutes to call other networks</span>
              </li>
              <li className="flex items-center gap-2">
                <span>✅</span>
                <span>50 SMS</span>
              </li>
              <li className="flex items-center gap-2">
                <span>✅</span>
                <span>FREE calls to other AFA members</span>
              </li>
              <li className="flex items-center gap-2">
                <span>✅</span>
                <span>Renew your package monthly and continue enjoying the benefits</span>
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 md:p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-xs md:text-sm text-blue-900 dark:text-blue-200">
              💡 <strong>If you make a lot of calls, AFA can help you save money while staying connected to friends, family, customers, and colleagues.</strong>
            </p>
          </div>

          <p className="text-blue-900 dark:text-blue-100 font-semibold text-sm md:text-base">
            🚀 Register once and start enjoying exclusive AFA benefits today!
          </p>
        </CardContent>
      </Card>

      {/* MTN AFA Benefits & Offers Section */}
      <Card className="w-full border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 rounded-none md:rounded-lg">
        <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
          <h3 className="text-lg md:text-xl font-bold text-green-900 dark:text-green-100">🎉 MTN AFA Benefits & Offers</h3>
          <p className="text-xs md:text-sm text-green-800 dark:text-green-200">Once your MTN number is registered on AFA, you can enjoy:</p>

          {/* Voice Bundle */}
          <div className="space-y-2">
            <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm md:text-base">📞 Voice Bundle (Most Popular)</h4>
            <ul className="space-y-1 text-xs md:text-sm text-green-800 dark:text-green-200 ml-4">
              <li>• 200 MTN minutes</li>
              <li>• 20 minutes to other networks</li>
              <li>• 1,000 MTN SMS</li>
              <li>• 50 SMS to other networks</li>
              <li>• FREE calls to other AFA members</li>
            </ul>
          </div>

          {/* Voice + Data Bundle */}
          <div className="space-y-2">
            <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm md:text-base">📱 Voice + Data Bundle</h4>
            <ul className="space-y-1 text-xs md:text-sm text-green-800 dark:text-green-200 ml-4">
              <li>• 140 MTN minutes</li>
              <li>• 20 minutes to other networks</li>
              <li>• 150MB data</li>
              <li>• 1,000 MTN SMS</li>
              <li>• 50 SMS to other networks</li>
              <li>• FREE calls to other AFA members</li>
            </ul>
          </div>

          {/* AFA Voice Packages */}
          <div className="space-y-2">
            <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm md:text-base">💰 AFA Voice Packages</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs md:text-sm text-green-800 dark:text-green-200 ml-4">
              <div>• GH₵6 → 220 min</div>
              <div>• GH₵12 → 440 min</div>
              <div>• GH₵18 → 660 min</div>
              <div>• GH₵24 → 880 min</div>
              <div>• GH₵30 → 1,100 min</div>
              <div>• GH₵36 → 1,320 min</div>
            </div>
          </div>

          {/* Extra Benefits */}
          <div className="space-y-2 bg-white dark:bg-slate-900 rounded-lg p-3 md:p-4 border border-green-200 dark:border-green-800">
            <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm md:text-base">🔥 Extra Benefits</h4>
            <ul className="space-y-1 text-xs md:text-sm text-green-800 dark:text-green-200">
              <li>✅ Free calls between AFA members</li>
              <li>✅ Cheaper voice rates</li>
              <li>✅ Special MTN offers unavailable to regular users</li>
              <li>✅ One-time registration</li>
              <li>✅ Renew and continue enjoying the benefits</li>
            </ul>
          </div>

          <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-3 border border-blue-300 dark:border-blue-700">
            <p className="text-xs md:text-sm text-blue-900 dark:text-blue-100 font-semibold">
              📞 Dial *1848# after registration to access AFA bundles.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AFA Registration Card - Like Package Cards */}
      <Card className="w-full overflow-hidden border-0 shadow-lg rounded-none md:rounded-lg">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 md:p-8 text-white">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-start gap-3 flex-1">
              <Zap className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0 mt-1" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg md:text-xl font-bold">AFA REGISTRATION</h3>
                <p className="text-blue-100 text-xs md:text-sm">(Both Registration & Verification)</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="text-center py-4 md:py-6">
              <p className="text-blue-100 mb-2 text-xs md:text-sm">Registration Fee</p>
              {showAgentPrice && agentBundlePrice ? (
                <div className="space-y-2">
                  <p className="text-3xl md:text-4xl font-bold">
                    ₵{agentBundlePrice.toFixed(2)}
                  </p>
                </div>
              ) : (
                <p className="text-3xl md:text-4xl font-bold">
                  {loading ? '...' : `₵${registrationFee?.toFixed(2)}`}
                </p>
              )}
            </div>

            <Button
              onClick={() => setShowForm(!showForm)}
              className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold py-5 md:py-6 rounded-full text-sm md:text-base"
              size="lg"
            >
              {showForm ? 'Hide Form' : 'Register'}
            </Button>
          </div>
        </div>

        {/* Registration Form - Toggleable */}
        {showForm && (
          <CardContent className="p-4 md:p-6 space-y-4">
            <AFARegistrationFormStandalone 
              key="afa-form" 
              registrationFee={agentBundlePrice || registrationFee || 50}
              agentStoreId={agentId}
              agentBundlePrice={agentBundlePrice}
            />
          </CardContent>
        )}
      </Card>

      {/* Registration Approval Timeline */}
      <Card className="w-full border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 rounded-none md:rounded-lg">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⏱️</div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm md:text-base mb-2">Registration Approval Timeline</h4>
              <p className="text-xs md:text-sm text-amber-800 dark:text-amber-200">
                After successful payment, your AFA registration will be processed and approved by MTN within <strong>24 to 72 hours</strong>. You will receive a confirmation SMS once your registration is activated. Please ensure your phone is reachable during this period.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Form - Outside Card if needed */}
      {showForm && false && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <AFARegistrationFormStandalone key="afa-form" />
        </div>
      )}
    </div>
  );
}
