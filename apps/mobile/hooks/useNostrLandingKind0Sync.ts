import { useQuery } from '@tanstack/react-query'

import { fetchProfilesCoalesced } from '@/api/nostrProfileFetcher'
import { NOSTR_PROFILE_QUERY_STALE_TIME_MS } from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import { type NostrIdentity } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import {
  getNostrContactsRelaysKey,
  getNostrIdentityRelays
} from '@/utils/nostrContacts'
import { getIdentityProfileUpdate } from '@/utils/nostrProfile'

type UpdateIdentity = (npub: string, updates: Partial<NostrIdentity>) => void

type UseNostrLandingKind0SyncArgs = {
  identities: NostrIdentity[]
  relays: string[]
  updateIdentity: UpdateIdentity
}

type IdentityRelayGroup = {
  npubs: string[]
  relays: string[]
  relaysKey: string
}

/** Connected identities grouped by relay set: one batched load per set. */
function groupConnectedIdentities(
  identities: NostrIdentity[],
  storeRelays: string[]
): IdentityRelayGroup[] {
  const groups = new Map<string, IdentityRelayGroup>()
  for (const identity of identities) {
    if (identity.relayConnected !== true) {
      continue
    }
    const relays = getNostrIdentityRelays(identity.relays, storeRelays)
    const relaysKey = getNostrContactsRelaysKey(relays)
    const group = groups.get(relaysKey) ?? { npubs: [], relays, relaysKey }
    group.npubs.push(identity.npub)
    groups.set(relaysKey, group)
  }
  return [...groups.values()]
}

async function syncIdentityProfiles(
  groups: IdentityRelayGroup[],
  updateIdentity: UpdateIdentity
): Promise<number> {
  const results = await Promise.all(
    groups.map(async ({ npubs, relays }) => {
      const hexByNpub = new Map(
        npubs.flatMap((npub): [string, string][] => {
          const hex = getPubKeyHexFromNpub(npub)
          return hex ? [[npub, hex]] : []
        })
      )
      const profiles = await fetchProfilesCoalesced(
        [...hexByNpub.values()],
        relays
      )
      return [...hexByNpub].flatMap(([npub, hex]) => {
        const profile = profiles.get(hex)
        return profile ? [{ npub, profile }] : []
      })
    })
  )
  const updates = results.flat()
  for (const { npub, profile } of updates) {
    updateIdentity(npub, getIdentityProfileUpdate(profile))
  }
  return updates.length
}

/**
 * Keeps connected identities' names and pictures in sync with their kind 0.
 * Keyed by the identity/relay sets, so updating an identity never refetches.
 */
export function useNostrLandingKind0Sync({
  identities,
  relays,
  updateIdentity
}: UseNostrLandingKind0SyncArgs) {
  const groups = groupConnectedIdentities(identities, relays)
  const groupsKey = groups
    .map((group) => `${group.relaysKey}=${group.npubs.toSorted().join(',')}`)
    .toSorted()
    .join('|')

  useQuery({
    enabled: groups.length > 0,
    queryFn: () => syncIdentityProfiles(groups, updateIdentity),
    queryKey: nostrKeys.identityProfiles(groupsKey),
    staleTime: NOSTR_PROFILE_QUERY_STALE_TIME_MS
  })
}
