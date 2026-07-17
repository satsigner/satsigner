import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { t } from '@/locales'
import {
  type NostrPollInfo,
  type NostrPollResponse
} from '@/types/models/Nostr'
import { getUserPollVoteOptionIds, tallyPollVotes } from '@/utils/nostrPoll'

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
  const [pollResponses, setPollResponses] = useState<NostrPollResponse[]>([])
  const [pollResponsesLoading, setPollResponsesLoading] = useState(false)
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
  const loadGenerationRef = useRef(0)

  useEffect(() => {
    if (!enabled || !pollInfo || !eventId) {
      setPollResponses([])
      setPollMultipleSelection([])
      return
    }

    const generation = loadGenerationRef.current + 1
    loadGenerationRef.current = generation
    setPollResponsesLoading(true)
    const pollEventId = eventId

    async function loadPollResponses() {
      const api = new NostrAPI(relays, ownPubkeys)
      try {
        const responses = await api.fetchPollResponses(pollEventId)
        if (loadGenerationRef.current !== generation) {
          return
        }
        setPollResponses(responses)
      } catch {
        if (loadGenerationRef.current !== generation) {
          return
        }
        setPollResponses([])
      } finally {
        api.disconnect()
        if (loadGenerationRef.current === generation) {
          setPollResponsesLoading(false)
        }
      }
    }

    void loadPollResponses()
  }, [enabled, eventId, ownPubkeys, pollInfo, relays])

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
      const responses = await api.fetchPollResponses(eventId)
      setPollResponses(responses)
      toast.success(t('nostrIdentity.note.pollVoteSuccess'))
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`${t('nostrIdentity.note.pollVoteFailed')}: ${reason}`)
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
