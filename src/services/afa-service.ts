import { supabase } from '@/integrations/supabase/client';

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
 * Register a customer for AFA with the provider API
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

    // Call AFA provider API
    const response = await fetch(`${AFA_API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AFA_API_KEY}`,
        'X-Store-ID': storeId,
        'X-Store-Type': storeType,
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

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.message || 'Failed to register with AFA provider',
      };
    }

    const result = await response.json();

    // Store registration in database
    const { data: registration, error: dbError } = await supabase
      .from('afa_registrations')
      .insert({
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_id: data.customer_id,
        date_of_birth: data.date_of_birth,
        town: data.town,
        occupation: data.occupation,
        region: data.region,
        crop: data.crop,
        afa_ref_id: result.ref_id,
        registration_status: 'pending',
        afa_package_id: data.package_id,
        ...(storeType === 'agent' && { agent_store_id: storeId }),
        ...(storeType === 'subagent' && { subagent_store_id: storeId }),
      })
      .select();

    if (dbError) {
      console.error('[AFA] Database error:', dbError);
      return {
        success: false,
        message: 'Failed to save registration',
      };
    }

    return {
      success: true,
      ref_id: result.ref_id,
      message: 'Registration submitted successfully. Awaiting verification.',
      data: registration,
    };
  } catch (error) {
    console.error('[AFA] Registration error:', error);
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
 * Retry failed AFA registration
 */
export const retryAFARegistration = async (
  registrationId: string
): Promise<AFARegistrationResponse> => {
  try {
    // Fetch the registration details
    const { data: registration, error: fetchError } = await supabase
      .from('afa_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      return {
        success: false,
        message: 'Registration not found',
      };
    }

    // Prepare the registration data
    const registrationData: AFARegistrationRequest = {
      customer_name: registration.customer_name,
      customer_phone: registration.customer_phone,
      customer_id: registration.customer_id,
      date_of_birth: registration.date_of_birth,
      town: registration.town,
      occupation: registration.occupation,
      region: registration.region,
      crop: registration.crop,
      package_id: registration.afa_package_id,
      amount: registration.amount_paid || 0,
    };

    // Determine store type
    const storeType = registration.agent_store_id ? 'agent' : 'subagent';
    const storeId = registration.agent_store_id || registration.subagent_store_id;

    // Call AFA provider API again
    const response = await fetch(`${AFA_API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AFA_API_KEY}`,
        'X-Store-ID': storeId,
        'X-Store-Type': storeType,
      },
      body: JSON.stringify({
        name: registrationData.customer_name,
        phone: registrationData.customer_phone,
        id_number: registrationData.customer_id,
        dob: registrationData.date_of_birth,
        town: registrationData.town,
        occupation: registrationData.occupation,
        region: registrationData.region,
        crop: registrationData.crop,
        package_id: registrationData.package_id,
        amount: registrationData.amount,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.message || 'Failed to register with AFA provider',
      };
    }

    const result = await response.json();

    // Update the registration with new ref_id and reset status to pending
    const { error: updateError } = await supabase
      .from('afa_registrations')
      .update({
        afa_ref_id: result.ref_id,
        registration_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('[AFA] Database update error:', updateError);
      return {
        success: false,
        message: 'Failed to update registration',
      };
    }

    return {
      success: true,
      ref_id: result.ref_id,
      message: 'Registration retried successfully. Awaiting verification.',
    };
  } catch (error) {
    console.error('[AFA] Retry registration error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
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
