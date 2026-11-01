import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hardenResponse, requireUser } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  hardenResponse(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  const { storeFields, topupReference } = req.body || {};
  if (!storeFields?.subagent_store_id || !storeFields?.store_name) {
    return res.status(400).json({ error: 'Missing registration fields' });
  }
  // The role and store are always bound to the authenticated caller, never a client-supplied user id.
  const userId = auth.user.id;

  const { error: roleError } = await auth.admin.from('user_roles').upsert(
    { user_id: userId, role: 'sub_subagent' },
    { onConflict: 'user_id,role', ignoreDuplicates: true }
  );
  if (roleError) {
    console.error('[complete-subsubagent-registration] role error:', roleError.message);
    return res.status(500).json({ error: 'Unable to complete registration' });
  }

  const { data, error } = await auth.admin
    .from('sub_subagent_stores')
    .upsert({ ...storeFields, user_id: userId, topup_reference: topupReference || null }, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (error) {
    console.error('[complete-subsubagent-registration] store error:', error.message);
    return res.status(500).json({ error: 'Unable to complete registration' });
  }
  return res.status(200).json({ storeId: data.id });
}
