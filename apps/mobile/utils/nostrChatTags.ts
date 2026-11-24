import * as nostrKinds from 'nostr-tools/kinds'

import {
  NOSTR_CHAT_DEFAULT_SESSION_ID,
  NOSTR_CHAT_SESSION_ID_RE,
  NOSTR_CHAT_SESSION_TAG,
  NOSTR_CHAT_SESSION_TITLE_MAX,
  NOSTR_CHAT_SUBJECT_TAG,
  NOSTR_HEX_PUBKEY_RE,
  NOSTR_REPLY_MARKER
} from '@/constants/nostr'
import { toSingleLinePreview } from '@/utils/string'

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

function getTagValue(tags: unknown, name: string): string | undefined {
  if (!Array.isArray(tags)) {
    return undefined
  }
  const tag = tags.find(
    (candidate): candidate is string[] =>
      Array.isArray(candidate) &&
      candidate[0] === name &&
      typeof candidate[1] === 'string'
  )
  return tag?.[1]
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

function isChatSessionId(value: string): boolean {
  return NOSTR_CHAT_SESSION_ID_RE.test(value)
}

function buildSessionTag(sessionId: string): string[] {
  return [NOSTR_CHAT_SESSION_TAG, sessionId]
}

/** A peer picks the id, so anything malformed falls back to the default session. */
function getSessionId(tags: unknown): string {
  const value = getTagValue(tags, NOSTR_CHAT_SESSION_TAG)
  return value !== undefined && isChatSessionId(value)
    ? value
    : NOSTR_CHAT_DEFAULT_SESSION_ID
}

function normalizeSessionTitle(title: string): string | undefined {
  const line = toSingleLinePreview(title, NOSTR_CHAT_SESSION_TITLE_MAX)
  return line.length > 0 ? line : undefined
}

function buildSubjectTag(subject: string): string[] {
  return [NOSTR_CHAT_SUBJECT_TAG, subject]
}

function getSubject(tags: unknown): string | undefined {
  const value = getTagValue(tags, NOSTR_CHAT_SUBJECT_TAG)
  return value === undefined ? undefined : normalizeSessionTitle(value)
}

export {
  buildMessageDeletionTags,
  buildReplyTag,
  buildSessionTag,
  buildSubjectTag,
  getDeletionTargetIds,
  getReplyToId,
  getSessionId,
  getSubject,
  isChatSessionId,
  normalizeSessionTitle
}
