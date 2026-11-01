import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hardenResponse, requireAdmin } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  hardenResponse(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const { data, error } = await auth.admin
      .from('afa_registration_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ data: data || [] });
  } catch (err: any) {
    console.error('[fetch-afa-reports] error:', err?.message);
    return res.status(500).json({ error: 'Unable to load reports' });
  }
}
