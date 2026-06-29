'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
      description: 'Get your own USSD code to sell data bundles directly',
    },
    {
      icon: Store,
      title: 'Shop USSD',
      description: 'Create your shop and share a unique USSD code with customers',
    },
    {
      icon: Users,
      title: 'Build Subagents',
      description: 'Create subagents under your shop - they get their own USSD codes',
    },
    {
      icon: TrendingUp,
      title: 'Multi-level Commission',
      description: 'Your subagents can create agents who all earn and you get commissions',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </DialogClose>
          <DialogTitle className="text-2xl font-bold">
            Join Our Agent Community
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Transform your earnings with amazing agent benefits
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Hero Message */}
          <Card className="bg-gradient-to-r from-blue-600 to-blue-700 border-0">
            <CardContent className="p-6 text-white">
              <h3 className="text-xl font-bold mb-2">
                Ready to Earn More?
              </h3>
              <p className="text-sm text-blue-100">
                Become an agent and access exclusive benefits that let you generate income through multiple channels.
              </p>
            </CardContent>
          </Card>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => {
              const IconComponent = benefit.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                          <IconComponent className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">
                          {benefit.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* How It Works */}
          <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3 text-sm">How It Works:</h4>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
                  <span>Sign up as an agent and get your personal USSD code</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
                  <span>Create your own shop and attract customers</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
                  <span>Build a network of subagents who also earn commission</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
                  <span>Your subagents can recruit their own agents - earn at every level</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* CTA Buttons */}
          <div className="flex gap-3 pt-4">
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
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Sign Up as Agent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
