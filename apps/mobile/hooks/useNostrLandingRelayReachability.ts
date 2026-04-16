import { useEffect, useRef, useState } from 'react'

import { testNostrRelaysReachable } from '@/api/nostr'
import {
  type NostrIdentity,
  type NostrRelayReachability
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
  const [activeRelayReachability, setActiveRelayReachability] =
    useState<NostrRelayReachability | null>(null)
  const effectGenerationRef = useRef(0)

  useEffect(() => {
    if (!activeIdentityNpub) {
      setActiveRelayReachability(null)
      return
    }

    const identity = identities.find((i) => i.npub === activeIdentityNpub)
    if (!identity) {
      setActiveRelayReachability(null)
      return
    }

    if (!identity.relayConnected) {
      setActiveRelayReachability('disconnected')
      return
    }

    const urls = identity.relays?.length ? identity.relays : relays

    setActiveRelayReachability('checking')
    if (urls.length === 0) {
      setActiveRelayReachability('disconnected')
      return
    }

    effectGenerationRef.current += 1
    const generation = effectGenerationRef.current

    const run = async () => {
      const ok = await testNostrRelaysReachable(urls)
      if (generation !== effectGenerationRef.current) {
        return
      }
      setActiveRelayReachability(ok ? 'connected' : 'disconnected')
    }
    run()

    return () => {
      effectGenerationRef.current += 1
    }
  }, [activeIdentityNpub, identities, relays])

  return activeRelayReachability
}
