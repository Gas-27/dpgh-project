import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }

  const { data: role, error: roleError } = await adminSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'sub_admin'])
    .maybeSingle()

  if (roleError || !role) {
    res.status(403).json({ error: 'Administrator access required' })
    return null
  }

  return { user, role: role.role, adminSupabase }
}

export { adminSupabase }
