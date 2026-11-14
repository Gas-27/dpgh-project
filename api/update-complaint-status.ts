import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hardenResponse, requireAdmin } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  hardenResponse(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { id, ids, status } = req.body || {};
  if (typeof status !== 'string' || !status) return res.status(400).json({ error: 'Missing status' });

  try {
    let error: { message: string } | null = null;
    if (Array.isArray(ids) && ids.length > 0) {
      ({ error } = await auth.admin
        .from('complaints')
        .update({ status })
        .in('id', ids.slice(0, 500)));
    } else if (id) {
      ({ error } = await auth.admin.from('complaints').update({ status }).eq('id', id));
    } else {
      return res.status(400).json({ error: 'Missing id or ids' });
    }

    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[update-complaint-status] error:', err?.message);
    return res.status(500).json({ error: 'Unable to update complaint' });
  }
}
