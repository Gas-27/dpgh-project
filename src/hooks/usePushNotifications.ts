import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// VAPID public key - this should match your server's VAPID key
const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const subscribe = async (): Promise<boolean> => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("Notification permission denied");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save subscription to database
      const subJson = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").insert({
        endpoint: sub.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error("Error saving subscription:", error);
        return false;
      }

      setSubscription(sub);
      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    try {
      if (!subscription) return false;

      await subscription.unsubscribe();

      // Remove from database
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", subscription.endpoint);

      setSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      return false;
    }
  };

  return {
    isSupported,
    isSubscribed,
    subscribe,
    unsubscribe,
  };
}

// Auto-subscribe component that triggers after PWA install
export function PushNotificationSubscriber() {
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const [hasPrompted, setHasPrompted] = useState(false);

  useEffect(() => {
    // Only prompt once per session, after a delay
    const prompted = sessionStorage.getItem("push_prompted");
    if (prompted) {
      setHasPrompted(true);
      return;
    }

    // Check if running as PWA (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isSupported && !isSubscribed && isStandalone) {
      // Delay the subscription prompt
      const timer = setTimeout(async () => {
        sessionStorage.setItem("push_prompted", "true");
        setHasPrompted(true);
        
        // Auto-subscribe when running as PWA
        const result = await subscribe();
        if (result) {
          console.log("Successfully subscribed to push notifications");
        }
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isSupported, isSubscribed, subscribe]);

  return null; // This component doesn't render anything
}
