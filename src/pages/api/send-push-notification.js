import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "admin@dataplug.store";

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
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!accessToken || !supabaseUrl || !supabaseKey) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !user) return res.status(401).json({ error: "Invalid session" });
    const { data: adminRole } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) return res.status(403).json({ error: "Admin permission required" });

    const { title, body, url } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    // Configure web-push
    webpush.setVapidDetails(
      `mailto:${VAPID_EMAIL}`,
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

    // Send concurrently in bounded batches so all devices receive the push promptly.
    const uniqueSubscriptions = [...new Map(subscriptions.map((sub) => [sub.endpoint, sub])).values()];
    for (let i = 0; i < uniqueSubscriptions.length; i += 100) {
      const batch = uniqueSubscriptions.slice(i, i + 100);
      const results = await Promise.allSettled(batch.map(async (sub) => {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        return sub;
      }));
      results.forEach((result) => {
        if (result.status === "fulfilled") successCount++;
        else {
          failedCount++;
          const err = result.reason;
          if (err?.statusCode === 410 || err?.statusCode === 404) failedEndpoints.push(batch[results.indexOf(result)].endpoint);
        }
      });
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
