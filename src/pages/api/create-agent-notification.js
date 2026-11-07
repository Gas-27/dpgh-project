const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { agent_store_id, message, is_active, expires_at, type } = req.body;

    console.log("[v0] Request body:", req.body);

    if (!agent_store_id || !message) {
      return res.status(400).json({
        error: "Missing required fields: agent_store_id, message",
      });
    }

    console.log("[v0] Creating notification:", {
      agent_store_id,
      message,
      type,
    });

    const tableName =
      type === "subagent"
        ? "agent_to_subagent_notifications"
        : "agent_notifications";

    const insertData = {
      agent_store_id,
      message,
      is_active: is_active !== false,
    };

    if (expires_at) {
      insertData.expires_at = expires_at;
    }

    console.log("[v0] Inserting into table:", tableName, insertData);

    const { data, error } = await supabase
      .from(tableName)
      .insert([insertData])
      .select();

    if (error) {
      console.error(`[v0] Error inserting into ${tableName}:`, error);
      return res.status(400).json({
        error: error.message || "Failed to create notification",
        details: error,
      });
    }

    console.log("[v0] Notification created successfully:", data);

    return res.status(200).json({
      success: true,
      message: "Notification created",
      data,
    });
  } catch (error) {
    console.error("[v0] Error in create-agent-notification:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      stack: error.stack,
    });
  }
};
