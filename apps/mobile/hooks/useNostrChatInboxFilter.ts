import { useQuery } from '@tanstack/react-query'

import { listPeersWrittenTo } from '@/db/queries/nostrChat'
import { useNostrFollowsFetch } from '@/hooks/useNostrFollowsFetch'
import {
  type NostrChatFilter,
  useNostrChatSettingsStore
} from '@/store/nostrChatSettings'
import { type NostrChatConversationItem } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { nostrChatQueryKeys } from '@/utils/nostrChat'
import {
  getFollowedPubkeySet,
  selectInboxConversations
} from '@/utils/nostrChatFilter'
import { getNostrContactsRelays } from '@/utils/nostrContacts'

const DEFAULT_CHAT_FILTER: NostrChatFilter = 'following'
const PEERS_WRITTEN_TO_QUERY_KEY = 'peersWrittenTo'
const NO_PEERS: string[] = []

type UseNostrChatInboxFilterOptions = {
  conversations: NostrChatConversationItem[]
  identityNpub: string
  identityRelays: string[] | undefined
}

function useNostrChatPeersWrittenTo(identityNpub: string) {
  const { data } = useQuery({
    enabled: identityNpub.length > 0,
    queryFn: () => listPeersWrittenTo(identityNpub),
    // Under the identity prefix so every chat invalidation refreshes it.
    queryKey: [
      ...nostrChatQueryKeys.identity(identityNpub),
      PEERS_WRITTEN_TO_QUERY_KEY
    ]
  })
  return data ?? NO_PEERS
}

function useNostrChatInboxFilter({
  conversations,
  identityNpub,
  identityRelays
}: UseNostrChatInboxFilterOptions) {
  const filter = useNostrChatSettingsStore(
    (state) => state.chatFilterByNpub[identityNpub] ?? DEFAULT_CHAT_FILTER
  )
  const setChatFilter = useNostrChatSettingsStore(
    (state) => state.setChatFilter
  )
  const follows = useNostrFollowsFetch({
    enabled: identityNpub.length > 0,
    npub: identityNpub,
    relays: getNostrContactsRelays(identityRelays)
  })
  const peersWrittenTo = useNostrChatPeersWrittenTo(identityNpub)

  const followedPubkeys = getFollowedPubkeySet(follows.data)
  const { othersCount, visibleConversations } = selectInboxConversations({
    conversations,
    filter,
    followedPubkeys,
    ownPubkey: getPubKeyHexFromNpub(identityNpub),
    peersWrittenTo: new Set(peersWrittenTo)
  })

  function setFilter(next: NostrChatFilter) {
    setChatFilter(identityNpub, next)
  }

  return {
    filter,
    followsLoaded: followedPubkeys !== null,
    followsUnavailable: followedPubkeys === null && !follows.isLoading,
    othersCount,
    setFilter,
    visibleConversations
  }
}

export { useNostrChatInboxFilter }
