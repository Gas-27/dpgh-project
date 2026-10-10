import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// VAPID keys for web push - you should generate your own
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "UUxI4O8-FbRouAf7-fG-hSJMC7O4y0rJmB1qgFgKbXY";

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, body, url } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    // Configure web-push
    webpush.setVapidDetails(
      "mailto:admin@datapluggh.com",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    // Get ALL subscriptions by paginating (Supabase default max is 1000 per request)
    const supabase = createClient(supabaseUrl, supabaseKey);
    let allSubscriptions = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data: chunk, error: fetchError } = await supabase
        .from("push_subscriptions")
        .select("*")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (fetchError) {
        console.error("Error fetching subscriptions:", fetchError);
        return res.status(500).json({ error: "Failed to fetch subscriptions" });
      }
      if (!chunk || chunk.length === 0) break;
      allSubscriptions = allSubscriptions.concat(chunk);
      if (chunk.length < pageSize) break;
      page++;
    }
    const subscriptions = allSubscriptions;

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: "No subscribers found" });
    }

    console.log(`[v0] Sending notifications to ${subscriptions.length} subscribers`);

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/",
      icon: "/icons/icon-512x512.png",
      badge: "/icons/icon-512x512.png",
    });

    let successCount = 0;
    let failedCount = 0;
    const failedEndpoints = [];

    // Send to all subscribers
    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        successCount++;
      } catch (err) {
        console.error("Failed to send to:", sub.endpoint, err.message);
        failedCount++;
        
        // Remove invalid subscriptions (expired or unsubscribed)
        if (err.statusCode === 410 || err.statusCode === 404) {
          failedEndpoints.push(sub.endpoint);
        }
      }
    }

    // Clean up invalid subscriptions
    if (failedEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", failedEndpoints);
    }

    // Log the notification
    await supabase.from("sent_push_notifications").insert({
      title,
      body,
      url: url || "/",
      recipients_count: successCount,
    });

    return res.status(200).json({
      success: true,
      sent: successCount,
      failed: failedCount,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error("Error sending push notifications:", error);
    return res.status(500).json({ error: error.message || "Failed to send notifications" });
  }
}
