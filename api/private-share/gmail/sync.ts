import { createClient } from '@supabase/supabase-js'
import { getToken, UserAuthorizationRequiredError } from '@vercel/connect'

const CONNECTOR_UID = 'google/justbuy-gmail-verification-inbox'
const scopes = ['https://www.googleapis.com/auth/gmail.readonly']
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const decode = (value: string) => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
function body(part: any): string {
  if (part?.body?.data) return decode(part.body.data)
  return (part?.parts ?? []).map(body).join('\n')
}
function header(payload: any, name: string) { return payload?.headers?.find((h: any) => h.name?.toLowerCase() === name)?.value ?? '' }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' })
  const supabase = db()
  const userClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Authentication required' })
  try {
    const token = await getToken(CONNECTOR_UID, { subject: { type: 'user', id: user.id }, scopes })
    const list = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=newer_than:2d', { headers: { Authorization: `Bearer ${token}` } })
    if (!list.ok) return res.status(list.status === 401 ? 401 : 502).json({ error: 'Gmail synchronization failed', reauthorize: list.status === 401 })
    const items = (await list.json()).messages ?? []
    let processed = 0
    let ignored = 0
    for (const item of items) {
      const message = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, { headers: { Authorization: `Bearer ${token}` } })
      if (!message.ok) continue
      const data = await message.json()
      const receivedAt = data.internalDate ? new Date(Number(data.internalDate)).toISOString() : new Date().toISOString()
      const { data: seen, error: seenError } = await supabase.from('private_share_gmail_messages').insert({ gmail_message_id: item.id, mailbox: 'central', received_at: receivedAt }).select('id').maybeSingle()
      if (seenError || !seen) continue
      const payload = data.payload
      const from = header(payload, 'From')
      const to = header(payload, 'To') || header(payload, 'Delivered-To')
      const subject = header(payload, 'Subject')
      const text = `${subject}\n${body(payload)}`.slice(0, 20000)
      const code = text.match(/(?:code|passcode|pin|otp)[^0-9]{0,60}\b(\d{4,8})\b/i)?.[1] ?? text.match(/\b(\d{4,8})\s+is\s+your\b/i)?.[1]
      if (!code) { ignored++; continue }
      const { error } = await supabase.rpc('private_share_ingest_code', { p_mailbox: to, p_sender: from, p_code: code, p_received_at: receivedAt })
      if (error) {
        await supabase.from('private_share_gmail_messages').update({ status: 'failed', error: 'Verification message processing failed' }).eq('id', seen.id)
        return res.status(502).json({ error: 'Verification message processing failed' })
      }
      await supabase.from('private_share_gmail_messages').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', seen.id)
      processed++
    }
    return res.status(200).json({ ok: true, processed, ignored, synchronizedAt: new Date().toISOString() })
  } catch (cause) {
    if (cause instanceof UserAuthorizationRequiredError) return res.status(401).json({ error: 'Gmail authorization required', reauthorize: true })
    return res.status(502).json({ error: 'Unable to synchronize Gmail' })
  }
}
