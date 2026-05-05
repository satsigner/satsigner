import { useEffect, useRef } from 'react'

import { NostrAPI } from '@/api/nostr'
import { PROFILE_CACHE_TTL_SECS } from '@/constants/nostr'
import { getCachedProfile } from '@/db/nostrCache'
import { type NostrIdentity } from '@/types/models/NostrIdentity'
import { getPubKeyHexFromNpub } from '@/utils/nostr'

type UseNostrLandingKind0SyncArgs = {
  identities: NostrIdentity[]
  relays: string[]
  updateIdentity: (npub: string, updates: Partial<NostrIdentity>) => void
}

export function useNostrLandingKind0Sync({
  identities,
  relays,
  updateIdentity
}: UseNostrLandingKind0SyncArgs) {
  const fetchedRef = useRef(new Set<string>())

  function clearKind0FetchCache() {
    fetchedRef.current.clear()
  }

  useEffect(() => {
    if (identities.length === 0) {
      return
    }

    const toFetch = identities.filter(
      (i) => i.relayConnected === true && !fetchedRef.current.has(i.npub)
    )
    if (toFetch.length === 0) {
      return
    }

    for (const i of toFetch) {
      fetchedRef.current.add(i.npub)
    }

    const now = Math.floor(Date.now() / 1000)

    // Apply cache hits immediately; collect misses for a batch relay fetch
    const missIdentities: NostrIdentity[] = []
    for (const identity of toFetch) {
      const hexPk = getPubKeyHexFromNpub(identity.npub)
      if (hexPk) {
        const cached = getCachedProfile(hexPk)
        if (cached && now - cached.cached_at < PROFILE_CACHE_TTL_SECS) {
          updateIdentity(identity.npub, {
            displayName: cached.displayName || identity.displayName,
            lud16: cached.lud16 || identity.lud16,
            nip05: cached.nip05 || identity.nip05,
            picture: cached.picture || identity.picture
          })
          continue
        }
      }
      const effectiveRelays = identity.relays ?? relays
      if (effectiveRelays.length > 0) {
        missIdentities.push(identity)
      }
    }

    if (missIdentities.length === 0) {
      return
    }

    // Group misses by relay set — one batch request per group instead of
    // one NostrAPI instance per identity
    const relayGroups = new Map<
      string,
      { groupIdentities: NostrIdentity[]; groupRelays: string[] }
    >()
    for (const identity of missIdentities) {
      const groupRelays = identity.relays ?? relays
      const key = JSON.stringify([...groupRelays].toSorted())
      const existing = relayGroups.get(key)
      if (existing) {
        existing.groupIdentities.push(identity)
      } else {
        relayGroups.set(key, { groupIdentities: [identity], groupRelays })
      }
    }

    async function fetchMissingProfiles() {
      for (const { groupIdentities, groupRelays } of relayGroups.values()) {
        const hexPubkeys = groupIdentities
          .map((i) => getPubKeyHexFromNpub(i.npub))
          .filter((pk): pk is string => !!pk)

        const api = new NostrAPI(groupRelays)
        try {
          const profiles = await api.fetchKind0Batch(hexPubkeys)
          for (const identity of groupIdentities) {
            const pk = getPubKeyHexFromNpub(identity.npub)
            const profile = pk ? profiles.get(pk) : undefined
            if (profile) {
              updateIdentity(identity.npub, {
                displayName: profile.displayName || identity.displayName,
                lud16: profile.lud16 || identity.lud16,
                nip05: profile.nip05 || identity.nip05,
                picture: profile.picture || identity.picture
              })
            } else {
              fetchedRef.current.delete(identity.npub)
            }
          }
        } catch {
          for (const identity of groupIdentities) {
            fetchedRef.current.delete(identity.npub)
          }
        } finally {
          api.disconnect()
        }
      }
    }

    void fetchMissingProfiles()
  }, [identities, relays, updateIdentity])

  return { clearKind0FetchCache }
}
