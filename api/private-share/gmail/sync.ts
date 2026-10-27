import { createClient } from '@supabase/supabase-js'
import { UserAuthorizationRequiredError } from '@vercel/connect'
import { syncCentralInbox } from '../../_lib/gmail-inbox'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' })
  const userClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Authentication required' })
  try {
    const result = await syncCentralInbox({ sinceSeconds: 2 * 24 * 3600, maxMessages: 25, subjectIds: [user.id] })
    if (!result.ok) {
      const reauthorize = result.reason === 'gmail_not_authorized' || result.reason === 'gmail_list_401'
      return res.status(reauthorize ? 401 : 502).json({ error: reauthorize ? 'Gmail authorization required' : 'Gmail synchronization failed', reauthorize })
    }
    return res.status(200).json({ ok: true, processed: result.processed, ignored: result.ignored, unmatched: result.unmatched, synchronizedAt: new Date().toISOString() })
  } catch (cause) {
    if (cause instanceof UserAuthorizationRequiredError) return res.status(401).json({ error: 'Gmail authorization required', reauthorize: true })
    return res.status(502).json({ error: 'Unable to synchronize Gmail' })
  }
}
