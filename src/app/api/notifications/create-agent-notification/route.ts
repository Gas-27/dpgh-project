import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { agent_store_id, message, is_active, expires_at, type } = await req.json();

    if (!agent_store_id || !message) {
      return NextResponse.json(
        { error: "Missing required fields: agent_store_id, message" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Determine which table to insert into
    const tableName = type === "subagent" ? "agent_to_subagent_notifications" : "agent_notifications";

    const insertData: Record<string, unknown> = {
      agent_store_id,
      message,
      is_active: is_active !== false,
    };

    if (expires_at) {
      insertData.expires_at = expires_at;
    }

    console.log(`[v0] Inserting into ${tableName}:`, insertData);

    const { data, error } = await supabase
      .from(tableName)
      .insert([insertData])
      .select();

    if (error) {
      console.error(`[v0] Error inserting into ${tableName}:`, error);
      return NextResponse.json(
        { error: error.message || "Failed to create notification" },
        { status: 400 }
      );
    }

    console.log(`[v0] Successfully created notification:`, data);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error("[v0] Error in create-agent-notification:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
