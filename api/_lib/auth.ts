import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Supabase server configuration is missing');
  cachedAdminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdminClient;
}

/** Strips framework fingerprint headers and marks API responses as uncacheable. */
export function hardenResponse(res: VercelResponse) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
}

export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<{ user: User; admin: SupabaseClient } | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  let admin: SupabaseClient;
  try {
    admin = getAdminSupabase();
  } catch {
    res.status(503).json({ error: 'Service unavailable' });
    return null;
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { user: data.user, admin };
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const auth = await requireUser(req, res);
  if (!auth) return null;

  const { data: role, error } = await auth.admin
    .from('user_roles')
    .select('role')
    .eq('user_id', auth.user.id)
    .in('role', ['admin', 'sub_admin'])
    .limit(1)
    .maybeSingle();

  if (error || !role) {
    res.status(403).json({ error: 'Administrator access required' });
    return null;
  }
  return { ...auth, role: role.role as string };
}
