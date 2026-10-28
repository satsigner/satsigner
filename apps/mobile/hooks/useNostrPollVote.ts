import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { nostrKeys } from '@/db/keys'
import { t } from '@/locales'
import {
  type NostrPollInfo,
  type NostrPollResponse
} from '@/types/models/Nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import { getUserPollVoteOptionIds, tallyPollVotes } from '@/utils/nostrPoll'

const NO_RESPONSES: NostrPollResponse[] = []

type UseNostrPollVoteParams = {
  enabled: boolean
  eventId?: string
  isExpired: boolean
  isWatchOnly: boolean
  nsec?: string
  ownPubkeys: string[]
  pollInfo: NostrPollInfo | null
  relays: string[]
}

type UseNostrPollVoteResult = {
  handlePollOptionPress: (optionId: string) => void
  handlePollSubmitMultiple: () => void
  pollMultipleSelection: string[]
  pollResponsesLoading: boolean
  pollVoteCounts: Map<string, number>
  pollVoting: boolean
  userPollVoteIds: string[]
}

export function useNostrPollVote({
  enabled,
  eventId,
  isExpired,
  isWatchOnly,
  nsec,
  ownPubkeys,
  pollInfo,
  relays
}: UseNostrPollVoteParams): UseNostrPollVoteResult {
  const queryClient = useQueryClient()
  const pollQueryKey = nostrKeys.identityPollResponses(
    eventId ?? '',
    getNostrContactsRelaysKey(relays)
  )
  const responsesQuery = useQuery({
    enabled: Boolean(enabled && pollInfo && eventId),
    queryFn: () => {
      if (!eventId) {
        return NO_RESPONSES
      }
      return new NostrAPI(relays, ownPubkeys).fetchPollResponses(eventId)
    },
    queryKey: pollQueryKey
  })
  const pollResponses = responsesQuery.data ?? NO_RESPONSES
  const pollResponsesLoading = responsesQuery.isLoading
  const [pollVoting, setPollVoting] = useState(false)
  const [pollMultipleSelection, setPollMultipleSelection] = useState<string[]>(
    []
  )

  const ownPubkeyHex = ownPubkeys[0] ?? ''
  const pollVoteCounts = pollInfo
    ? tallyPollVotes(pollResponses, pollInfo.pollType, pollInfo.endsAt)
    : new Map<string, number>()
  const userPollVoteIds =
    pollInfo && ownPubkeyHex
      ? getUserPollVoteOptionIds(
          pollResponses,
          ownPubkeyHex,
          pollInfo.pollType,
          pollInfo.endsAt
        )
      : []

  const userPollVoteKey = userPollVoteIds.join('|')

  useEffect(() => {
    if (
      pollInfo?.pollType !== 'multiplechoice' ||
      userPollVoteKey.length === 0
    ) {
      return
    }
    setPollMultipleSelection(userPollVoteKey.split('|'))
  }, [pollInfo?.pollType, userPollVoteKey])

  async function submitPollVote(optionIds: string[]) {
    if (
      !eventId ||
      !pollInfo ||
      isExpired ||
      !nsec ||
      isWatchOnly ||
      optionIds.length === 0
    ) {
      return
    }

    setPollVoting(true)
    const api = new NostrAPI(relays, ownPubkeys)
    try {
      await api.publishPollResponse(nsec, eventId, optionIds, pollInfo.relays)
      toast.success(t('nostrIdentity.note.pollVoteSuccess'))
      void queryClient.invalidateQueries({ queryKey: pollQueryKey })
    } catch (error) {
      toast.error(
        `${t('nostrIdentity.note.pollVoteFailed')}: ${getNostrErrorMessage(error)}`
      )
    } finally {
      api.disconnect()
      setPollVoting(false)
    }
  }

  function handlePollOptionPress(optionId: string) {
    if (!pollInfo || isExpired || pollVoting) {
      return
    }

    if (pollInfo.pollType === 'singlechoice') {
      void submitPollVote([optionId])
      return
    }

    setPollMultipleSelection((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
    )
  }

  function handlePollSubmitMultiple() {
    void submitPollVote(pollMultipleSelection)
  }

  return {
    handlePollOptionPress,
    handlePollSubmitMultiple,
    pollMultipleSelection,
    pollResponsesLoading,
    pollVoteCounts,
    pollVoting,
    userPollVoteIds
  }
}
