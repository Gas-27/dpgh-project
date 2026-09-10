// Vercel serverless function: /api/setup-complaints-columns
// Applies missing ALTER TABLE statements to the complaints table using
// Supabase's management SQL API.  Idempotent — safe to call repeatedly.

const STATEMENTS = [
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS screenshot_url TEXT`,
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS sms_screenshot_url TEXT`,
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_airtime BOOLEAN`,
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_bundle BOOLEAN`,
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_momo BOOLEAN`,
];

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ success: false, error: "Missing Supabase credentials" });
  }

  // Derive project ref from the URL, e.g. https://xyzcompany.supabase.co -> xyzcompany
  let projectRef = "";
  try {
    const urlObj = new URL(supabaseUrl);
    projectRef = urlObj.hostname.split(".")[0];
  } catch (_) {
    return res.status(500).json({ success: false, error: "Could not parse Supabase URL" });
  }

  const results = [];

  for (const sql of STATEMENTS) {
    try {
      // Use Supabase management API to execute raw SQL
      const response = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ query: sql }),
        }
      );

      if (response.ok) {
        results.push({ sql: sql.slice(0, 70), ok: true });
      } else {
        const body = await response.text();
        // 409/already-exists is still ok for ADD COLUMN IF NOT EXISTS
        if (response.status === 409 || body.includes("already exists")) {
          results.push({ sql: sql.slice(0, 70), ok: true, note: "already exists" });
        } else {
          results.push({ sql: sql.slice(0, 70), ok: false, error: body.slice(0, 200) });
        }
      }
    } catch (err) {
      results.push({ sql: sql.slice(0, 70), ok: false, error: err.message });
    }
  }

  const allOk = results.every((r) => r.ok);
  return res.status(200).json({ success: allOk, results });
};
