import { useEffect, useRef, useState } from 'react'

import { reconnectNdkForRelays, testNostrRelaysReachable } from '@/api/nostr'
import {
  type NostrIdentity,
  type NostrRelayConnectionInfo
} from '@/types/models/Nostr'

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
        reason: 'user_disabled',
        status: 'disconnected'
      })
      return
    }

    const urls = identity.relays?.length ? identity.relays : relays

    if (urls.length === 0) {
      setActiveConnectionInfo({ reason: 'no_relays', status: 'disconnected' })
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

      if (info.status === 'disconnected' && info.reason === 'all_failed') {
        await reconnectNdkForRelays(urls)
        if (generation !== effectGenerationRef.current) {
          return
        }
        const retryInfo = await testNostrRelaysReachable(urls)
        if (generation !== effectGenerationRef.current) {
          return
        }
        setActiveConnectionInfo(retryInfo)
      }
    }
    run()

    return () => {
      effectGenerationRef.current += 1
    }
  }, [activeIdentityNpub, identities, relays])

  return activeConnectionInfo
}
