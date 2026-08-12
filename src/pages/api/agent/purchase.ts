import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { api_key, phone_number, package_id, network } = req.body;

    // Validate required fields
    if (!api_key || !phone_number || !package_id || !network) {
      return res.status(400).json({ 
        error: 'Missing required fields: api_key, phone_number, package_id, network' 
      });
    }

    // Fetch the agent from api_users using the api_key
    const { data: apiUser, error: apiUserError } = await supabase
      .from('api_users')
      .select('identity_id, is_agent')
      .eq('api_key', api_key)
      .single();

    if (apiUserError || !apiUser || !apiUser.is_agent) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    // Get the agent's store using their identity_id
    const { data: agentStore, error: storeError } = await supabase
      .from('agent_stores')
      .select('id, store_name')
      .eq('user_id', apiUser.identity_id)
      .single();

    if (storeError || !agentStore) {
      return res.status(404).json({ error: 'Agent store not found' });
    }

    // Fetch package details to get pricing
    const { data: packageData, error: packageError } = await supabase
      .from('data_packages')
      .select('id, agent_price, name')
      .eq('id', package_id)
      .single();

    if (packageError || !packageData) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Calculate amount and pricing
    const amount = Number(packageData.agent_price) || 0;
    const sizeMatch = packageData.name?.match(/(\d+(?:\.\d+)?)/);
    const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

    // Create the order with agent_store_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_number: phone_number,
        package_id: package_id,
        network: network,
        size_gb: sizeGb,
        size_gb_text: packageData.name || null,
        amount: amount,
        // API requests are authorized against the agent's prepaid balance,
        // so the order is paid at creation just like a wallet order.
        status: 'paid',
        fulfillment_status: 'pending',
        payment_method: 'api',
        source: 'api',
        agent_store_id: agentStore.id,
        selling_price: amount,
        base_price: amount,
        profit: 0,
        profit_credited: false,
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('[v0] Order creation error:', orderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // Trigger fulfillment
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fulfill-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ order_id: order.id }),
      });
    } catch (err) {
      console.error('[v0] Fulfillment trigger error:', err);
    }

    return res.status(200).json({
      success: true,
      order_id: order.id,
      message: 'Order created successfully',
    });
  } catch (error) {
    console.error('[v0] API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
