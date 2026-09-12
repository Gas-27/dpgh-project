import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { userId, storeFields, topupReference } = req.body || {};
  if (!userId || !storeFields?.subagent_store_id || !storeFields?.store_name) {
    return res.status(400).json({ error: 'Missing registration fields' });
  }

  const { error: roleError } = await adminSupabase.from('user_roles').upsert(
    { user_id: userId, role: 'sub_subagent' },
    { onConflict: 'user_id,role', ignoreDuplicates: true }
  );
  if (roleError) return res.status(500).json({ error: roleError.message });

  const { data, error } = await adminSupabase
    .from('sub_subagent_stores')
    .upsert({ ...storeFields, user_id: userId, topup_reference: topupReference || null }, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ storeId: data.id });
}
