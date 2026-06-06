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
          .select('package_page_price, registration_enabled')
          .single();
        
        console.log("[v0] AFABundlesInfo loading settings:", { data, error });
        if (error) {
          console.log("[v0] AFABundlesInfo error:", error.message);
        }
        setRegistrationFee(data?.package_page_price || 50);
        setRegistrationEnabled(data?.registration_enabled !== false);
        console.log("[v0] AFABundlesInfo set registration_enabled to:", data?.registration_enabled);

        // Get agent's custom price if agent ID provided
        if (agentId && showAgentPrice) {
          const { data: agentStore } = await supabase
            .from('agent_stores')
            .select('afa_bundle_price')
            .eq('id', agentId)
            .single();
          
          console.log("[v0] Agent AFA bundle price:", agentStore);
          if (agentStore?.afa_bundle_price) {
            setAgentBundlePrice(agentStore.afa_bundle_price);
          }
        }
      } catch (err) {
        console.log('[v0] Error loading AFA fees:', err);
        setRegistrationFee(50);
        setRegistrationEnabled(true);
      } finally {
        setLoading(false);
      }
    };

    loadFee();

    // Subscribe to real-time changes
    const subscription = supabase
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
            setRegistrationFee(payload.new.package_page_price || 50);
            setRegistrationEnabled(payload.new.registration_enabled !== false);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
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
    <div className="space-y-6">
      {/* AFA Info Marketing Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">🎉 What is AFA Registration?</h3>
            <p className="text-blue-800 dark:text-blue-200 mb-4">
              AFA Registration activates your MTN number for the MTN AFA platform, giving you access to special call and bundle offers not available to regular users. 📱🔥
            </p>
          </div>

          <div>
            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-3">🎁 What do you get after activation?</h4>
            <ul className="space-y-2 text-blue-800 dark:text-blue-200 text-sm">
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

          <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              💡 <strong>If you make a lot of calls, AFA can help you save money while staying connected to friends, family, customers, and colleagues.</strong>
            </p>
          </div>

          <p className="text-blue-900 dark:text-blue-100 font-semibold">
            🚀 Register once and start enjoying exclusive AFA benefits today!
          </p>
        </CardContent>
      </Card>

      {/* MTN AFA Benefits & Offers Section */}
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
        <CardContent className="p-6 space-y-6">
          <h3 className="text-lg font-bold text-green-900 dark:text-green-100">🎉 MTN AFA Benefits & Offers</h3>
          <p className="text-sm text-green-800 dark:text-green-200">Once your MTN number is registered on AFA, you can enjoy:</p>

          {/* Voice Bundle */}
          <div className="space-y-2">
            <h4 className="font-semibold text-green-900 dark:text-green-100">📞 Voice Bundle (Most Popular)</h4>
            <ul className="space-y-1 text-sm text-green-800 dark:text-green-200 ml-4">
              <li>• 200 MTN minutes</li>
              <li>• 20 minutes to other networks</li>
              <li>• 1,000 MTN SMS</li>
              <li>• 50 SMS to other networks</li>
              <li>• FREE calls to other AFA members</li>
            </ul>
          </div>

          {/* Voice + Data Bundle */}
          <div className="space-y-2">
            <h4 className="font-semibold text-green-900 dark:text-green-100">📱 Voice + Data Bundle</h4>
            <ul className="space-y-1 text-sm text-green-800 dark:text-green-200 ml-4">
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
            <h4 className="font-semibold text-green-900 dark:text-green-100">💰 AFA Voice Packages</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-green-800 dark:text-green-200 ml-4">
              <div>• GH₵6 → 220 minutes</div>
              <div>• GH₵12 → 440 minutes</div>
              <div>• GH₵18 → 660 minutes</div>
              <div>• GH₵24 → 880 minutes</div>
              <div>• GH₵30 → 1,100 minutes</div>
              <div>• GH₵36 → 1,320 minutes</div>
            </div>
          </div>

          {/* Extra Benefits */}
          <div className="space-y-2 bg-white dark:bg-slate-900 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <h4 className="font-semibold text-green-900 dark:text-green-100">🔥 Extra Benefits</h4>
            <ul className="space-y-1 text-sm text-green-800 dark:text-green-200">
              <li>✅ Free calls between AFA members</li>
              <li>✅ Cheaper voice rates</li>
              <li>✅ Special MTN offers unavailable to regular users</li>
              <li>✅ One-time registration</li>
              <li>✅ Renew and continue enjoying the benefits</li>
            </ul>
          </div>

          <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-3 border border-blue-300 dark:border-blue-700">
            <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold">
              📞 Dial *1848# after registration to access AFA bundles.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AFA Registration Card - Like Package Cards */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white rounded-t-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6" />
              <div>
                <h3 className="text-xl font-bold">AFA REGISTRATION</h3>
                <p className="text-blue-100 text-sm">(Both Reg. & Verification)</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-blue-100">
              Join the Agriculture and Farming Association to access training, market linkages, and exclusive member benefits
            </p>
            
            <div className="text-center py-4">
              <p className="text-blue-100 mb-2">Registration Fee</p>
              {showAgentPrice && agentBundlePrice ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg text-blue-100 line-through">₵{registrationFee?.toFixed(2)}</span>
                    <span className="text-sm text-blue-200">(Base Price)</span>
                  </div>
                  <p className="text-4xl font-bold">
                    ₵{agentBundlePrice.toFixed(2)}
                  </p>
                  <p className="text-sm text-blue-200">
                    Your markup: ₵{(agentBundlePrice - (registrationFee || 0)).toFixed(2)}
                  </p>
                </div>
              ) : (
                <p className="text-4xl font-bold">
                  {loading ? '...' : `₵${registrationFee?.toFixed(2)}`}
                </p>
              )}
            </div>

            <Button
              onClick={() => setShowForm(!showForm)}
              className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold py-6 rounded-full"
              size="lg"
            >
              {showForm ? 'Hide Form' : 'Register'}
            </Button>
          </div>
        </div>

        {/* Registration Form - Toggleable */}
        {showForm && (
          <CardContent className="p-6">
            <AFARegistrationFormStandalone 
              key="afa-form" 
              registrationFee={agentBundlePrice || registrationFee || 50}
            />
          </CardContent>
        )}
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
