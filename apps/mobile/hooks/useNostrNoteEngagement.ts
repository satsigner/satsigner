import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { fetchNoteEngagementCoalesced } from '@/api/nostrEngagementFetcher'
import { NOSTR_FEED_STALE_TIME_MS } from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { nostrKeys } from '@/db/keys'
import { t } from '@/locales'
import {
  type NostrEngagementEvent,
  type NostrEngagementSigner
} from '@/types/models/Nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import {
  applyEngagementToggle,
  type EngagementAction,
  type EngagementTarget,
  getOwnEngagementIds,
  settleEngagementToggle,
  summarizeNoteEngagement
} from '@/utils/nostrEngagement'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'

const NO_EVENTS: NostrEngagementEvent[] = []

const FAILED_KEYS = {
  like: {
    add: 'nostrIdentity.note.likeFailed',
    undo: 'nostrIdentity.note.unlikeFailed'
  },
  repost: {
    add: 'nostrIdentity.note.repostFailed',
    undo: 'nostrIdentity.note.undoRepostFailed'
  }
} as const

type UseNostrNoteEngagementParams = NostrEngagementSigner & {
  enabled: boolean
  note: EngagementTarget | null
  relays: string[]
}

type ToggleContext = {
  previous: NostrEngagementEvent[] | undefined
  undoing: boolean
}

async function publishEngagementToggle(
  relays: string[],
  nsec: string,
  note: EngagementTarget,
  action: EngagementAction,
  ownIds: string[]
): Promise<NostrEngagementEvent | null> {
  const api = new NostrAPI(relays)
  try {
    if (ownIds.length > 0) {
      await api.requestDeletion(ownIds, nsec)
      return null
    }
    if (action === 'like') {
      return await api.publishReaction(nsec, note)
    }
    return await api.publishRepost(nsec, note)
  } finally {
    api.disconnect()
  }
}

function useNostrNoteEngagement({
  enabled,
  isWatchOnly,
  note,
  nsec,
  ownPubkey,
  relays
}: UseNostrNoteEngagementParams) {
  const queryClient = useQueryClient()
  const noteId = note?.id ?? ''
  const queryKey = nostrKeys.identityNoteEngagement(
    noteId,
    getNostrContactsRelaysKey(relays),
    ownPubkey
  )

  const engagementQuery = useQuery({
    enabled: enabled && noteId.length > 0 && relays.length > 0,
    queryFn: () => fetchNoteEngagementCoalesced(noteId, relays, ownPubkey),
    queryKey,
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })
  const events = engagementQuery.data ?? NO_EVENTS
  const engagement = summarizeNoteEngagement(events, ownPubkey)

  const toggleMutation = useMutation({
    mutationFn: (action: EngagementAction) => {
      if (!nsec || !note) {
        throw new Error('A signing identity is required to react')
      }
      return publishEngagementToggle(
        relays,
        nsec,
        note,
        action,
        getOwnEngagementIds(engagement, action)
      )
    },
    onError: (error, action, context?: ToggleContext) => {
      queryClient.setQueryData(queryKey, context?.previous)
      const keys = FAILED_KEYS[action]
      toast.error(
        `${t(context?.undoing ? keys.undo : keys.add)}: ${getNostrErrorMessage(error)}`
      )
    },
    onMutate: async (action): Promise<ToggleContext> => {
      await queryClient.cancelQueries({ queryKey })
      const previous =
        queryClient.getQueryData<NostrEngagementEvent[]>(queryKey)
      const ownIds = getOwnEngagementIds(engagement, action)
      queryClient.setQueryData(
        queryKey,
        applyEngagementToggle(events, action, ownIds, {
          createdAt: Math.floor(Date.now() / MS_PER_SECOND),
          noteId,
          ownPubkey
        })
      )
      return { previous, undoing: ownIds.length > 0 }
    },
    onSuccess: (published, action) => {
      queryClient.setQueryData<NostrEngagementEvent[]>(
        queryKey,
        (current = []) => settleEngagementToggle(current, action, published)
      )
    }
  })

  // Until engagement loads we can't see an existing like or repost, and a tap
  // would publish a duplicate instead of undoing it.
  const canEngage =
    Boolean(nsec && note && ownPubkey) &&
    !isWatchOnly &&
    engagementQuery.isSuccess

  function handleLikePress() {
    if (!canEngage || toggleMutation.isPending) {
      return
    }
    toggleMutation.mutate('like')
  }

  function handleRepostPress() {
    if (!canEngage || toggleMutation.isPending) {
      return
    }
    toggleMutation.mutate('repost')
  }

  return {
    canEngage,
    handleLikePress,
    handleRepostPress,
    likeCount: engagement.likeCount,
    likedByMe: engagement.ownLikeIds.length > 0,
    repostCount: engagement.repostCount,
    repostedByMe: engagement.ownRepostIds.length > 0,
    toggling: toggleMutation.isPending
  }
}

export { useNostrNoteEngagement }
