import { useEffect, useRef, useState } from 'react'

import { testNostrRelaysReachable } from '@/api/nostr'
import {
  type NostrIdentity,
  type NostrRelayConnectionInfo
} from '@/types/models/NostrIdentity'

type UseNostrLandingRelayReachabilityArgs = {
  activeIdentityNpub: string | null
  identities: NostrIdentity[]
  relays: string[]
}

export function useNostrLandingRelayReachability({
  activeIdentityNpub,
  identities,
  relays
}: UseNostrLandingRelayReachabilityArgs) {
  const [activeConnectionInfo, setActiveConnectionInfo] =
    useState<NostrRelayConnectionInfo | null>(null)
  const effectGenerationRef = useRef(0)

  useEffect(() => {
    if (!activeIdentityNpub) {
      setActiveConnectionInfo(null)
      return
    }

    const identity = identities.find((i) => i.npub === activeIdentityNpub)
    if (!identity) {
      setActiveConnectionInfo(null)
      return
    }

    if (!identity.relayConnected) {
      setActiveConnectionInfo({
        status: 'disconnected',
        reason: 'user_disabled'
      })
      return
    }

    const urls = identity.relays?.length ? identity.relays : relays

    if (urls.length === 0) {
      setActiveConnectionInfo({ status: 'disconnected', reason: 'no_relays' })
      return
    }

    setActiveConnectionInfo({ status: 'checking' })

    effectGenerationRef.current += 1
    const generation = effectGenerationRef.current

    const run = async () => {
      const info = await testNostrRelaysReachable(urls)
      if (generation !== effectGenerationRef.current) {
        return
      }
      setActiveConnectionInfo(info)
    }
    run()

    return () => {
      effectGenerationRef.current += 1
    }
  }, [activeIdentityNpub, identities, relays])

  return activeConnectionInfo
}
