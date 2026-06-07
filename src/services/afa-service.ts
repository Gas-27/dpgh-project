import { supabase } from '@/integrations/supabase/client';
import { logAPIError } from '@/hooks/useAPIErrorLogging';

/**
 * AFA Service - Handles integration with AFA provider API
 * Configure the following environment variables:
 * - AFA_API_KEY: Your AFA provider API key
 * - AFA_API_URL: Base URL for AFA provider API
 * - AFA_WEBHOOK_SECRET: Secret for validating webhook signatures
 */

const AFA_API_KEY = import.meta.env.VITE_AFA_API_KEY || '';
const AFA_API_URL = import.meta.env.VITE_AFA_API_URL || 'https://api.afa-provider.com';
const AFA_WEBHOOK_SECRET = import.meta.env.VITE_AFA_WEBHOOK_SECRET || '';

interface AFARegistrationRequest {
  customer_name: string;
  customer_phone: string;
  customer_id?: string;
  date_of_birth?: string;
  town?: string;
  occupation?: string;
  region?: string;
  crop?: string;
  package_id: string;
  amount: number;
}

interface AFARegistrationResponse {
  success: boolean;
  ref_id?: string;
  message: string;
  data?: any;
}

/**
 * Register a customer for AFA with the provider API via Edge Function
 */
export const registerAFA = async (
  data: AFARegistrationRequest,
  storeId: string,
  storeType: 'agent' | 'subagent'
): Promise<AFARegistrationResponse> => {
  try {
    // Validate required fields
    if (!data.customer_name || !data.customer_phone) {
      return {
        success: false,
        message: 'Customer name and phone are required',
      };
    }

    // Get current user for userId
    const { data: { user } } = await supabase.auth.getUser();

    // Call Supabase Edge Function
    const response = await fetch('/api/afa-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: data.customer_name,
        phoneNumber: data.customer_phone,
        idNumber: data.customer_id || '',
        dateOfBirth: data.date_of_birth || '',
        town: data.town || '',
        occupation: data.occupation || '',
        region: data.region || '',
        cropProduce: data.crop || '',
        userId: user?.id,
        agentStoreId: storeType === 'agent' ? storeId : undefined,
        subagentStoreId: storeType === 'subagent' ? storeId : undefined,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Log API error for admin debugging
      console.log('[v0] Logging AFA registration API error');
      await logAPIError({
        customer_number: data.customer_phone,
        network: 'afa',
        size_gb: 0,
        amount: data.amount,
        agent_store_id: storeType === 'agent' ? storeId : undefined,
        subagent_store_id: storeType === 'subagent' ? storeId : undefined,
        error_type: 'AFA_REGISTRATION_FAILED',
        error_message: result.error || 'Failed to register with AFA provider',
        api_endpoint: '/api/afa-registration',
        http_status_code: response.status,
        request_payload: {
          fullName: data.customer_name,
          phoneNumber: data.customer_phone,
          idNumber: data.customer_id,
          dateOfBirth: data.date_of_birth,
          town: data.town,
          occupation: data.occupation,
          region: data.region,
          cropProduce: data.crop,
        },
        response_payload: result,
      });
      
      return {
        success: false,
        message: result.error || 'Failed to register with AFA provider',
      };
    }

    return {
      success: true,
      ref_id: result.registrationId,
      message: result.message || 'Registration submitted successfully. Awaiting verification.',
      data: result.data,
    };
  } catch (error) {
    console.error('[AFA] Registration error:', error);
    
    // Log network/exception error for admin debugging
    console.log('[v0] Logging AFA registration exception error');
    await logAPIError({
      customer_number: data.customer_phone,
      network: 'afa',
      size_gb: 0,
      amount: data.amount,
      agent_store_id: storeType === 'agent' ? storeId : undefined,
      subagent_store_id: storeType === 'subagent' ? storeId : undefined,
      error_type: error instanceof Error && error.message.includes('fetch') ? 'NETWORK_ERROR' : 'EXCEPTION_ERROR',
      error_message: error instanceof Error ? error.message : 'Unknown error occurred',
      api_endpoint: '/api/afa-registration',
      request_payload: {
        fullName: data.customer_name,
        phoneNumber: data.customer_phone,
        idNumber: data.customer_id,
        dateOfBirth: data.date_of_birth,
        town: data.town,
        occupation: data.occupation,
        region: data.region,
        cropProduce: data.crop,
      },
    });
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Verify AFA registration status with provider
 */
export const verifyAFAStatus = async (refId: string): Promise<{
  status: string;
  verified: boolean;
  message: string;
}> => {
  try {
    const response = await fetch(`${AFA_API_URL}/verify/${refId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AFA_API_KEY}`,
      },
    });

    if (!response.ok) {
      return {
        status: 'error',
        verified: false,
        message: 'Failed to verify status',
      };
    }

    const result = await response.json();

    // Update registration status in database
    if (result.status) {
      await supabase
        .from('afa_registrations')
        .update({
          registration_status: result.status.toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq('afa_ref_id', refId);
    }

    return {
      status: result.status,
      verified: result.status === 'verified' || result.status === 'active',
      message: result.message || `Status: ${result.status}`,
    };
  } catch (error) {
    console.error('[AFA] Verification error:', error);
    return {
      status: 'error',
      verified: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Handle webhook callback from AFA provider
 * Validates signature and updates registration status
 */
export const handleAFAWebhook = async (
  payload: any,
  signature: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Validate webhook signature
    const isValid = await validateWebhookSignature(payload, signature);
    if (!isValid) {
      return {
        success: false,
        message: 'Invalid webhook signature',
      };
    }

    const { ref_id, status, verified } = payload;

    if (!ref_id) {
      return {
        success: false,
        message: 'Missing ref_id in webhook payload',
      };
    }

    // Update registration status
    const newStatus = verified ? 'verified' : status?.toLowerCase() || 'pending';
    const { error } = await supabase
      .from('afa_registrations')
      .update({
        registration_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('afa_ref_id', ref_id);

    if (error) {
      console.error('[AFA] Webhook update error:', error);
      return {
        success: false,
        message: 'Failed to update registration',
      };
    }

    return {
      success: true,
      message: `Registration updated to ${newStatus}`,
    };
  } catch (error) {
    console.error('[AFA] Webhook error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Validate webhook signature from AFA provider
 */
const validateWebhookSignature = async (payload: any, signature: string): Promise<boolean> => {
  if (!AFA_WEBHOOK_SECRET) {
    console.warn('[AFA] Webhook secret not configured');
    return false;
  }

  // Use Web Crypto API available in browser
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const keyData = encoder.encode(AFA_WEBHOOK_SECRET);
  
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = await crypto.subtle.sign('HMAC', key, data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex === signature;
};

/**
 * Get AFA packages for display
 */
export const getAFAPackages = async (
  storeId?: string,
  storeType?: 'agent' | 'subagent'
) => {
  try {
    let query = supabase
      .from('afa_packages')
      .select('*')
      .eq('is_active', true);

    const { data, error } = await query;

    if (error) throw error;

    // If store ID provided, get custom prices
    if (storeId && storeType) {
      const pricesTable = storeType === 'agent' ? 'agent_afa_prices' : 'subagent_afa_prices';
      const storeColumn = storeType === 'agent' ? 'agent_store_id' : 'subagent_store_id';

      const { data: prices } = await supabase
        .from(pricesTable)
        .select('*')
        .eq(storeColumn, storeId);

      // Merge prices with packages
      return data?.map((pkg: any) => {
        const customPrice = prices?.find((p: any) => p.afa_package_id === pkg.id);
        return {
          ...pkg,
          sell_price: customPrice?.sell_price || pkg.base_price,
          commission_amount: customPrice?.commission_amount,
        };
      });
    }

    return data;
  } catch (error) {
    console.error('[AFA] Get packages error:', error);
    return [];
  }
};

/**
 * Set custom AFA price for agent/subagent
 */
export const setAFAPrice = async (
  storeId: string,
  storeType: 'agent' | 'subagent',
  packageId: string,
  sellPrice: number,
  commissionAmount?: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const table = storeType === 'agent' ? 'agent_afa_prices' : 'subagent_afa_prices';
    const storeColumn = storeType === 'agent' ? 'agent_store_id' : 'subagent_store_id';

    // Check if price exists
    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq(storeColumn, storeId)
      .eq('afa_package_id', packageId)
      .single();

    let result;
    if (existing) {
      // Update
      result = await supabase
        .from(table)
        .update({
          sell_price: sellPrice,
          commission_amount: commissionAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert
      result = await supabase
        .from(table)
        .insert({
          [storeColumn]: storeId,
          afa_package_id: packageId,
          sell_price: sellPrice,
          commission_amount: commissionAmount,
        });
    }

    if (result.error) {
      return {
        success: false,
        message: result.error.message,
      };
    }

    return {
      success: true,
      message: 'Price updated successfully',
    };
  } catch (error) {
    console.error('[AFA] Set price error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};
