import type { Nip46Method, Nip46PermissionPolicy } from '@/types/models/Nip46'

export const NIP46_EVENT_KIND = 24133

export const NIP46_SUPPORTED_METHODS: Nip46Method[] = [
  'connect',
  'get_public_key',
  'nip04_decrypt',
  'nip04_encrypt',
  'nip44_decrypt',
  'nip44_encrypt',
  'ping',
  'sign_event'
]

export const NIP46_DEFAULT_PERMISSIONS: Record<
  Nip46Method,
  Nip46PermissionPolicy
> = {
  connect: 'always_allow',
  get_public_key: 'always_allow',
  nip04_decrypt: 'ask',
  nip04_encrypt: 'ask',
  nip44_decrypt: 'ask',
  nip44_encrypt: 'ask',
  ping: 'always_allow',
  sign_event: 'ask'
}

export const NIP46_REQUEST_TIMEOUT_MS = 60_000

export const NIP46_NOSTR_CONNECT_PREFIX = 'nostrconnect://'
