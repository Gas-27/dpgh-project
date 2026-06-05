'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AFARegistrationFormStandalone from './AFARegistrationFormStandalone';

export default function AFABundlesInfo() {
  const [showForm, setShowForm] = useState(false);
  const [registrationFee, setRegistrationFee] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFee = async () => {
      try {
        const { data } = await supabase
          .from('afa_settings')
          .select('registration_fee')
          .single();
        
        setRegistrationFee(data?.registration_fee || 50);
      } catch (err) {
        setRegistrationFee(50);
      } finally {
        setLoading(false);
      }
    };

    loadFee();
  }, []);

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
              <p className="text-4xl font-bold">
                {loading ? '...' : `₵${registrationFee?.toFixed(2)}`}
              </p>
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

        {/* Registration Benefits */}
        <CardContent className="p-6 space-y-4 bg-background">
          <div>
            <Badge className="bg-cyan-500 text-white mb-3">Instant Access via Mobile Money</Badge>
            <p className="font-semibold mb-3">Benefits Include:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Agricultural training and expert resources</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Connect with buyers and expand market reach</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Premium content and farming insights</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Member-only discounts and exclusive offers</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>Network with farmers across Ghana</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Registration Form - Toggleable */}
      {showForm && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <AFARegistrationFormStandalone key="afa-form" />
        </div>
      )}
    </div>
  );
}
