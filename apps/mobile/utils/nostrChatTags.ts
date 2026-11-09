import * as nostrKinds from 'nostr-tools/kinds'

import { NOSTR_HEX_PUBKEY_RE, NOSTR_REPLY_MARKER } from '@/constants/nostr'

function isEventTag(tag: unknown): tag is string[] {
  return (
    Array.isArray(tag) &&
    tag[0] === 'e' &&
    typeof tag[1] === 'string' &&
    NOSTR_HEX_PUBKEY_RE.test(tag[1])
  )
}

function getEventTags(tags: unknown): string[][] {
  return Array.isArray(tags) ? tags.filter(isEventTag) : []
}

function buildReplyTag(parentId: string): string[] {
  return ['e', parentId, '', NOSTR_REPLY_MARKER]
}

/**
 * NIP-17 marks the direct parent with an `e` tag; a `reply` marker wins
 * when several are present.
 */
function getReplyToId(tags: unknown): string | undefined {
  const eventTags = getEventTags(tags)
  const marked = eventTags.find((tag) => tag[3] === NOSTR_REPLY_MARKER)
  return (marked ?? eventTags[0])?.[1]
}

function buildMessageDeletionTags(messageIds: string[]): string[][] {
  return [
    ...messageIds.map((id) => ['e', id]),
    ['k', String(nostrKinds.PrivateDirectMessage)]
  ]
}

function getDeletionTargetIds(tags: unknown): string[] {
  return getEventTags(tags).map((tag) => tag[1])
}

export {
  buildMessageDeletionTags,
  buildReplyTag,
  getDeletionTargetIds,
  getReplyToId
}
