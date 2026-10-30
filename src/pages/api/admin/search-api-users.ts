import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, adminSupabase } from '../../../lib/api-admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!await requireAdmin(req, res)) return;

  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  const term = q.trim();

  const { data, error } = await adminSupabase
    .from('api_users')
    .select('id, full_name, user_email, email, store_name, wallet, active, custom_price, topup_reference')
    .or(
      `topup_reference.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%,user_email.ilike.%${term}%,store_name.ilike.%${term}%`
    )
    .limit(20);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ data: data ?? [] });
}
