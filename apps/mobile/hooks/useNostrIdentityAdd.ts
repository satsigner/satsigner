import { useState } from 'react'

import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { type NostrIdentity } from '@/types/models/Nostr'

/**
 * Adding an identity triggers a kind 0 fetch from relays (indexer relays when
 * none are configured), so the first add warns the user before it happens.
 */
export function useNostrIdentityAdd(onAdded: () => void) {
  const addIdentity = useNostrIdentityStore((state) => state.addIdentity)
  const warningDismissed = useNostrIdentityStore(
    (state) => state.kind0FetchWarningDismissed
  )
  const dismissWarning = useNostrIdentityStore(
    (state) => state.dismissKind0FetchWarning
  )

  const [pendingIdentity, setPendingIdentity] = useState<NostrIdentity | null>(
    null
  )

  function commit(identity: NostrIdentity) {
    addIdentity(identity)
    onAdded()
  }

  function requestAdd(identity: NostrIdentity) {
    if (warningDismissed) {
      commit(identity)
      return
    }
    setPendingIdentity(identity)
  }

  function resolvePending(identity: NostrIdentity) {
    setPendingIdentity(null)
    commit(identity)
  }

  function fetchProfile() {
    if (pendingIdentity) {
      resolvePending(pendingIdentity)
    }
  }

  function fetchProfileAlways() {
    if (!pendingIdentity) {
      return
    }
    dismissWarning()
    resolvePending(pendingIdentity)
  }

  /** Disconnected identities never reach relays until the user connects them. */
  function saveWithoutFetching() {
    if (pendingIdentity) {
      resolvePending({ ...pendingIdentity, relayConnected: false })
    }
  }

  return {
    fetchProfile,
    fetchProfileAlways,
    requestAdd,
    saveWithoutFetching,
    warningVisible: pendingIdentity !== null
  }
}
