import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Service-role client bypasses RLS so admin can update any row
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: 'Missing id or status' });
  }
  if (!['resolved', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const { error } = await adminSupabase
    .from('afa_registration_reports')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('[resolve-afa-report] DB error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
