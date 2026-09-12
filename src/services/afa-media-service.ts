import { supabase } from '@/integrations/supabase/client';

export interface AFAMedia {
  id: string;
  type: string;
  url: string;
  title: string;
  description: string;
  display_on_agent_store: boolean;
  display_on_package_page: boolean;
  display_on_registration: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch AFA media for display on agent store
 */
export const getAFAMediaForAgentStore = async (): Promise<AFAMedia[]> => {
  try {
    const { data, error } = await supabase
      .from('afa_media')
      .select('*')
      .eq('display_on_agent_store', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[AFA Media] Error fetching agent store media:', error);
    return [];
  }
};

/**
 * Fetch AFA media for display on package page
 */
export const getAFAMediaForPackagePage = async (): Promise<AFAMedia[]> => {
  try {
    const { data, error } = await supabase
      .from('afa_media')
      .select('*')
      .eq('display_on_package_page', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[AFA Media] Error fetching package page media:', error);
    return [];
  }
};

/**
 * Fetch AFA media for display on registration
 */
export const getAFAMediaForRegistration = async (): Promise<AFAMedia[]> => {
  try {
    const { data, error } = await supabase
      .from('afa_media')
      .select('*')
      .eq('display_on_registration', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[AFA Media] Error fetching registration media:', error);
    return [];
  }
};

/**
 * Fetch all AFA media
 */
export const getAllAFAMedia = async (): Promise<AFAMedia[]> => {
  try {
    const { data, error } = await supabase
      .from('afa_media')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[AFA Media] Error fetching all media:', error);
    return [];
  }
};
