import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Service-role client bypasses RLS entirely
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  const term = q.trim();

  const { data, error } = await adminSupabase
    .from('api_users')
    .select('id, full_name, user_email, email, store_name, api_key, wallet, active, custom_price, topup_reference')
    .or(
      `topup_reference.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%,user_email.ilike.%${term}%,store_name.ilike.%${term}%,api_key.ilike.%${term}%`
    )
    .limit(20);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ data: data ?? [] });
}
