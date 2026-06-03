'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ChevronDown, ChevronUp } from 'lucide-react';
import AFARegistrationFormStandalone from './AFARegistrationFormStandalone';

export default function AFABundlesInfo() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* AFA Description Section */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-2xl">What is AFA Registration?</CardTitle>
              <CardDescription>Agriculture and Farming Association Program</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-base leading-relaxed">
              The AFA (Agriculture and Farming Association) is an exclusive program designed to support farmers and agricultural workers across Ghana. 
              By registering with AFA, you gain access to:
            </p>
            <ul className="space-y-2 ml-6">
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>Agricultural training and resources to improve your farming practices</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>Market linkages to connect with buyers and expand your reach</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>Access to premium content and agricultural insights</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>Member-only discounts and special offers</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>Networking opportunities with other farmers in your region</span>
              </li>
            </ul>
          </div>

          {/* Register Button */}
          <div className="pt-4">
            <Button
              onClick={() => setShowForm(!showForm)}
              className="w-full md:w-auto"
              size="lg"
            >
              {showForm ? (
                <>
                  <ChevronUp className="mr-2 h-5 w-5" />
                  Hide Registration Form
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-5 w-5" />
                  Register Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Registration Form - Toggleable */}
      {showForm && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <AFARegistrationFormStandalone />
        </div>
      )}
    </div>
  );
}
