'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Smartphone,
  Store,
  Users,
  TrendingUp,
  X,
  Globe,
  Palette,
  Wallet,
  Settings,
  Zap,
  Share2,
  BarChart3,
  Lock,
  Rocket,
  ArrowRight,
} from 'lucide-react';

interface AgentSignupPromptProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function AgentSignupPrompt({
  open: controlledOpen,
  onOpenChange,
}: AgentSignupPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Use controlled or uncontrolled mode
  const open = controlledOpen !== undefined ? controlledOpen : isOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) {
      setIsOpen(value);
    }
    onOpenChange?.(value);
  };

  useEffect(() => {
    // Show popup on first visit to packages page
    const hasSeenPopup = sessionStorage.getItem('agent_signup_popup_seen');
    if (!hasSeenPopup) {
      setOpen(true);
      sessionStorage.setItem('agent_signup_popup_seen', 'true');
    }
  }, []);

  const benefits = [
    {
      icon: Smartphone,
      title: 'Personal USSD',
      description: 'Get your own USSD code to sell data bundles directly to customers',
      color: 'from-blue-600 to-blue-700',
    },
    {
      icon: Store,
      title: 'Shop USSD',
      description: 'Create your shop and share a unique USSD code with your customers',
      color: 'from-cyan-600 to-cyan-700',
    },
    {
      icon: Globe,
      title: 'Custom Store Link',
      description: 'Get your personalized storefront URL with your shop name - build your brand',
      color: 'from-purple-600 to-purple-700',
    },
    {
      icon: Palette,
      title: 'Free Flyer Generator',
      description: 'Create beautiful, customizable flyers to promote your business on social media',
      color: 'from-pink-600 to-pink-700',
    },
    {
      icon: Users,
      title: 'Build Subagents',
      description: 'Recruit subagents who get their own USSD codes and earning power',
      color: 'from-green-600 to-green-700',
    },
    {
      icon: BarChart3,
      title: 'Multi-Level Earnings',
      description: 'Your subagents can recruit agents - earn commissions at every level',
      color: 'from-orange-600 to-orange-700',
    },
    {
      icon: Settings,
      title: 'AFA Management',
      description: 'Set your own AFA bundle prices and manage registrations from your dashboard',
      color: 'from-red-600 to-red-700',
    },
    {
      icon: Zap,
      title: 'API Access',
      description: 'Access our API with heavily discounted pricing for bulk operations',
      color: 'from-yellow-600 to-yellow-700',
    },
    {
      icon: Wallet,
      title: 'Instant Withdrawals',
      description: 'Withdraw your earnings instantly, anytime - no delays or hidden fees',
      color: 'from-emerald-600 to-emerald-700',
    },
    {
      icon: Share2,
      title: 'Marketing Tools',
      description: 'Access templates, promotional content, and ready-made marketing materials',
      color: 'from-indigo-600 to-indigo-700',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogClose className="absolute right-4 top-4 z-10">
          <X className="h-5 w-5" />
        </DialogClose>

        {/* Premium Header */}
        <div className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 text-white p-8 rounded-lg -mx-6 -mt-6 mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Rocket className="h-8 w-8" />
                Unlock Your Earning Potential
              </h2>
              <p className="text-blue-100 text-lg">Join thousands of successful agents building their income empire</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Benefits Grid - 2 columns */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-foreground">Exclusive Agent Benefits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {benefits.map((benefit, index) => {
                const IconComponent = benefit.icon;
                return (
                  <Card key={index} className="hover:shadow-md transition-all hover:border-primary/50">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${benefit.color} text-white flex-shrink-0`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">{benefit.title}</h4>
                          <p className="text-xs text-muted-foreground leading-tight">{benefit.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Quick Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              Why Agents Love Our Platform
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="font-bold text-lg text-blue-600">10+</p>
                <p className="text-sm text-muted-foreground">Revenue streams and earning opportunities</p>
              </div>
              <div>
                <p className="font-bold text-lg text-cyan-600">Unlimited</p>
                <p className="text-sm text-muted-foreground">Commission levels - build your own empire</p>
              </div>
              <div>
                <p className="font-bold text-lg text-purple-600">24/7</p>
                <p className="text-sm text-muted-foreground">Instant withdrawals, anytime you want</p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div>
            <h3 className="text-lg font-bold mb-4">Your Path to Success</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold mx-auto mb-3">1</div>
                <p className="font-semibold text-sm mb-2">Sign Up</p>
                <p className="text-xs text-muted-foreground">Create account & get your personal USSD</p>
              </div>
              <div className="flex items-center justify-center md:col-span-1">
                <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
              </div>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="bg-cyan-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold mx-auto mb-3">2</div>
                <p className="font-semibold text-sm mb-2">Setup Shop</p>
                <p className="text-xs text-muted-foreground">Create storefront & start selling</p>
              </div>
              <div className="flex items-center justify-center md:col-span-1">
                <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
              </div>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg md:col-span-2">
                <div className="bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold mx-auto mb-3">3</div>
                <p className="font-semibold text-sm mb-2">Build Network & Earn</p>
                <p className="text-xs text-muted-foreground">Recruit agents & enjoy multi-level earnings</p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => {
                navigate('/agent-signup');
                setOpen(false);
              }}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold"
            >
              Start Earning Today
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
