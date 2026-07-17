import { useQuery } from '@tanstack/react-query'

import {
  NOSTR_BLOSSOM_FILES_STALE_TIME_MS,
  NOSTR_BLOSSOM_SERVERS_STALE_TIME_MS
} from '@/constants/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import {
  blossomFilesQueryKey,
  fetchAllBlossomFiles,
  getBlossomRelays,
  resolveBlossomServers
} from '@/utils/blossomFiles'
import { getPubKeyHexFromNpub } from '@/utils/nostr'

export function useNostrBlossomFiles(npub: string | undefined) {
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((item) => item.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)

  const pubkeyHex = getPubKeyHexFromNpub(npub ?? '') ?? ''
  const nsec = identity?.nsec
  const configuredServers = identity?.blossomServers ?? []
  const relays = getBlossomRelays(identity?.relays, globalRelays)

  const serversQuery = useQuery({
    enabled: !!pubkeyHex && configuredServers.length === 0,
    queryFn: () => resolveBlossomServers(pubkeyHex, configuredServers, relays),
    queryKey: ['nostr', 'kind10063', pubkeyHex],
    retry: 1,
    staleTime: NOSTR_BLOSSOM_SERVERS_STALE_TIME_MS
  })

  const servers =
    configuredServers.length > 0 ? configuredServers : (serversQuery.data ?? [])

  const filesQuery = useQuery({
    enabled: !!pubkeyHex && servers.length > 0,
    queryFn: () => fetchAllBlossomFiles(servers, pubkeyHex, nsec),
    queryKey: blossomFilesQueryKey(pubkeyHex, servers),
    retry: 1,
    staleTime: NOSTR_BLOSSOM_FILES_STALE_TIME_MS
  })

  const isLoading =
    serversQuery.isLoading || (servers.length > 0 && filesQuery.isLoading)

  return {
    files: filesQuery.data ?? [],
    identity,
    isError: filesQuery.isError,
    isLoading,
    pubkeyHex,
    servers
  }
}
