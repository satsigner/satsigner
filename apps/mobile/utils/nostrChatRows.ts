import {
  NOSTR_CHAT_GROUP_WINDOW_SEC,
  NOSTR_CHAT_REPLY_PREVIEW_MAX_LENGTH
} from '@/constants/nostr'
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/constants/time'
import { t } from '@/locales'
import { type NostrDM } from '@/types/models/Nostr'

type ChatDayRow = { dayStart: number; key: string; kind: 'day' }

type ChatMessageRow<T> = {
  isContinuation: boolean
  item: T
  key: string
  kind: 'message'
}

type ChatRow<T> = ChatDayRow | ChatMessageRow<T>

type ReplyPreview = {
  authorKey: string
  parentId: string
  text: string | null
}

function startOfLocalDay(createdAt: number): number {
  const date = new Date(createdAt * MS_PER_SECOND)
  date.setHours(0, 0, 0, 0)
  return Math.floor(date.getTime() / MS_PER_SECOND)
}

function isContinuationOf(previous: NostrDM | undefined, dm: NostrDM): boolean {
  return (
    previous !== undefined &&
    previous.author.toLowerCase() === dm.author.toLowerCase() &&
    startOfLocalDay(previous.created_at) === startOfLocalDay(dm.created_at) &&
    dm.created_at - previous.created_at <= NOSTR_CHAT_GROUP_WINDOW_SEC &&
    !dm.replyToId
  )
}

/**
 * Interleaves day separators with messages (oldest first) and marks a
 * message that follows the same author within the grouping window, so the
 * card can drop its repeated header.
 */
function buildChatRows<T>(
  items: T[],
  getDm: (item: T) => NostrDM
): ChatRow<T>[] {
  return items.flatMap((item, index) => {
    const dm = getDm(item)
    const previous = index > 0 ? getDm(items[index - 1]) : undefined
    const dayStart = startOfLocalDay(dm.created_at)
    const startsDay =
      previous === undefined ||
      startOfLocalDay(previous.created_at) !== dayStart
    const messageRow: ChatMessageRow<T> = {
      isContinuation: !startsDay && isContinuationOf(previous, dm),
      item,
      key: dm.id,
      kind: 'message'
    }
    return startsDay
      ? [{ dayStart, key: `day-${dayStart}`, kind: 'day' as const }, messageRow]
      : [messageRow]
  })
}

function truncatePreview(text: string): string {
  const singleLine = text.replaceAll(/\s+/g, ' ').trim()
  return singleLine.length > NOSTR_CHAT_REPLY_PREVIEW_MAX_LENGTH
    ? `${singleLine.slice(0, NOSTR_CHAT_REPLY_PREVIEW_MAX_LENGTH)}…`
    : singleLine
}

/** Quote shown above a reply; text is null when the parent isn't loaded. */
function buildReplyPreview(
  parentId: string,
  messagesById: ReadonlyMap<string, NostrDM>
): ReplyPreview {
  const parent = messagesById.get(parentId)
  return {
    authorKey: parent?.author ?? '',
    parentId,
    text: parent ? truncatePreview(parent.description) : null
  }
}

function formatChatDayLabel(dayStart: number, nowSec: number): string {
  const today = startOfLocalDay(nowSec)
  if (dayStart === today) {
    return t('time.today')
  }
  if (dayStart === startOfLocalDay(today - SECONDS_PER_DAY / 2)) {
    return t('time.yesterday')
  }
  return new Date(dayStart * MS_PER_SECOND).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    year: 'numeric'
  })
}

function findRowIndex<T>(rows: ChatRow<T>[], messageId: string): number {
  return rows.findIndex(
    (row) => row.kind === 'message' && row.key === messageId
  )
}

export {
  buildChatRows,
  buildReplyPreview,
  findRowIndex,
  formatChatDayLabel,
  startOfLocalDay
}
export type { ChatDayRow, ChatMessageRow, ChatRow, ReplyPreview }
