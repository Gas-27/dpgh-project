import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getToken } from '@vercel/connect'

export const GMAIL_CONNECTOR_UID = 'google/justbuy-gmail-verification-inbox'
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

export const serviceClient = () =>
  createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

const decode = (value: string) => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
const stripHtml = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')

function collectBody(part: any): string {
  if (!part) return ''
  const own = part.body?.data ? decode(part.body.data) : ''
  const text = part.mimeType === 'text/html' ? stripHtml(own) : own
  return [text, ...(part.parts ?? []).map(collectBody)].join('\n')
}

const header = (payload: any, name: string): string =>
  (payload?.headers ?? [])
    .filter((h: any) => h.name?.toLowerCase() === name)
    .map((h: any) => h.value)
    .join(', ')

export function extractCode(subject: string, body: string): string | null {
  const text = `${subject}\n${body}`.slice(0, 20000)
  const patterns = [
    /(?:code|passcode|pin|otp)[^0-9]{0,80}?\b(\d{4,8})\b/i,
    /\b(\d{4,8})\b\s+is\s+your\b/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function candidateMailboxes(payload: any): string[] {
  const raw = ['to', 'cc', 'x-original-to', 'delivered-to', 'x-forwarded-for', 'x-forwarded-to'].map((n) => header(payload, n)).join(' ')
  const found = raw.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
  return Array.from(new Set(found.map((e) => e.toLowerCase())))
}

async function adminUserIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('user_roles').select('user_id').eq('role', 'admin')
  return (data ?? []).map((r: { user_id: string }) => r.user_id)
}

async function acquireToken(subjectIds: string[]): Promise<string | null> {
  for (const id of subjectIds) {
    try {
      return await getToken(GMAIL_CONNECTOR_UID, { subject: { type: 'user', id }, scopes: GMAIL_SCOPES })
    } catch {
      // try the next administrator who may have authorized the inbox
    }
  }
  return null
}

export type SyncResult = { ok: boolean; processed: number; ignored: number; unmatched: number; reason?: string }

export async function syncCentralInbox(options: { sinceSeconds?: number; maxMessages?: number; subjectIds?: string[] } = {}): Promise<SyncResult> {
  const supabase = serviceClient()
  const subjects = options.subjectIds?.length ? options.subjectIds : await adminUserIds(supabase)
  const token = await acquireToken(subjects)
  if (!token) return { ok: false, processed: 0, ignored: 0, unmatched: 0, reason: 'gmail_not_authorized' }

  const after = Math.floor(Date.now() / 1000) - (options.sinceSeconds ?? 1800)
  const list = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${options.maxMessages ?? 15}&q=${encodeURIComponent(`after:${after}`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!list.ok) return { ok: false, processed: 0, ignored: 0, unmatched: 0, reason: `gmail_list_${list.status}` }
  const items: { id: string }[] = (await list.json()).messages ?? []

  const results = await Promise.all(
    items.map(async (item) => {
      const { data: seen, error: seenError } = await supabase
        .from('private_share_gmail_messages')
        .insert({ gmail_message_id: item.id, mailbox: 'central', received_at: new Date().toISOString() })
        .select('id')
        .maybeSingle()
      if (seenError || !seen) return 'skipped'
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        await supabase.from('private_share_gmail_messages').delete().eq('id', seen.id)
        return 'skipped'
      }
      const data = await response.json()
      const payload = data.payload
      const receivedAt = data.internalDate ? new Date(Number(data.internalDate)).toISOString() : new Date().toISOString()
      const from = header(payload, 'from')
      const code = extractCode(header(payload, 'subject'), collectBody(payload))
      await supabase.from('private_share_gmail_messages').update({ received_at: receivedAt }).eq('id', seen.id)
      if (!code) {
        await supabase.from('private_share_gmail_messages').update({ status: 'ignored', processed_at: new Date().toISOString() }).eq('id', seen.id)
        return 'ignored'
      }
      let stored = false
      for (const mailbox of candidateMailboxes(payload)) {
        const { data: ingest } = await supabase.rpc('private_share_ingest_code', {
          p_mailbox: mailbox,
          p_sender: from,
          p_code: code,
          p_received_at: receivedAt,
        })
        if ((ingest as { stored?: boolean } | null)?.stored) {
          stored = true
          break
        }
      }
      await supabase
        .from('private_share_gmail_messages')
        .update({ status: stored ? 'processed' : 'unmatched', processed_at: new Date().toISOString(), error: stored ? null : 'No matching assigned mailbox or sender' })
        .eq('id', seen.id)
      return stored ? 'processed' : 'unmatched'
    }),
  )
  return {
    ok: true,
    processed: results.filter((r) => r === 'processed').length,
    ignored: results.filter((r) => r === 'ignored').length,
    unmatched: results.filter((r) => r === 'unmatched').length,
  }
}
