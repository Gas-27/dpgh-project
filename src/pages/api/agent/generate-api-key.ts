import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // The key can only be issued to the signed-in caller for their own account.
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Authentication required' });

    const identityId = user.id;
    const { is_agent, is_user } = req.body || {};
    const apiKey = 'pk_live_' + crypto.randomBytes(32).toString('hex');

    const { data: existing, error: lookupError } = await supabase
      .from('api_users')
      .select('id')
      .eq('identity_id', identityId)
      .maybeSingle();
    if (lookupError) return res.status(500).json({ error: 'Unable to generate API key' });

    // Never touch the wallet balance when rotating a key.
    const query = existing
      ? supabase
          .from('api_users')
          .update({ api_key: apiKey, updated_at: new Date().toISOString() })
          .eq('identity_id', identityId)
      : supabase.from('api_users').insert({
          identity_id: identityId,
          api_key: apiKey,
          is_agent: Boolean(is_agent),
          is_user: Boolean(is_user),
          wallet: 0,
          updated_at: new Date().toISOString(),
        });

    const { data, error } = await query.select('wallet').single();

    if (error) {
      console.error('[API] Error saving API key');
      return res.status(400).json({ error: 'Unable to generate API key' });
    }

    return res.status(200).json({
      data: {
        api_key: apiKey,
        wallet: data?.wallet || 0,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
