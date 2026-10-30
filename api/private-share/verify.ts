import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SELLER_KINDS = ['agent', 'subagent', 'subsubagent'];
const SUBSCRIPTION_COLUMNS = 'id, payment_status, confirmation_status, whatsapp_url, payment_reference, service_name';

const adminSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const reference = String(req.body?.reference || '').trim();
  if (!reference) return res.status(400).json({ error: 'Missing reference' });

  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackKey) return res.status(500).json({ error: 'Paystack not configured' });

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackKey}`, Accept: 'application/json' },
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.status || verifyData.data?.status !== 'success') {
    return res.status(400).json({ error: 'Payment not verified', details: verifyData.message });
  }

  const tx = verifyData.data;
  const metadata = tx.metadata || {};
  const isSubscription =
    metadata.type === 'service_payment' ||
    metadata.type === 'subscription' ||
    metadata.service_payment === true ||
    metadata.service_payment === 'true';
  if (!isSubscription) return res.status(400).json({ error: 'Not a private-share subscription payment' });

  const supabase = adminSupabase();
  const paystackEmail = String(tx.customer?.email || '').trim().toLowerCase();
  const authenticatedUserId = String(metadata.user_id || metadata.customer_id || '').trim();

  let { data: subscription } = await supabase
    .from('private_share_subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('payment_reference', reference)
    .maybeSingle();

  if (!subscription) {
    const serviceId = metadata.service_id ? String(metadata.service_id) : null;
    const { data: service } = serviceId
      ? await supabase.from('digital_services').select('name').eq('id', serviceId).maybeSingle()
      : { data: null };
    const amountPaid = Number(tx.amount || 0) / 100;
    const sellerKind = String(
      metadata.seller_store_kind ||
        (metadata.subsubagent_store_id ? 'subsubagent' : metadata.subagent_store_id ? 'subagent' : metadata.agent_store_id ? 'agent' : ''),
    ).trim();
    const sellerStoreId =
      metadata.seller_store_id || metadata.subsubagent_store_id || metadata.subagent_store_id || metadata.agent_store_id || null;
    const baseAmount = Number(metadata.base_amount || amountPaid);
    const paidAt = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from('private_share_subscriptions')
      .insert({
        payment_reference: reference,
        customer_id: authenticatedUserId || null,
        customer_name: String(metadata.customer_name || tx.customer?.first_name || '').trim() || null,
        customer_email: paystackEmail || null,
        customer_phone: String(metadata.customer_phone || metadata.phone || tx.customer?.phone || '').trim() || null,
        service_id: serviceId,
        service_name: String(metadata.service_name || service?.name || 'Private-share subscription').trim(),
        amount: amountPaid,
        fee_amount: Number(metadata.fee_amount || 0),
        selling_price: baseAmount,
        seller_store_kind: SELLER_KINDS.includes(sellerKind) ? sellerKind : null,
        seller_store_id: sellerStoreId,
        payment_status: 'paid',
        confirmation_status: 'pending',
        paid_at: paidAt,
        delivery_mode: 'onsite',
        provider_payload: { event: 'api-verify', data: tx },
        updated_at: paidAt,
      })
      .select(SUBSCRIPTION_COLUMNS)
      .single();

    if (inserted) {
      subscription = inserted;
      if (sellerStoreId && SELLER_KINDS.includes(sellerKind)) {
        const table = sellerKind === 'agent' ? 'agent_stores' : sellerKind === 'subagent' ? 'subagent_stores' : 'sub_subagent_stores';
        const { data: store } = await supabase.from(table).select('wallet_balance').eq('id', sellerStoreId).maybeSingle();
        if (store) await supabase.from(table).update({ wallet_balance: Number(store.wallet_balance || 0) + baseAmount }).eq('id', sellerStoreId);
      }
    } else {
      console.error('[private-share/verify] insert failed', { code: insertError?.code, message: insertError?.message, reference });
      const { data: raced } = await supabase
        .from('private_share_subscriptions')
        .select(SUBSCRIPTION_COLUMNS)
        .eq('payment_reference', reference)
        .maybeSingle();
      subscription = raced;
    }
  }

  if (!subscription) {
    return res.status(202).json({ error: 'Payment verified, but subscription record is still being processed', payment_confirmed: true, retryable: true });
  }

  const { data: assignmentResult, error: assignmentError } = await supabase.rpc('private_share_assign', { p_subscription_id: subscription.id });
  if (assignmentError) console.error('[private-share/verify] assignment failed', { code: assignmentError.code, message: assignmentError.message, reference });

  const { data: assignment } = await supabase
    .from('private_share_assignments')
    .select('id,status,account_id,entitlement_expires_at,private_share_accounts(login_identifier,login_password,customer_instructions,verification_required)')
    .eq('subscription_id', subscription.id)
    .maybeSingle();
  const rawAccount = assignment?.private_share_accounts as unknown;
  const account = (Array.isArray(rawAccount) ? rawAccount[0] : rawAccount) as
    | { login_identifier: string | null; login_password: string | null; customer_instructions: string | null; verification_required: boolean }
    | null
    | undefined;

  let verificationEmail: string | null = null;
  if (assignment?.account_id) {
    const { data: emailLink } = await supabase
      .from('private_share_account_email_links')
      .select('private_share_email_identities(email)')
      .eq('account_id', assignment.account_id)
      .eq('role', 'verification')
      .maybeSingle();
    const rawIdentity = emailLink?.private_share_email_identities as unknown;
    const identity = (Array.isArray(rawIdentity) ? rawIdentity[0] : rawIdentity) as { email?: string } | null | undefined;
    verificationEmail = identity?.email || null;
  }

  const verificationRequired = Boolean(verificationEmail && (account?.verification_required || /netflix/i.test(subscription.service_name || '')));
  const assignmentPending = Boolean(assignmentError || !assignment || assignment.status !== 'active');

  return res.status(200).json({
    success: true,
    payment_confirmed: subscription.payment_status === 'paid',
    subscription_id: subscription.id,
    payment_reference: subscription.payment_reference,
    service_name: subscription.service_name,
    confirmation_status: subscription.confirmation_status,
    assignment: assignmentResult || null,
    assignment_id: assignment?.id || null,
    assignment_status: assignment?.status || 'pending_fulfillment',
    entitlement_expires_at: assignment?.entitlement_expires_at || null,
    login_identifier: account?.login_identifier || null,
    login_password: account?.login_password || null,
    customer_instructions: account?.customer_instructions || null,
    verification_required: verificationRequired,
    verification_email: verificationEmail,
    credentials_ready: Boolean(assignment?.status === 'active' && account?.login_identifier && account?.login_password && !verificationRequired),
    assignment_error: assignmentError ? 'Assignment is pending' : null,
    retryable: assignmentPending,
    whatsapp_url: subscription.whatsapp_url,
  });
}
