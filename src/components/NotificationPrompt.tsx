import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// VAPID Public Key - must match the one in Vercel environment variables
const VAPID_PUBLIC_KEY = "BJUskmE3HGHt9COxYVaCsRdoIEvyH9G3N6aV-Q9AxvEPuwpB1FN5Axk5IdWXF6_8mUSbdoaUzzop92I899xVkIY";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if we should show the prompt
    const checkAndShow = async () => {
      // Don't show if not supported
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      
      // Don't show if already dismissed recently (within 1 day)
      const dismissed = localStorage.getItem("notification-prompt-dismissed");
      if (dismissed) {
        const dismissedTime = parseInt(dismissed);
        if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) return; // 1 day
      }

      // Don't show if permission already granted or denied permanently
      if (Notification.permission === "granted") return;
      if (Notification.permission === "denied") return;

      // Check if already subscribed
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) return; // Already subscribed
      } catch (e) {
        // Ignore errors
      }

      // Show after 5 seconds
      setTimeout(() => setShow(true), 5000);
    };

    checkAndShow();
  }, []);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast({ 
          title: "Permission Denied", 
          description: "You can enable notifications later from the bell icon.",
          variant: "destructive" 
        });
        handleDismiss();
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subscriptionJSON = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions" as any).insert({
        endpoint: subscriptionJSON.endpoint,
        p256dh: subscriptionJSON.keys?.p256dh,
        auth: subscriptionJSON.keys?.auth,
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error("[v0] Error saving subscription:", error);
        toast({ title: "Error", description: "Failed to enable notifications. Please try again.", variant: "destructive" });
      } else {
        toast({ 
          title: "Notifications Enabled!", 
          description: "You'll receive updates about deals and giveaways." 
        });
        setShow(false);
      }
    } catch (error) {
      console.error("[v0] Error subscribing to push:", error);
      toast({ title: "Error", description: "Failed to enable notifications.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("notification-prompt-dismissed", Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="flex justify-end">
          <button 
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-foreground">Stay Updated!</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Get instant alerts for special offers, flash sales, and free giveaways delivered straight to your phone!
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Button 
              onClick={handleEnable} 
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3"
            >
              {isLoading ? "Enabling..." : "Enable Notifications"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
