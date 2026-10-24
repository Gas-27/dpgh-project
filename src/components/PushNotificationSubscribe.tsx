'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BellOff, Loader2 } from "lucide-react";
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

interface Props {
  variant?: "icon" | "button";
  className?: string;
}

export default function PushNotificationSubscribe({ variant = "icon", className }: Props) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const subscribeToPush = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast({ 
          title: "Permission Denied", 
          description: "Please enable notifications in your browser settings.",
          variant: "destructive" 
        });
        setIsLoading(false);
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
        console.error("Error saving subscription:", error);
        toast({ title: "Error", description: "Failed to enable notifications.", variant: "destructive" });
      } else {
        setIsSubscribed(true);
        toast({ title: "Notifications Enabled", description: "You'll receive updates even when the app is closed." });
      }
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast({ title: "Error", description: "Failed to enable notifications.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  // Users cannot turn off notifications - clicking just shows a message
  const handleClick = () => {
    if (isSubscribed) {
      toast({ 
        title: "Notifications Active", 
        description: "You're receiving updates for special offers and giveaways!" 
      });
    } else {
      subscribeToPush();
    }
  };

  if (!isSupported) return null;

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={isLoading}
        className={`relative ${className}`}
        title={isSubscribed ? "Notifications enabled" : "Enable notifications"}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-5 w-5 text-primary" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        {isSubscribed && (
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={isSubscribed ? "outline" : "default"}
      onClick={handleClick}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : isSubscribed ? (
        <Bell className="h-4 w-4 mr-2" />
      ) : (
        <BellOff className="h-4 w-4 mr-2" />
      )}
      {isSubscribed ? "Notifications On" : "Enable Notifications"}
    </Button>
  );
}
