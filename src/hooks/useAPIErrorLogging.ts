import { supabase } from '@/integrations/supabase/client';

export interface APIErrorLog {
  order_id?: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  agent_store_id?: string | null;
  subagent_store_id?: string | null;
  error_type: string;
  error_message: string;
  error_details?: Record<string, any>;
  api_endpoint: string;
  http_status_code?: number;
  request_payload?: Record<string, any>;
  response_payload?: Record<string, any>;
}

export const logAPIError = async (errorData: APIErrorLog) => {
  try {
    console.log('[v0] Logging API error:', errorData);
    
    const { data, error } = await supabase
      .from('api_error_logs')
      .insert({
        order_id: errorData.order_id,
        customer_number: errorData.customer_number,
        network: errorData.network,
        size_gb: errorData.size_gb,
        amount: errorData.amount,
        agent_store_id: errorData.agent_store_id,
        subagent_store_id: errorData.subagent_store_id,
        error_type: errorData.error_type,
        error_message: errorData.error_message,
        error_details: errorData.error_details,
        api_endpoint: errorData.api_endpoint,
        http_status_code: errorData.http_status_code,
        request_payload: errorData.request_payload,
        response_payload: errorData.response_payload,
      })
      .select();

    if (error) {
      console.error('[v0] Error logging API error:', error);
      return null;
    }

    console.log('[v0] API error logged successfully:', data);
    return data?.[0];
  } catch (err) {
    console.error('[v0] Exception logging API error:', err);
    return null;
  }
};

export const getAPIErrorLogs = async (filter?: {
  resolved?: boolean;
  limit?: number;
  offset?: number;
}) => {
  try {
    let query = supabase
      .from('api_error_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.resolved !== undefined) {
      query = query.eq('resolved', filter.resolved);
    }

    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    if (filter?.offset) {
      query = query.range(filter.offset, (filter.offset + (filter.limit || 10)) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[v0] Error fetching API error logs:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[v0] Exception fetching API error logs:', err);
    return [];
  }
};

export const markErrorAsResolved = async (errorId: string, resolutionNotes?: string) => {
  try {
    const { data, error } = await supabase
      .from('api_error_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes,
      })
      .eq('id', errorId)
      .select();

    if (error) {
      console.error('[v0] Error marking error as resolved:', error);
      return null;
    }

    console.log('[v0] Error marked as resolved:', data);
    return data?.[0];
  } catch (err) {
    console.error('[v0] Exception marking error as resolved:', err);
    return null;
  }
};

export const deleteAPIError = async (errorId: string) => {
  try {
    const { error } = await supabase
      .from('api_error_logs')
      .delete()
      .eq('id', errorId);

    if (error) {
      console.error('[v0] Error deleting API error log:', error);
      return false;
    }

    console.log('[v0] API error log deleted');
    return true;
  } catch (err) {
    console.error('[v0] Exception deleting API error log:', err);
    return false;
  }
};
