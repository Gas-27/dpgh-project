import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[API] Method:', req.method);
  console.log('[API] Has SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  if (req.method !== 'POST') {
    console.log('[API] Method not POST, returning 405');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { identity_id, is_agent, is_user } = req.body;
    console.log('[API] Request body:', { identity_id, is_agent, is_user });

    if (!identity_id) {
      return res.status(400).json({ error: 'identity_id is required' });
    }

    // Generate a new API key
    const apiKey = 'pk_live_' + crypto.randomBytes(32).toString('hex');

    // Upsert the API user record (update if exists, insert if not)
    const { data, error } = await supabase
      .from('api_users')
      .upsert(
        {
          identity_id,
          api_key: apiKey,
          is_agent: is_agent || false,
          is_user: is_user || false,
          wallet: 0,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'identity_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[API] Error upserting API key:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      data: {
        api_key: apiKey,
        wallet: data?.wallet || 0,
      },
    });
  } catch (err) {
    console.error('[API] Exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
