import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { fileName, fileBase64, mimeType } = await req.json();

    if (!fileName || !fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Missing fileName, fileBase64, or mimeType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key to bypass RLS on the complaints storage bucket.
    // Storefront customers are unauthenticated so the anon key would be blocked.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Decode base64 to Uint8Array
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, "");
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { data, error } = await supabaseAdmin.storage
      .from("complaints")
      .upload(fileName, bytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error("[upload-complaint-screenshot] Storage error:", error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("complaints")
      .getPublicUrl(data.path);

    return new Response(
      JSON.stringify({ publicUrl: urlData.publicUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[upload-complaint-screenshot] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
