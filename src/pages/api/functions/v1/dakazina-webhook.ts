/**
 * Dakazina Webhook Proxy
 *
 * Dakazina is configured to POST to:
 *   https://api.dataplug.store/functions/v1/dakazina-webhook
 *
 * That URL resolves to this Next.js API route. We forward the raw body
 * verbatim to the Supabase edge function at:
 *   https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/dakazina-webhook
 *
 * The Supabase function handles all matching and order-status updates.
 */

import type { NextApiRequest, NextApiResponse } from "next";

// Disable Next.js body parsing — we need the raw buffer to forward exactly
export const config = {
  api: {
    bodyParser: false,
  },
};

const SUPABASE_FUNCTION_URL =
  "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/dakazina-webhook";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow Dakazina OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Read the raw body so we can forward it unchanged
  const rawBody = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

  const bodyString = rawBody.toString("utf8");

  console.log("[dakazina-proxy] Received webhook, forwarding to Supabase. body=", bodyString.slice(0, 300));

  try {
    const supabaseRes = await fetch(SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        // Supabase edge function has JWT disabled, so no auth header needed.
        // Forward any other headers Dakazina adds for future-proofing.
        ...(req.headers["x-dakazina-signature"]
          ? { "x-dakazina-signature": req.headers["x-dakazina-signature"] as string }
          : {}),
      },
      body: bodyString,
    });

    const responseText = await supabaseRes.text();

    console.log("[dakazina-proxy] Supabase response:", supabaseRes.status, responseText.slice(0, 300));

    // Mirror the Supabase response status and body back to Dakazina
    res.setHeader("Content-Type", "application/json");
    return res.status(supabaseRes.status).send(responseText);

  } catch (err: any) {
    console.error("[dakazina-proxy] Fetch to Supabase failed:", err.message);
    return res.status(502).json({
      success: false,
      error: "Proxy could not reach Supabase edge function",
      detail: err.message,
    });
  }
}
