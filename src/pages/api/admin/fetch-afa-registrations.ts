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
      .from('afa_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows: any[] = data || [];

    // Enrich with store names via secondary lookups
    const agentIds = [...new Set(rows.map((r) => r.agent_store_id).filter(Boolean))];
    const subagentIds = [...new Set(rows.map((r) => r.subagent_store_id).filter(Boolean))];

    const agentNameMap: Record<string, string> = {};
    const subagentNameMap: Record<string, string> = {};

    if (agentIds.length > 0) {
      const { data: agentData } = await adminSupabase
        .from('agent_stores')
        .select('id, store_name')
        .in('id', agentIds);
      (agentData || []).forEach((s: any) => { agentNameMap[s.id] = s.store_name; });
    }

    if (subagentIds.length > 0) {
      const { data: subData } = await adminSupabase
        .from('subagent_stores')
        .select('id, store_name')
        .in('id', subagentIds);
      (subData || []).forEach((s: any) => { subagentNameMap[s.id] = s.store_name; });
    }

    const enriched = rows.map((reg: any) => ({
      ...reg,
      store_name:
        agentNameMap[reg.agent_store_id] ||
        subagentNameMap[reg.subagent_store_id] ||
        'N/A',
    }));

    return res.status(200).json({ data: enriched });
  } catch (err: any) {
    console.error('[fetch-afa-registrations] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
