'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Check, Zap } from 'lucide-react';
import AFARegistrationForm from './AFARegistrationForm';

interface AFAStandaloneRegistrationProps {
  agentStoreId?: string;
  subagentStoreId?: string;
  themeColor?: string;
}

export default function AFAStandaloneRegistration({
  agentStoreId,
  subagentStoreId,
  themeColor = '#000000'
}: AFAStandaloneRegistrationProps) {
  const { toast } = useToast();
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [registrationPrice, setRegistrationPrice] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAFASettings();
  }, [agentStoreId, subagentStoreId]);

  const fetchAFASettings = async () => {
    setLoading(true);
    try {
      // Fetch admin AFA settings
      const { data: afaSettings } = await supabase
        .from('afa_settings')
        .select('bundle_price, is_enabled')
        .single();

      if (afaSettings) {
        setRegistrationPrice(afaSettings.bundle_price || 0);
        setIsEnabled(afaSettings.is_enabled !== false);
      }

      // Fetch agent/subagent's AFA bundle price if they have a custom price
      if (agentStoreId) {
        const { data: agentData } = await supabase
          .from('agent_stores')
          .select('afa_bundle_price')
          .eq('id', agentStoreId)
          .single();
        if (agentData?.afa_bundle_price) {
          setRegistrationPrice(agentData.afa_bundle_price);
        }
      } else if (subagentStoreId) {
        const { data: subagentData } = await supabase
          .from('subagent_stores')
          .select('afa_bundle_price')
          .eq('id', subagentStoreId)
          .single();
        if (subagentData?.afa_bundle_price) {
          setRegistrationPrice(subagentData.afa_bundle_price);
        }
      }
    } catch (err) {
      console.error('Error fetching AFA settings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading AFA registration...</div>
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900">AFA Registration Currently Unavailable</p>
              <p className="text-sm text-yellow-800 mt-1">
                AFA registrations are temporarily disabled. Please try again later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-green-50/50 to-transparent border-green-500/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-2xl">AFA Bundle Registration</CardTitle>
              <CardDescription className="mt-2">
                Register as an AFA participant and get started with premium agricultural features
              </CardDescription>
            </div>
            <Badge className="bg-green-600 flex items-center gap-1 whitespace-nowrap">
              <Zap className="h-3 w-3" />
              One-Time Fee
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Registration Price Display */}
          <div className="bg-white border-2 border-green-500 rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-2">Registration Fee</p>
            <p className="text-4xl font-bold text-green-600">
              GHC {registrationPrice.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              One-time, non-refundable registration for farmer profile activation
            </p>
          </div>

          {/* Benefits List */}
          <div className="space-y-3">
            <p className="font-semibold text-sm">What you get:</p>
            <div className="grid gap-3">
              {[
                'Farmer profile with AFA verification',
                'Access to agricultural resources and packages',
                'Ability to participate in AFA programs',
                'Direct support and assistance'
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm text-blue-900">Important Notice</p>
                <p className="text-sm text-blue-800">
                  Registration fee of <strong>GHC{registrationPrice.toFixed(2)}</strong> is <strong>non-refundable</strong>. 
                  Ensure all your details are correct before submitting.
                </p>
              </div>
            </div>
          </div>

          {/* Register Button */}
          <Button
            size="lg"
            onClick={() => setShowRegistrationForm(true)}
            className="w-full bg-green-600 text-white hover:bg-green-700 transition-colors text-lg h-12"
          >
            Start AFA Registration
          </Button>
        </CardContent>
      </Card>

      {/* Registration Form Dialog */}
      <Dialog open={showRegistrationForm} onOpenChange={setShowRegistrationForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AFA Bundle Registration Form</DialogTitle>
            <DialogDescription>
              Complete your registration - Fee: GHC{registrationPrice.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <AFARegistrationForm
            storeId={agentStoreId || subagentStoreId || ''}
            storeType={agentStoreId ? 'agent' : 'subagent'}
            packageId="afa-bundle"
            packageName="AFA Bundle Registration"
            amount={registrationPrice}
            onSuccess={() => {
              setShowRegistrationForm(false);
              toast({
                title: 'Success!',
                description: 'Your AFA registration has been submitted successfully.',
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
