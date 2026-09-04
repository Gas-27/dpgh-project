/**
 * AFA Webhook Handler
 * Place this in your backend/API routes directory
 * Handles callbacks from AFA provider when registration status changes
 */

import { handleAFAWebhook } from '@/services/afa-service';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-afa-signature') || '';
    const payload = await request.json();

    // Log for debugging
    console.log('[Webhook] Received AFA callback:', {
      ref_id: payload.ref_id,
      status: payload.status,
      timestamp: new Date().toISOString(),
    });

    // Handle the webhook
    const result = await handleAFAWebhook(payload, signature);

    if (!result.success) {
      console.error('[Webhook] Failed to process:', result.message);
      return new Response(
        JSON.stringify({ success: false, message: result.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Webhook] Successfully processed:', result.message);
    return new Response(
      JSON.stringify({ success: true, message: result.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
