import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // API clients authenticate with their API key. The dashboard may also request
  // the signed-in user's history; that path uses the server-side Supabase
  // client so RLS cannot hide orders from the dashboard.
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const apiKey = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
  const requestedIdentity = typeof req.query.identity_id === 'string' ? req.query.identity_id : null;

  let apiUser;
  let apiUserError;
  if (requestedIdentity) {
    ({ data: apiUser, error: apiUserError } = await supabase
      .from('api_users')
      .select('id, identity_id, is_agent')
      .eq('identity_id', requestedIdentity)
      .maybeSingle());
  } else if (apiKey) {
    ({ data: apiUser, error: apiUserError } = await supabase
      .from('api_users')
      .select('id, identity_id, is_agent')
      .eq('api_key', apiKey)
      .maybeSingle());
  } else {
    return res.status(401).json({ success: false, error: 'Missing API key or identity' });
  }

  if (apiUserError || !apiUser) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }

  // Optional query filters
  const { status, network, limit = '100', offset = '0' } = req.query;

  let query;

  if (apiUser.is_agent) {
    // Agent: fetch orders via their agent_store_id
    const { data: agentStore } = await supabase
      .from('agent_stores')
      .select('id')
      .eq('user_id', apiUser.identity_id)
      .maybeSingle();

    if (!agentStore) {
      return res.status(404).json({ success: false, error: 'Agent store not found' });
    }

    query = supabase
      .from('orders')
      .select('id, customer_number, network, size_gb, size_gb_text, amount, selling_price, status, fulfillment_status, payment_method, source, created_at, updated_at')
      .eq('agent_store_id', agentStore.id)
      .order('created_at', { ascending: false });
  } else {
    // Regular user: fetch orders by their identity_id
    query = supabase
      .from('orders')
      .select('id, customer_number, network, size_gb, size_gb_text, amount, selling_price, status, fulfillment_status, payment_method, source, created_at, updated_at')
      .or(`user_id.eq.${apiUser.identity_id},api_user.eq.${apiUser.id}`)
      .order('created_at', { ascending: false });
  }

  // Apply optional filters
  if (status && typeof status === 'string') {
    query = query.eq('fulfillment_status', status);
  }
  if (network && typeof network === 'string') {
    query = query.ilike('network', network);
  }

  const limitNum = Math.min(parseInt(String(limit), 10) || 100, 500);
  const offsetNum = parseInt(String(offset), 10) || 0;
  query = query.range(offsetNum, offsetNum + limitNum - 1);

  const { data: orders, error: ordersError, count } = await query;

  if (ordersError) {
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }

  return res.status(200).json({
    success: true,
    data: {
      orders: orders ?? [],
      total: count ?? (orders?.length ?? 0),
    },
  });
}
