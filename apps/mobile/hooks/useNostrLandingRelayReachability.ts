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

type RelayReachabilityPlan =
  | { info: NostrRelayConnectionInfo | null; kind: 'settled' }
  | { kind: 'probe'; urls: string[] }

const CHECKING_CONNECTION_INFO: NostrRelayConnectionInfo = {
  status: 'checking'
}

function getRelayReachabilityPlan({
  activeIdentityNpub,
  identities,
  relays
}: UseNostrLandingRelayReachabilityArgs): RelayReachabilityPlan {
  if (!activeIdentityNpub) {
    return { info: null, kind: 'settled' }
  }

  const identity = identities.find((i) => i.npub === activeIdentityNpub)
  if (!identity) {
    return { info: null, kind: 'settled' }
  }

  if (!identity.relayConnected) {
    return {
      info: { reason: 'user_disabled', status: 'disconnected' },
      kind: 'settled'
    }
  }

  const urls = identity.relays?.length ? identity.relays : relays

  if (urls.length === 0) {
    return {
      info: { reason: 'no_relays', status: 'disconnected' },
      kind: 'settled'
    }
  }

  return { kind: 'probe', urls }
}

function getPlanConnectionInfo(plan: RelayReachabilityPlan) {
  return plan.kind === 'settled' ? plan.info : CHECKING_CONNECTION_INFO
}

function hasSameReachabilityInputs(
  a: UseNostrLandingRelayReachabilityArgs,
  b: UseNostrLandingRelayReachabilityArgs
) {
  return (
    a.activeIdentityNpub === b.activeIdentityNpub &&
    a.identities === b.identities &&
    a.relays === b.relays
  )
}

export function useNostrLandingRelayReachability({
  activeIdentityNpub,
  identities,
  relays
}: UseNostrLandingRelayReachabilityArgs) {
  const inputs = { activeIdentityNpub, identities, relays }
  const [activeConnectionInfo, setActiveConnectionInfo] = useState(() =>
    getPlanConnectionInfo(getRelayReachabilityPlan(inputs))
  )
  const [checkedInputs, setCheckedInputs] = useState(inputs)
  const effectGenerationRef = useRef(0)

  if (!hasSameReachabilityInputs(checkedInputs, inputs)) {
    setCheckedInputs(inputs)
    setActiveConnectionInfo(
      getPlanConnectionInfo(getRelayReachabilityPlan(inputs))
    )
  }

  useEffect(() => {
    const plan = getRelayReachabilityPlan({
      activeIdentityNpub,
      identities,
      relays
    })
    if (plan.kind === 'settled') {
      return
    }

    const { urls } = plan
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
