import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Service-role client bypasses RLS — required so admin can update any customer's wallet
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customer_auth_id, refund_amount, order_id } = req.body;

  if (!customer_auth_id || typeof refund_amount !== 'number' || !order_id) {
    return res.status(400).json({ error: 'Missing required fields: customer_auth_id, refund_amount, order_id' });
  }

  if (refund_amount <= 0) {
    return res.status(400).json({ error: 'refund_amount must be positive' });
  }

  // Find the customer wallet row by user_id (auth UUID)
  const { data: customer, error: fetchErr } = await adminSupabase
    .from('customers')
    .select('id, wallet_balance')
    .eq('user_id', customer_auth_id)
    .maybeSingle();

  if (fetchErr) {
    return res.status(500).json({ error: fetchErr.message });
  }

  let customerId: string;

  if (customer) {
    // Update existing wallet
    const newBalance = (Number(customer.wallet_balance) || 0) + refund_amount;
    const { error: updateErr } = await adminSupabase
      .from('customers')
      .update({ wallet_balance: newBalance })
      .eq('id', customer.id);

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }
    customerId = customer.id;
  } else {
    // Create wallet row — DB trigger fires on insert and assigns topup_reference
    const { data: newCustomer, error: insertErr } = await adminSupabase
      .from('customers')
      .insert({ user_id: customer_auth_id, wallet_balance: refund_amount })
      .select('id')
      .single();

    if (insertErr || !newCustomer) {
      return res.status(500).json({ error: insertErr?.message || 'Failed to create customer wallet' });
    }
    customerId = newCustomer.id;
  }

  // Mark the order as refunded
  const { error: orderErr } = await adminSupabase
    .from('orders')
    .update({
      status: 'refunded',
      fulfillment_status: 'refunded',
      refunded_amount: refund_amount,
    })
    .eq('id', order_id);

  if (orderErr) {
    return res.status(500).json({ error: orderErr.message });
  }

  return res.status(200).json({ success: true, customer_id: customerId });
}
