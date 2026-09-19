import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await adminSupabase
      .from('afa_registration_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ data: data || [] });
  } catch (err: any) {
    console.error('[fetch-afa-reports] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
