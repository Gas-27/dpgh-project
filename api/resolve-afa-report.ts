import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hardenResponse, requireAdmin } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  hardenResponse(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { id, status = 'resolved' } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const { error } = await auth.admin.from('afa_registration_reports').update({ status }).eq('id', id);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[resolve-afa-report] error:', err?.message);
    return res.status(500).json({ error: 'Unable to update report' });
  }
}
