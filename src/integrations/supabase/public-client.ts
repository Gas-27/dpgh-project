// Public Supabase client for storefront access (no authentication)
// This ensures public RLS policies work correctly
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://uloaiqmknsrknqikbmtb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsb2FpcW1rbnNya25xaWtibXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDMxNTksImV4cCI6MjA4OTI3OTE1OX0.vegCKSDJlFT8DKoU99pMCskhrS1XUCLKg2PXXInPub0";

// Public client with NO authentication - for anonymous/public queries
export const publicSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
