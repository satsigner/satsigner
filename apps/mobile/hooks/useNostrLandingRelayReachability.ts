import { useQuery } from '@tanstack/react-query'

import { reconnectNdkForRelays, testNostrRelaysReachable } from '@/api/nostr'
import { NOSTR_RELAY_REACHABILITY_STALE_TIME_MS } from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import {
  type NostrIdentity,
  type NostrRelayConnectionInfo
} from '@/types/models/Nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'

type UseNostrLandingRelayReachabilityArgs = {
  activeIdentityNpub: string | null
  identities: NostrIdentity[]
  relays: string[]
}

const ALL_FAILED: NostrRelayConnectionInfo = {
  reason: 'all_failed',
  status: 'disconnected'
}

/** Probes the relays once, reconnecting and re-probing when all failed. */
async function checkRelayReachability(
  urls: string[]
): Promise<NostrRelayConnectionInfo> {
  try {
    const info = await testNostrRelaysReachable(urls)
    if (info.status !== 'disconnected' || info.reason !== 'all_failed') {
      return info
    }
    await reconnectNdkForRelays(urls)
    return await testNostrRelaysReachable(urls)
  } catch {
    return ALL_FAILED
  }
}

export function useNostrLandingRelayReachability({
  activeIdentityNpub,
  identities,
  relays
}: UseNostrLandingRelayReachabilityArgs): NostrRelayConnectionInfo | null {
  const identity = activeIdentityNpub
    ? identities.find((i) => i.npub === activeIdentityNpub)
    : undefined
  const urls = identity?.relays?.length ? identity.relays : relays
  const relaysKey = getNostrContactsRelaysKey(urls)
  const relayConnected = identity?.relayConnected === true

  const query = useQuery({
    enabled: relayConnected && urls.length > 0,
    queryFn: () => checkRelayReachability(urls),
    queryKey: nostrKeys.identityReachability(
      activeIdentityNpub ?? '',
      relaysKey
    ),
    retry: false,
    staleTime: NOSTR_RELAY_REACHABILITY_STALE_TIME_MS
  })

  if (!identity) {
    return null
  }
  if (!relayConnected) {
    return { reason: 'user_disabled', status: 'disconnected' }
  }
  if (urls.length === 0) {
    return { reason: 'no_relays', status: 'disconnected' }
  }
  return query.data ?? { status: 'checking' }
}
