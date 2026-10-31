import { nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { getCachedProfile } from '@/db/nostrCache'
import { getNostrFollowCache } from '@/storage/mmkv'
import {
  type NostrContactItem,
  type NostrDataSource,
  type NostrErrorCode,
  type NostrIdentity,
  type NostrKind0Profile
} from '@/types/models/Nostr'

export type NostrContactsQueryData = {
  connectedRelayCount: number
  contacts: NostrContactItem[]
  error?: NostrErrorCode
  kind3Found: boolean
  relaysQueried: string[]
  source: NostrDataSource
}

type FetchNostrContactsOptions = {
  onProfileBatch?: (contacts: NostrContactItem[]) => void
  signal?: AbortSignal
}

export function getNostrContactsRelays(identityRelays?: string[]): string[] {
  return identityRelays?.length ? identityRelays : NostrAPI.INDEXING_RELAYS
}

/**
 * Canonical relay resolution for an identity: its own relay list first, then
 * the store-wide list, then the well-known indexing relays. Without the
 * fallback, identities created before relays were configured could never
 * fetch profiles/DMs (both lists default to empty).
 */
export function getNostrIdentityRelays(
  identityRelays: string[] | undefined,
  storeRelays: string[]
): string[] {
  if (identityRelays?.length) {
    return identityRelays
  }
  return storeRelays.length ? storeRelays : NostrAPI.INDEXING_RELAYS
}

export function getNostrContactsRelaysKey(contactsRelays: string[]): string {
  return [...contactsRelays].toSorted().join(',')
}

export function contactToIdentity(contact: NostrContactItem): NostrIdentity {
  return {
    createdAt: Date.now(),
    displayName: contact.profile?.displayName,
    isWatchOnly: false,
    lud16: contact.profile?.lud16,
    nip05: contact.profile?.nip05,
    npub: nip19.npubEncode(contact.pubkey),
    picture: contact.profile?.picture
  }
}

/** Any cached profile, fresh or not: shown at once while relays refresh it. */
function profileFromCache(pubkey: string): NostrKind0Profile | null {
  const cached = getCachedProfile(pubkey)
  if (!cached) {
    return null
  }
  return {
    banner: cached.banner,
    displayName: cached.displayName,
    lud16: cached.lud16,
    nip05: cached.nip05,
    picture: cached.picture
  }
}

function contactsFromPubkeys(pubkeys: string[]): NostrContactItem[] {
  return pubkeys.map((pubkey) => ({
    profile: profileFromCache(pubkey),
    pubkey
  }))
}

export function mergeProfileBatch(
  contacts: NostrContactItem[],
  batch: Map<string, NostrKind0Profile>
): NostrContactItem[] {
  return contacts.map((contact) => {
    const profile = batch.get(contact.pubkey)
    return profile ? { ...contact, profile } : contact
  })
}

/** Cached follows shown while relays load; never claims a kind 3 was found. */
export function getNostrContactsPlaceholder(
  npub: string
): NostrContactsQueryData | undefined {
  const cached = getNostrFollowCache(npub)
  if (!cached?.length) {
    return undefined
  }
  return {
    connectedRelayCount: 0,
    contacts: contactsFromPubkeys(cached),
    kind3Found: false,
    relaysQueried: [],
    source: 'cache'
  }
}

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
}

/**
 * Follows (kind 3) with their profiles streamed in. Relay failures and
 * missing kind 3 events fall back to the cached follow list, flagged by
 * `source` so the UI can say the list may be out of date.
 */
export async function fetchNostrContacts(
  npub: string,
  contactsRelays: string[],
  options: FetchNostrContactsOptions = {}
): Promise<NostrContactsQueryData> {
  const { onProfileBatch, signal } = options
  const api = new NostrAPI(contactsRelays)

  try {
    const result = await api.fetchKind3FollowingPubkeys(npub)
    abortIfNeeded(signal)

    const cachedFollows = getNostrFollowCache(npub) ?? []
    const useCachedFollows =
      result.source === 'relay' &&
      !result.data.kind3Found &&
      cachedFollows.length > 0
    const pubkeys = useCachedFollows ? cachedFollows : result.data.pubkeys
    const contacts = contactsFromPubkeys(pubkeys)

    await api.streamKind0Profiles(
      pubkeys,
      (batch) => {
        if (signal?.aborted) {
          return
        }
        const merged = mergeProfileBatch(contacts, batch)
        for (const [index, contact] of merged.entries()) {
          contacts[index] = contact
        }
        onProfileBatch?.(merged)
      },
      signal
    )
    abortIfNeeded(signal)

    return {
      connectedRelayCount: result.data.connectedRelayCount,
      contacts,
      error: result.error,
      kind3Found: result.data.kind3Found,
      relaysQueried: result.data.relaysQueried,
      source: useCachedFollows ? 'stale' : result.source
    }
  } finally {
    api.disconnect()
  }
}

export function filterNostrContacts(
  contacts: NostrContactItem[],
  searchQuery: string
): NostrContactItem[] {
  const query = searchQuery.trim().toLowerCase()
  if (!query) {
    return contacts
  }
  return contacts.filter((contact) => {
    const displayName = contact.profile?.displayName?.toLowerCase() ?? ''
    const nip05 = contact.profile?.nip05?.toLowerCase() ?? ''
    return (
      displayName.includes(query) ||
      nip05.includes(query) ||
      nip19.npubEncode(contact.pubkey).includes(query)
    )
  })
}
