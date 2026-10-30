import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, user_id } = await req.json();

    if (!email || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing email or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role (for admin operations)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Check if user already has an agent account
    const { data: existingAgent, error: checkError } = await supabase
      .from("agents")
      .select("id, email")
      .eq("email", email)
      .single();

    if (existingAgent) {
      return new Response(
        JSON.stringify({ error: "Agent account already exists with this email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's current wallet balance to transfer to agent account
    const { data: userData, error: userError } = await supabase
      .from("customers")
      .select("wallet_balance, api_wallet_balance")
      .eq("id", user_id)
      .single();

    if (userError || !userData) {
      console.error("[v0] Error fetching user data:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a unique store name from email
    const storeName = email.split("@")[0].replace(/[^a-z0-9]/gi, "") + "-store";

    // Create agent account with same email and transfer wallet balance
    const { data: agentData, error: insertError } = await supabase
      .from("agents")
      .insert({
        email: email,
        store_name: storeName,
        wallet_balance: userData.wallet_balance || 0,
        api_wallet_balance: userData.api_wallet_balance || 0,
        user_id: user_id, // Link agent to user account
        status: "active",
        created_from_user: true, // Flag to indicate upgrade from user
      })
      .select()
      .single();

    if (insertError) {
      console.error("[v0] Error creating agent account:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create agent account", details: insertError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user to mark them as having an agent account
    const { error: updateUserError } = await supabase
      .from("customers")
      .update({
        has_agent_account: true,
        agent_id: agentData.id,
      })
      .eq("id", user_id);

    if (updateUserError) {
      console.error("[v0] Error updating user:", updateUserError);
    }

    // Create notification for the user
    await supabase
      .from("notifications")
      .insert({
        user_id: user_id,
        title: "Welcome to Agent Dashboard!",
        message: "Your account has been upgraded to Agent status. You can now manage bulk orders and recruit subagents.",
        type: "agent_upgrade",
        read: false,
      })
      .catch((err) => console.error("[v0] Error creating notification:", err));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Agent account created successfully!",
        agent: agentData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[v0] Error in create-agent-account:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
