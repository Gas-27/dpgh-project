import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Use service role key to bypass RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { searchTerm } = req.body;

  if (!searchTerm || typeof searchTerm !== "string") {
    return res.status(400).json({ error: "searchTerm is required" });
  }

  try {
    const term = searchTerm.trim();

    // Check if term looks like a UUID
    const isLikelyUUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(term);

    // Handle topup_reference with/without "us" suffix for users
    const topupVariants = [`topup_reference.ilike.%${term}%`];
    if (!term.endsWith("us")) {
      topupVariants.push(`topup_reference.ilike.%${term}us%`);
    } else if (term.length > 2) {
      const withoutUs = term.slice(0, -2);
      topupVariants.push(`topup_reference.ilike.%${withoutUs}%`);
    }

    // Build OR filter across text columns
    const filters = [
      ...topupVariants,
      `full_name.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `user_email.ilike.%${term}%`,
      `store_name.ilike.%${term}%`,
      `api_key.ilike.%${term}%`,
    ];

    // Add UUID exact matches if applicable
    if (isLikelyUUID) {
      filters.push(`id.eq.${term}`);
      filters.push(`identity_id.eq.${term}`);
    }

    // Use service role key to bypass RLS
    const { data, error } = await supabaseAdmin
      .from("api_users")
      .select(
        "id, full_name, user_email, email, store_name, api_key, wallet, active, custom_price, topup_reference, identity_id"
      )
      .or(filters.join(","))
      .limit(20);

    if (error) {
      console.error("[v0] Search error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ data: data || [] });
  } catch (err: any) {
    console.error("[v0] Search exception:", err);
    return res.status(500).json({ error: err.message || "Search failed" });
  }
}
