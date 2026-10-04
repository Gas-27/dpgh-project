import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Service-role client bypasses RLS so admin can update any row
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_STATUSES = ['pending', 'in-progress', 'resolved'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, ids, status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid or missing status' });
  }

  // Support single id or bulk ids array
  if (!id && (!Array.isArray(ids) || ids.length === 0)) {
    return res.status(400).json({ error: 'Missing id or ids' });
  }

  try {
    if (id) {
      const { error } = await adminSupabase
        .from('complaints')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await adminSupabase
        .from('complaints')
        .update({ status })
        .in('id', ids);
      if (error) throw error;
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[update-complaint-status] DB error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
