import { testNostrRelaysReachable } from '@/api/nostr'

type NostrRelayCheckStatus = 'connected' | 'connecting' | 'disconnected'

/**
 * Real per-relay reachability: reuses the live pool when it already has the
 * relay connected, otherwise probes it with a throw-away connection.
 */
async function checkRelayStatuses(
  relays: string[]
): Promise<Record<string, NostrRelayCheckStatus>> {
  const results = await Promise.all(
    relays.map(async (relay) => {
      const info = await testNostrRelaysReachable([relay]).catch(() => null)
      const status: NostrRelayCheckStatus =
        info?.status === 'connected' ? 'connected' : 'disconnected'
      const entry: [string, NostrRelayCheckStatus] = [relay, status]
      return entry
    })
  )
  return Object.fromEntries(results)
}

function countDisconnected(
  statuses: Record<string, NostrRelayCheckStatus>
): number {
  return Object.values(statuses).filter((status) => status === 'disconnected')
    .length
}

export { checkRelayStatuses, countDisconnected }
export type { NostrRelayCheckStatus }
