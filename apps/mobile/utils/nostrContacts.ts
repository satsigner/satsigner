import { nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_PROFILE_CACHE_TTL_SECS } from '@/constants/nostr'
import { getCachedProfile } from '@/db/nostrCache'
import { getNostrFollowCache } from '@/storage/mmkv'
import {
  type NostrContactItem,
  type NostrIdentity,
  type NostrKind0Profile
} from '@/types/models/Nostr'

export type NostrContactsQueryData = {
  connectedRelayCount: number
  contacts: NostrContactItem[]
  kind3Found: boolean
  relaysQueried: string[]
}

type FetchNostrContactsOptions = {
  onProfileBatch?: (contacts: NostrContactItem[]) => void
  signal?: AbortSignal
}

export function getNostrContactsRelays(identityRelays?: string[]): string[] {
  return identityRelays?.length ? identityRelays : NostrAPI.INDEXING_RELAYS
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

export function profileFromCache(pubkey: string): NostrKind0Profile | null {
  const cached = getCachedProfile(pubkey)
  if (!cached) {
    return null
  }
  const now = Math.floor(Date.now() / 1000)
  if (now - cached.cached_at >= NOSTR_PROFILE_CACHE_TTL_SECS) {
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

export function contactsFromPubkeys(pubkeys: string[]): NostrContactItem[] {
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
    kind3Found: true,
    relaysQueried: []
  }
}

function contactsFromFollowCache(npub: string): NostrContactItem[] | null {
  const cached = getNostrFollowCache(npub)
  if (!cached?.length) {
    return null
  }
  return contactsFromPubkeys(cached)
}

export async function fetchNostrContacts(
  npub: string,
  contactsRelays: string[],
  options: FetchNostrContactsOptions = {}
): Promise<NostrContactsQueryData> {
  const { onProfileBatch, signal } = options
  const api = new NostrAPI(contactsRelays)

  try {
    const result = await api.fetchKind3FollowingPubkeys(npub)
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const metadata = {
      connectedRelayCount: result.connectedRelayCount,
      kind3Found: result.kind3Found,
      relaysQueried: result.relaysQueried
    }

    if (result.pubkeys.length === 0) {
      const cachedContacts = contactsFromFollowCache(npub)
      return {
        ...metadata,
        contacts: cachedContacts ?? []
      }
    }

    const contacts = contactsFromPubkeys(result.pubkeys)

    await api.streamKind0Profiles(
      result.pubkeys,
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

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    return { ...metadata, contacts }
  } finally {
    api.disconnect()
  }
}
