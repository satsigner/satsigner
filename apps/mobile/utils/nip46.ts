import {
  NIP46_EVENT_PREVIEW_MAX_LENGTH,
  NIP46_NOSTR_CONNECT_PREFIX
} from '@/constants/nip46'
import { t } from '@/locales'
import type { Nip46ParsedUri } from '@/types/models/Nip46'

const HEX_PUBKEY_REGEX = /^[0-9a-f]{64}$/

export function isNostrConnectUri(data: string): boolean {
  return data.trim().toLowerCase().startsWith(NIP46_NOSTR_CONNECT_PREFIX)
}

export function parseNostrConnectUri(uri: string): Nip46ParsedUri | null {
  const trimmed = uri.trim()
  if (!isNostrConnectUri(trimmed)) {
    return null
  }

  try {
    const withoutScheme = trimmed.slice(NIP46_NOSTR_CONNECT_PREFIX.length)
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
  kind: number
}

export function getEventPreview(params: string[]): Nip46EventPreview | null {
  try {
    const parsed = JSON.parse(params[0]) as {
      content?: string
      kind?: number
    }
    return {
      content:
        typeof parsed.content === 'string'
          ? parsed.content.slice(0, NIP46_EVENT_PREVIEW_MAX_LENGTH)
          : '',
      kind: typeof parsed.kind === 'number' ? parsed.kind : 1
    }
  } catch {
    return null
  }
}
