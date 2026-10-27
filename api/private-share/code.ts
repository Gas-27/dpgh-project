import { serviceClient, syncCentralInbox } from '../_lib/gmail-inbox'

const REFERENCE_PATTERN = /^[A-Za-z0-9_.-]{6,100}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const action = String(req.body?.action || '')
  const reference = String(req.body?.reference || '').trim()
  if (!REFERENCE_PATTERN.test(reference)) return res.status(400).json({ error: 'Missing payment reference' })
  const supabase = serviceClient()

  if (action === 'request') {
    const { data, error } = await supabase.rpc('private_share_guest_request_code', { p_reference: reference })
    if (error) return res.status(error.code === '22023' || error.code === '54000' ? 409 : 500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (action === 'poll') {
    const requestId = String(req.body?.request_id || '')
    if (!UUID_PATTERN.test(requestId)) return res.status(400).json({ error: 'Missing request' })
    const sync = await syncCentralInbox({ sinceSeconds: 1800 }).catch((cause) => {
      console.error('[private-share/code] inbox sync failed', cause instanceof Error ? cause.message : cause)
      return { ok: false, processed: 0, ignored: 0, unmatched: 0, reason: 'sync_error' }
    })
    if (!sync.ok) console.error('[private-share/code] inbox not read', sync.reason)
    const { data, error } = await supabase.rpc('private_share_guest_poll_code', { p_request_id: requestId, p_reference: reference })
    if (error) return res.status(error.code === 'P0002' ? 404 : 500).json({ error: error.message })
    return res.status(200).json({ ...(data as object), inbox_read: sync.ok })
  }

  return res.status(400).json({ error: 'Unknown action' })
}
