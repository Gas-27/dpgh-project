import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds.filter((id: unknown) => typeof id === 'string') : [];
  if (!orderIds.length) return res.status(200).json({ orders: [] });

  const { data, error } = await adminSupabase
    .from('orders')
    .select('id, network, size_gb, amount, status, order_status, fulfillment_status, created_at, updated_at, agent_store_id, subagent_store_id, customer_id, customer_number')
    .in('id', orderIds.slice(0, 500));

  if (error) {
    console.error('[fetch-complaint-orders] error:', error.message);
    return res.status(500).json({ error: 'Unable to load order details' });
  }
  return res.status(200).json({ orders: data || [] });
}
