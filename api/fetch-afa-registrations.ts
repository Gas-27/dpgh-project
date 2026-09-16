import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminSupabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    if (!adminSupabase) return res.status(503).json({ error: 'Supabase server configuration is missing' });
    // Fetch all registrations with store name lookups
    const { data: rows, error } = await adminSupabase
      .from('afa_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const regs = rows || [];
    const agentIds = [...new Set(regs.map((r: any) => r.agent_store_id).filter(Boolean))];
    const subagentIds = [...new Set(regs.map((r: any) => r.subagent_store_id).filter(Boolean))];
    const subsubIds = [...new Set(regs.map((r: any) => r.sub_subagent_store_id).filter(Boolean))];

    const agentNameMap: Record<string, string> = {};
    const subagentNameMap: Record<string, string> = {};
    const subsubNameMap: Record<string, string> = {};

    if (agentIds.length > 0) {
      const { data } = await adminSupabase.from('agent_stores').select('id, store_name').in('id', agentIds);
      (data || []).forEach((s: any) => { agentNameMap[s.id] = s.store_name; });
    }
    if (subagentIds.length > 0) {
      const { data } = await adminSupabase.from('subagent_stores').select('id, store_name').in('id', subagentIds);
      (data || []).forEach((s: any) => { subagentNameMap[s.id] = s.store_name; });
    }
    if (subsubIds.length > 0) {
      const { data } = await adminSupabase.from('sub_subagent_stores').select('id, store_name').in('id', subsubIds);
      (data || []).forEach((s: any) => { subsubNameMap[s.id] = s.store_name; });
    }

    const data = regs.map((reg: any) => ({
      ...reg,
      store_name:
        subsubNameMap[reg.sub_subagent_store_id] ||
        subagentNameMap[reg.subagent_store_id] ||
        agentNameMap[reg.agent_store_id] ||
        'N/A',
    }));

    return res.status(200).json({ data });
  } catch (err: any) {
    console.error('[fetch-afa-registrations] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
