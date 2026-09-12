import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { id, ids, status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Missing status' });

  try {
    let error: any;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Bulk update
      ({ error } = await adminSupabase
        .from('complaints')
        .update({ status })
        .in('id', ids));
    } else if (id) {
      // Single update
      ({ error } = await adminSupabase
        .from('complaints')
        .update({ status })
        .eq('id', id));
    } else {
      return res.status(400).json({ error: 'Missing id or ids' });
    }

    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[update-complaint-status] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
