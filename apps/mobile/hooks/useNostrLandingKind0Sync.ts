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
      if (effectiveRelays.length === 0) {
        continue
      }

      const api = new NostrAPI(effectiveRelays)
      const pullProfile = async () => {
        try {
          const profile = await api.fetchKind0(identity.npub)
          if (!profile) {
            return
          }
          updateIdentity(identity.npub, {
            displayName: profile.displayName || identity.displayName,
            lud16: profile.lud16 || identity.lud16,
            nip05: profile.nip05 || identity.nip05,
            picture: profile.picture || identity.picture
          })
        } catch {
          fetchedRef.current.delete(identity.npub)
        }
      }
      pullProfile()
    }
  }, [identities, relays, updateIdentity])

  return { clearKind0FetchCache }
}
