import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, adminSupabase } from '../../../lib/api-admin-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!await requireAdmin(req, res)) return;

  const { api_user_id, custom_prices } = req.body || {};
  if (typeof api_user_id !== 'string' || !Array.isArray(custom_prices) || custom_prices.length === 0) {
    return res.status(400).json({ error: 'api_user_id and custom_prices are required' });
  }

  const entries = custom_prices
    .map((row: any) => ({ package_id: String(row?.package_id || ''), custom_price: Number(row?.custom_price) }))
    .filter((row) => row.package_id && Number.isFinite(row.custom_price) && row.custom_price >= 0);
  if (entries.length === 0) return res.status(400).json({ error: 'No valid prices provided' });

  const { data: apiUser } = await adminSupabase.from('api_users').select('id').eq('id', api_user_id).maybeSingle();
  if (!apiUser) return res.status(404).json({ error: 'API user not found' });

  for (const entry of entries) {
    const { data: existing } = await adminSupabase
      .from('api_user_package_prices')
      .select('package_id')
      .eq('api_user_id', api_user_id)
      .eq('package_id', entry.package_id)
      .maybeSingle();

    const { error } = existing
      ? await adminSupabase
          .from('api_user_package_prices')
          .update({ custom_price: entry.custom_price })
          .eq('api_user_id', api_user_id)
          .eq('package_id', entry.package_id)
      : await adminSupabase
          .from('api_user_package_prices')
          .insert({ api_user_id, package_id: entry.package_id, custom_price: entry.custom_price });
    if (error) return res.status(400).json({ error: 'Failed to save custom prices' });
  }

  await adminSupabase.from('api_users').update({ custom_price: true }).eq('id', api_user_id);
  return res.status(200).json({ custom_prices_set: entries.length });
}
