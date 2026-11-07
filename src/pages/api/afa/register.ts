import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  if (!process.env.AFA_API_KEY || !process.env.AFA_API_URL) {
    return res.status(503).json({ success: false, message: 'AFA provider is not configured' });
  }

  const { data, storeId, storeType } = req.body ?? {};
  if (!data?.customer_name || !data?.customer_phone || !data?.package_id || !storeId || !storeType) {
    return res.status(400).json({ success: false, message: 'Required registration details are missing' });
  }

  try {
    const providerResponse = await fetch(`${process.env.AFA_API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AFA_API_KEY}`,
        'X-Store-ID': String(storeId),
        'X-Store-Type': String(storeType),
      },
      body: JSON.stringify({
        name: data.customer_name,
        phone: data.customer_phone,
        id_number: data.customer_id,
        dob: data.date_of_birth,
        town: data.town,
        occupation: data.occupation,
        region: data.region,
        crop: data.crop,
        package_id: data.package_id,
        amount: data.amount,
        timestamp: new Date().toISOString(),
      }),
    });
    const providerData = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) return res.status(502).json({ success: false, message: 'AFA provider rejected the registration' });

    const { data: registration, error } = await supabaseAdmin.from('afa_registrations').insert({
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_id: data.customer_id,
      date_of_birth: data.date_of_birth,
      town: data.town,
      occupation: data.occupation,
      region: data.region,
      crop: data.crop,
      afa_ref_id: providerData.ref_id,
      registration_status: 'pending',
      afa_package_id: data.package_id,
      ...(data.agent_store_id ? { agent_store_id: data.agent_store_id } : storeType === 'agent' ? { agent_store_id: storeId } : {}),
      ...(data.subagent_store_id ? { subagent_store_id: data.subagent_store_id } : storeType === 'subagent' ? { subagent_store_id: storeId } : {}),
      ...(data.subsubagent_store_id ? { subsubagent_store_id: data.subsubagent_store_id } : storeType === 'subsubagent' ? { subsubagent_store_id: storeId } : {}),
    }).select().single();
    if (error) return res.status(500).json({ success: false, message: 'Registration was accepted but could not be saved' });
    return res.status(200).json({ success: true, ref_id: providerData.ref_id, message: 'Registration submitted successfully. Awaiting verification.', data: registration });
  } catch {
    return res.status(502).json({ success: false, message: 'Unable to reach AFA provider' });
  }
}
