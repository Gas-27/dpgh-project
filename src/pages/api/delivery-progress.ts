import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NETWORKS = ["mtn", "mtn_express", "telecel", "airteltigo"] as const;
type Network = (typeof NETWORKS)[number];

function normalizeNetwork(value: unknown): Network {
  const normalized = String(value || "mtn").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["mtnexpress", "express_mtn"].includes(normalized)) return "mtn_express";
  if (["vodafone"].includes(normalized)) return "telecel";
  if (["airtel", "airtel_tigo", "tigo"].includes(normalized)) return "airteltigo";
  return NETWORKS.includes(normalized as Network) ? (normalized as Network) : "mtn";
}

function maskNumber(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 6 ? `${digits.slice(0, 3)}****${digits.slice(-3)}` : null;
}

function durationMinutes(start: unknown, end: unknown) {
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(String(end)).getTime() - new Date(String(start)).getTime()) / 60000));
}

function hasApiAccess(value: unknown) {
  return typeof value === "string" && value.trim().length >= 12;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = String(req.headers["x-api-key"] || req.query.api_key || "").trim();
  if (!hasApiAccess(apiKey)) return res.status(401).json({ error: "Provide an API key using x-api-key or api_key" });

  const { data: apiUser, error: apiUserError } = await supabase
    .from("api_users")
    .select("id, api_key, is_active")
    .eq("api_key", apiKey)
    .maybeSingle();
  if (apiUserError || !apiUser || apiUser.is_active === false) return res.status(401).json({ error: "Invalid or inactive API key" });

  const network = normalizeNetwork(req.query.network);
  const { data: setting, error: settingError } = await supabase
    .from("delivery_progress_settings")
    .select("network,enabled,is_default,source,min_minutes,max_minutes,status_color,message,updated_at")
    .eq("network", network)
    .maybeSingle();
  if (settingError) return res.status(500).json({ error: "Unable to load delivery settings" });

  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select("id,customer_number,network,status,fulfillment_status,order_status,created_at,updated_at")
    .in("network", network === "mtn_express" ? ["mtn_express", "mtn"] : [network])
    .in("fulfillment_status", ["completed", "delivered"])
    .order("updated_at", { ascending: false })
    .limit(1);
  if (orderError) return res.status(500).json({ error: "Unable to load delivery history" });

  const latest = orders?.[0] || null;
  const payload = {
    success: true,
    data: {
      network,
      enabled: setting?.enabled ?? true,
      statusColor: setting?.status_color || "green",
      source: setting?.source || "orders",
      message: setting?.message || `${network} orders are being processed.`,
      estimatedDelivery: {
        minMinutes: Number(setting?.min_minutes || 30),
        maxMinutes: Number(setting?.max_minutes || 240),
      },
      lastDelivered: latest ? {
        orderId: latest.id,
        customerNumber: maskNumber(latest.customer_number),
        placedAt: latest.created_at,
        deliveredAt: latest.updated_at,
        durationMinutes: durationMinutes(latest.created_at, latest.updated_at),
      } : null,
      updatedAt: setting?.updated_at || null,
    },
    meta: { version: "1", generatedAt: new Date().toISOString() },
  };

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, content-type");
  return res.status(200).json(payload);
}
