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
  const { id, status = 'resolved' } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const { error } = await adminSupabase
      .from('afa_registration_reports')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[resolve-afa-report] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
