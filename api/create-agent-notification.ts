import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hardenResponse, requireUser } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  hardenResponse(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { agent_store_id, message, is_active, expires_at, type } = req.body || {};
  if (typeof agent_store_id !== 'string' || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Missing required fields: agent_store_id, message' });
  }
  if (message.length > 1000) return res.status(400).json({ error: 'Message is too long' });

  // Only the store owner or an admin may post notifications for a store.
  const [{ data: store }, { data: adminRole }] = await Promise.all([
    auth.admin.from('agent_stores').select('id').eq('id', agent_store_id).eq('user_id', auth.user.id).maybeSingle(),
    auth.admin
      .from('user_roles')
      .select('role')
      .eq('user_id', auth.user.id)
      .in('role', ['admin', 'sub_admin'])
      .limit(1)
      .maybeSingle(),
  ]);
  if (!store && !adminRole) return res.status(403).json({ error: 'Not allowed' });

  const tableName = type === 'subagent' ? 'agent_to_subagent_notifications' : 'agent_notifications';
  const insertData: Record<string, unknown> = {
    agent_store_id,
    message: message.trim(),
    is_active: is_active !== false,
  };
  if (expires_at) insertData.expires_at = expires_at;

  const { data, error } = await auth.admin.from(tableName).insert([insertData]).select();
  if (error) {
    console.error(`[create-agent-notification] insert into ${tableName} failed:`, error.message);
    return res.status(400).json({ error: 'Failed to create notification' });
  }
  return res.status(200).json({ success: true, message: 'Notification created', data });
}
