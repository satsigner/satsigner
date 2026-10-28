import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_FEED_STALE_TIME_MS } from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { nostrKeys } from '@/db/keys'
import { t } from '@/locales'
import {
  type NostrFeedNoteLike,
  type NostrReaction
} from '@/types/models/Nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import { NOSTR_LIKE_CONTENT, summarizeNoteLikes } from '@/utils/nostrReactions'

const NO_REACTIONS: NostrReaction[] = []
const PENDING_LIKE_ID = 'pending-like'

type NoteLikeTarget = Pick<NostrFeedNoteLike, 'id' | 'kind' | 'pubkey'>

type UseNostrNoteLikeParams = {
  enabled: boolean
  isWatchOnly: boolean
  note: NoteLikeTarget | null
  nsec?: string
  ownPubkeys: string[]
  relays: string[]
}

async function toggleNoteLike(
  relays: string[],
  nsec: string,
  note: NoteLikeTarget,
  ownLikeIds: string[]
): Promise<NostrReaction | null> {
  const api = new NostrAPI(relays)
  try {
    if (ownLikeIds.length > 0) {
      await api.requestDeletion(ownLikeIds, nsec)
      return null
    }
    return await api.publishReaction(nsec, note)
  } finally {
    api.disconnect()
  }
}

function useNostrNoteLike({
  enabled,
  isWatchOnly,
  note,
  nsec,
  ownPubkeys,
  relays
}: UseNostrNoteLikeParams) {
  const queryClient = useQueryClient()
  const ownPubkey = ownPubkeys[0] ?? ''
  const eventId = note?.id ?? ''
  const queryKey = nostrKeys.identityNoteReactions(
    eventId,
    getNostrContactsRelaysKey(relays)
  )

  const reactionsQuery = useQuery({
    enabled: enabled && eventId.length > 0 && relays.length > 0,
    queryFn: () => new NostrAPI(relays, ownPubkeys).fetchReactions(eventId),
    queryKey,
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })
  const reactions = reactionsQuery.data ?? NO_REACTIONS
  const { count, ownLikeIds } = summarizeNoteLikes(reactions, ownPubkey)
  const likedByMe = ownLikeIds.length > 0

  const toggleMutation = useMutation({
    mutationFn: () => {
      if (!nsec || !note) {
        throw new Error('A signing identity is required to react')
      }
      return toggleNoteLike(relays, nsec, note, ownLikeIds)
    },
    onError: (error, _variables, previous) => {
      queryClient.setQueryData(queryKey, previous)
      const failedKey = likedByMe
        ? 'nostrIdentity.note.unlikeFailed'
        : 'nostrIdentity.note.likeFailed'
      toast.error(`${t(failedKey)}: ${getNostrErrorMessage(error)}`)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<NostrReaction[]>(queryKey)
      const optimistic = likedByMe
        ? reactions.filter((reaction) => !ownLikeIds.includes(reaction.id))
        : [
            ...reactions,
            {
              content: NOSTR_LIKE_CONTENT,
              created_at: Math.floor(Date.now() / MS_PER_SECOND),
              id: PENDING_LIKE_ID,
              pubkey: ownPubkey
            }
          ]
      queryClient.setQueryData(queryKey, optimistic)
      return previous
    },
    onSuccess: (published) => {
      queryClient.setQueryData<NostrReaction[]>(queryKey, (current = []) => {
        const settled = current.filter(
          (reaction) => reaction.id !== PENDING_LIKE_ID
        )
        return published ? [...settled, published] : settled
      })
    }
  })

  const canLike = Boolean(nsec && note && ownPubkey) && !isWatchOnly

  function handleLikePress() {
    if (!canLike || toggleMutation.isPending) {
      return
    }
    toggleMutation.mutate()
  }

  return {
    canLike,
    handleLikePress,
    likeCount: count,
    likeToggling: toggleMutation.isPending,
    likedByMe,
    likesLoading: reactionsQuery.isLoading
  }
}

export { useNostrNoteLike }
