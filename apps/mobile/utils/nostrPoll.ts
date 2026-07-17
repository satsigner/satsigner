import { NOSTR_POLL_KIND, NOSTR_POLL_RESPONSE_KIND } from '@/constants/nostr'
import {
  type NostrPollInfo,
  type NostrPollOption,
  type NostrPollResponse,
  type NostrPollType
} from '@/types/models/Nostr'

export { NOSTR_POLL_KIND, NOSTR_POLL_RESPONSE_KIND }

export type { NostrPollInfo, NostrPollOption, NostrPollResponse, NostrPollType }

function getTagString(tag: string[], index: number): string | undefined {
  const value = tag[index]
  return typeof value === 'string' ? value : undefined
}

export function extractPollInfo(tags: string[][]): NostrPollInfo | null {
  const options: NostrPollOption[] = []
  for (const tag of tags) {
    const optionId = getTagString(tag, 1)
    const optionLabel = getTagString(tag, 2)
    if (tag[0] === 'option' && optionId && optionLabel) {
      options.push({ id: optionId, label: optionLabel })
    }
  }
  if (options.length === 0) {
    return null
  }

  const pollTypeTag = tags.find((tag) => tag[0] === 'polltype')
  const pollType: NostrPollType =
    pollTypeTag?.[1] === 'multiplechoice' ? 'multiplechoice' : 'singlechoice'

  const endsAtRaw = tags.find((tag) => tag[0] === 'endsAt')?.[1]
  const endsAt = endsAtRaw !== undefined ? parseInt(endsAtRaw, 10) : undefined

  const relays = tags
    .filter((tag) => tag[0] === 'relay')
    .map((tag) => getTagString(tag, 1))
    .filter((relay): relay is string => relay !== undefined)

  return {
    endsAt: endsAt !== undefined && !isNaN(endsAt) ? endsAt : undefined,
    options,
    pollType,
    relays
  }
}

export function extractResponseOptionIds(tags: string[][]): string[] {
  return tags
    .filter((tag) => tag[0] === 'response')
    .map((tag) => getTagString(tag, 1))
    .filter((optionId): optionId is string => optionId !== undefined)
}

export function isPollExpired(
  endsAt: number | undefined,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  return endsAt !== undefined && nowSec >= endsAt
}

export function resolvePollVoteOptionIds(
  optionIds: string[],
  pollType: NostrPollType
): string[] {
  if (pollType === 'multiplechoice') {
    const seen = new Set<string>()
    const resolved: string[] = []
    for (const id of optionIds) {
      if (!seen.has(id)) {
        seen.add(id)
        resolved.push(id)
      }
    }
    return resolved
  }
  return optionIds.length > 0 ? [optionIds[0]] : []
}

export function getUserPollVoteOptionIds(
  responses: NostrPollResponse[],
  voterPubkeyHex: string,
  pollType: NostrPollType,
  endsAt?: number
): string[] {
  const userResponses = responses
    .filter((response) => response.pubkey === voterPubkeyHex)
    .filter((response) => endsAt === undefined || response.created_at <= endsAt)
    .toSorted((a, b) => b.created_at - a.created_at)

  if (userResponses.length === 0) {
    return []
  }

  return resolvePollVoteOptionIds(userResponses[0].optionIds, pollType)
}

export function tallyPollVotes(
  responses: NostrPollResponse[],
  pollType: NostrPollType,
  endsAt?: number
): Map<string, number> {
  const latestByPubkey = new Map<string, NostrPollResponse>()

  for (const response of responses) {
    if (endsAt !== undefined && response.created_at > endsAt) {
      continue
    }
    const existing = latestByPubkey.get(response.pubkey)
    if (!existing || response.created_at > existing.created_at) {
      latestByPubkey.set(response.pubkey, response)
    }
  }

  const counts = new Map<string, number>()
  for (const response of latestByPubkey.values()) {
    const optionIds = resolvePollVoteOptionIds(response.optionIds, pollType)
    for (const optionId of optionIds) {
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
    }
  }

  return counts
}

function formatPollOptionLabel(label: string, voteCount: number): string {
  if (voteCount <= 0) {
    return label
  }
  return `${label} (${voteCount})`
}

export function buildPollOptionButtonLabel(
  label: string,
  voteCount: number
): string {
  return formatPollOptionLabel(label, voteCount)
}
