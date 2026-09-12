import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// VAPID keys for web push - you need to generate these and set as env vars
// Generate at: https://vapidkeys.com/
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@dataplug.store";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Web Push implementation using Web Crypto API
async function sendWebPush(subscription: PushSubscription, payload: PushPayload): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(JSON.stringify(payload));

    // For production, you would use a proper web-push library
    // This is a simplified version that works with the Fetch API
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
      },
      body: payloadBytes,
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send push to:", subscription.endpoint, error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, body, url } = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "Title and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all push subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("*");

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscribers" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: PushPayload = {
      title,
      body,
      url: url || "/",
      icon: "/icons/icon-512x512.png",
    };

    let successCount = 0;
    const failedEndpoints: string[] = [];

    // Send to each subscriber
    for (const sub of subscriptions) {
      try {
        // Use the browser's Push API endpoint directly
        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok || response.status === 201) {
          successCount++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired or invalid - remove it
          failedEndpoints.push(sub.id);
        }
      } catch (err) {
        console.error("Push failed for endpoint:", sub.endpoint, err);
      }
    }

    // Clean up expired subscriptions
    if (failedEndpoints.length > 0) {
      await supabaseClient
        .from("push_subscriptions")
        .delete()
        .in("id", failedEndpoints);
    }

    // Log the sent notification
    await supabaseClient.from("sent_push_notifications").insert({
      title,
      body,
      url: url || "/",
      recipients_count: successCount,
    });

    return new Response(
      JSON.stringify({ 
        sent: successCount, 
        total: subscriptions.length,
        cleaned: failedEndpoints.length 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
