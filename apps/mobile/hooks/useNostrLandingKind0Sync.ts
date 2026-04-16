import { useEffect, useRef } from 'react'

import { NostrAPI } from '@/api/nostr'
import { type NostrIdentity } from '@/types/models/NostrIdentity'

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

    for (const identity of toFetch) {
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
