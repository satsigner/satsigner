import {
  NOSTR_NIP46_AUTO_ALLOW_SIGN_EVENT_KINDS,
  NOSTR_NIP46_NEVER_AUTO_ALLOW_METHODS,
  NOSTR_NIP46_CONNECT_PREFIX
} from '@/constants/nostr'
import { t } from '@/locales'
import type { Nip46Method, Nip46ParsedUri } from '@/types/models/Nostr'

const HEX_PUBKEY_REGEX = /^[0-9a-f]{64}$/

export function isNostrConnectUri(data: string): boolean {
  return data.trim().toLowerCase().startsWith(NOSTR_NIP46_CONNECT_PREFIX)
}

export function parseNostrConnectUri(uri: string): Nip46ParsedUri | null {
  const trimmed = uri.trim()
  if (!isNostrConnectUri(trimmed)) {
    return null
  }

  try {
    const withoutScheme = trimmed.slice(NOSTR_NIP46_CONNECT_PREFIX.length)
    const questionMarkIndex = withoutScheme.indexOf('?')

    const clientPubkey =
      questionMarkIndex === -1
        ? withoutScheme
        : withoutScheme.slice(0, questionMarkIndex)

    if (!HEX_PUBKEY_REGEX.test(clientPubkey)) {
      return null
    }

    const queryString =
      questionMarkIndex === -1 ? '' : withoutScheme.slice(questionMarkIndex + 1)

    const params = new URLSearchParams(queryString)

    const relays = params.getAll('relay').filter(Boolean)
    if (relays.length === 0) {
      return null
    }

    const secret = params.get('secret') ?? undefined
    const name = params.get('name') ?? undefined
    const perms = params.get('perms') ?? undefined

    return { clientPubkey, name, perms, relays, secret }
  } catch {
    return null
  }
}

export function buildNip46ResponsePayload(
  id: string,
  result: string | null,
  error: string | null
): string {
  const payload: Record<string, string> = { id }
  if (result !== null) {
    payload.result = result
  }
  if (error !== null) {
    payload.error = error
  }
  return JSON.stringify(payload)
}

export function getMethodLabel(method: string): string {
  switch (method) {
    case 'sign_event':
      return t('nip46.approval.signEvent')
    case 'get_public_key':
      return t('nip46.approval.getPublicKey')
    case 'nip04_encrypt':
    case 'nip44_encrypt':
      return t('nip46.approval.encrypt')
    case 'nip04_decrypt':
    case 'nip44_decrypt':
      return t('nip46.approval.decrypt')
    default:
      return method
  }
}

type Nip46EventPreview = {
  content: string
  createdAt?: number
  kind: number
  tags: string[][]
}

// The approval UI must show the user exactly what is being signed: the full
// content and every tag. Truncating or omitting fields lets a malicious
// client hide the real payload behind a benign-looking preview.
export function getEventPreview(params: string[]): Nip46EventPreview | null {
  try {
    const parsed = JSON.parse(params[0]) as {
      content?: string
      created_at?: number
      kind?: number
      tags?: string[][]
    }
    return {
      content: typeof parsed.content === 'string' ? parsed.content : '',
      createdAt:
        typeof parsed.created_at === 'number' ? parsed.created_at : undefined,
      kind: typeof parsed.kind === 'number' ? parsed.kind : 1,
      tags: Array.isArray(parsed.tags) ? parsed.tags : []
    }
  } catch {
    return null
  }
}

export function getSignEventKind(params: string[]): number | null {
  try {
    const parsed = JSON.parse(params[0]) as { kind?: number }
    return typeof parsed.kind === 'number' ? parsed.kind : null
  } catch {
    return null
  }
}

// Whether a stored "always allow" permission may be honored for this request.
// Decryption methods and signing of sensitive/unknown event kinds always
// require explicit user approval.
export function canAutoApproveRequest(
  method: Nip46Method,
  params: string[]
): boolean {
  if (NOSTR_NIP46_NEVER_AUTO_ALLOW_METHODS.includes(method)) {
    return false
  }
  if (method === 'sign_event') {
    const kind = getSignEventKind(params)
    return (
      kind !== null && NOSTR_NIP46_AUTO_ALLOW_SIGN_EVENT_KINDS.includes(kind)
    )
  }
  return true
}
