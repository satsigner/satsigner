import { NIP46_NOSTR_CONNECT_PREFIX } from '@/constants/nip46'
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
