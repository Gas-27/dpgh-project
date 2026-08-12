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

    // Fetch the user from api_users using the api_key — include id for price lookup
    const { data: apiUser, error: apiUserError } = await supabase
      .from('api_users')
      .select('id, identity_id, is_user')
      .eq('api_key', api_key)
      .single();

    if (apiUserError || !apiUser || !apiUser.is_user) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    // Fetch package details — include api_price (the default API price)
    const { data: packageData, error: packageError } = await supabase
      .from('data_packages')
      .select('id, price, api_price, name')
      .eq('id', package_id)
      .single();

    if (packageError || !packageData) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Check if this API user has a per-user custom price for this package
    const { data: customPriceRow } = await supabase
      .from('api_user_package_prices')
      .select('custom_price')
      .eq('api_user_id', apiUser.id)
      .eq('package_id', package_id)
      .maybeSingle();

    // Price priority: per-user custom price → package api_price → public price
    const amount = Number(
      customPriceRow?.custom_price ?? packageData.api_price ?? packageData.price
    ) || 0;

    const sizeMatch = packageData.name?.match(/(\d+(?:\.\d+)?)/);
    const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

    // Create the order — set api_user so it appears in the user's API orders tab
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_number: phone_number,
        package_id: package_id,
        network: network,
        size_gb: sizeGb,
        size_gb_text: packageData.name || null,
        amount: amount,
        // API requests are authorized against the API user's prepaid balance,
        // so the order is paid at creation just like a wallet order.
        status: 'paid',
        fulfillment_status: 'pending',
        payment_method: 'api',
        source: 'api',
        api_user: apiUser.id,
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
