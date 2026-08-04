import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Use the service role key so unauthenticated storefront customers can upload
// complaint screenshots without being blocked by RLS policies on the storage bucket.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, fileBase64, mimeType } = req.body as {
      fileName: string;
      fileBase64: string;
      mimeType: string;
    };

    if (!fileName || !fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing fileName, fileBase64, or mimeType" });
    }

    // Decode base64 to buffer
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const { data, error } = await supabaseAdmin.storage
      .from("complaints")
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error("[complaint-upload] Storage error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("complaints")
      .getPublicUrl(data.path);

    return res.status(200).json({ publicUrl: urlData.publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[complaint-upload] Unexpected error:", msg);
    return res.status(500).json({ error: msg });
  }
}
