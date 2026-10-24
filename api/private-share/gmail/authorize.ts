import { createClient } from '@supabase/supabase-js'
import { startAuthorization, getToken, revokeToken, UserAuthorizationRequiredError } from '@vercel/connect'

const CONNECTOR_UID = 'google/justbuy-gmail-verification-inbox'
const scopes = ['https://www.googleapis.com/auth/gmail.readonly']

function supabaseForToken(token: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

function origin(req: any) {
  const forwarded = req.headers['x-forwarded-host'] ?? req.headers.host
  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `${proto}://${forwarded}`
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' })
  const accessToken = auth.slice(7)
  const supabase = supabaseForToken(accessToken)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return res.status(401).json({ error: 'Authentication required' })
  try {
    const subject = { type: 'user' as const, id: user.id }
    if (req.method === 'DELETE') {
      await revokeToken(CONNECTOR_UID, { subject })
      return res.status(200).json({ disconnected: true })
    }
    const token = await getToken(CONNECTOR_UID, { subject, scopes }, { forceRefresh: true })
    const profile = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${token}` } })
    if (!profile.ok) {
      const detail = await profile.text().catch(() => '')
      if (profile.status === 401 || profile.status === 403) {
        await revokeToken(CONNECTOR_UID, { subject }).catch(() => undefined)
        const callbackUrl = `${origin(req)}/api/private-share/gmail/callback`
        const authorization = await startAuthorization(CONNECTOR_UID, { subject, scopes, callbackUrl })
        return res.status(200).json({ connected: false, authorizationUrl: authorization.url, reauthorize: true })
      }
      return res.status(502).json({ error: `Gmail profile request failed (${profile.status})`, detail: detail.slice(0, 160) })
    }
    const mailbox = await profile.json()
    return res.status(200).json({ connected: true, email: mailbox.emailAddress, lastSyncAt: null })
  } catch (cause) {
    if (cause instanceof UserAuthorizationRequiredError) {
      const callbackUrl = `${origin(req)}/api/private-share/gmail/callback`
      const authorization = await startAuthorization(CONNECTOR_UID, { subject: { type: 'user', id: user.id }, scopes, callbackUrl })
      return res.status(200).json({ connected: false, authorizationUrl: authorization.url })
    }
    return res.status(502).json({ error: 'Unable to contact Gmail' })
  }
}
