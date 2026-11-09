import * as nostrKinds from 'nostr-tools/kinds'
import { z } from 'zod'

import { t } from '@/locales'
import { type NostrChatProtocol, type NostrDM } from '@/types/models/Nostr'
import { formatDateShort } from '@/utils/date'
import { formatNpub, truncate } from '@/utils/format'
import { safeNpubEncode } from '@/utils/nostr'
import { isOptimisticDmId } from '@/utils/nostrDms'

const MESSAGE_ID_TRUNCATE_CHARS = 10
const MESSAGE_PREVIEW_MAX_CHARS = 140
const ELLIPSIS = '…'
const NPUB_PREFIX = 'npub'

const MessageRumorSchema = z.object({
  kind: z.number().int().nonnegative(),
  tags: z.array(z.array(z.string()))
})

type NostrMessageRumorInfo = z.infer<typeof MessageRumorSchema>

type NostrMessageStatus = 'failed' | 'pending' | 'sent'

type NostrMessageDetailRowKey =
  | 'author'
  | 'id'
  | 'kind'
  | 'protocol'
  | 'status'
  | 'time'
  | 'timestamp'
  | 'wraps'

type NostrMessageDetailRow = {
  key: NostrMessageDetailRowKey
  label: string
  value: string
  /** Full value copied when the row is pressed, when it is worth copying. */
  copyValue?: string
}

type NostrMessagePreview = {
  authorLabel: string
  date: string
  id: string
  text: string
}

type NostrMessageDetailRowsInput = {
  authorNpub: string
  createdAt: number
  id: string
  status: NostrMessageStatus
  wrapCount: number
  kind?: number
  protocol?: NostrChatProtocol
}

const PROTOCOL_KINDS: Record<NostrChatProtocol, number> = {
  nip04: nostrKinds.EncryptedDirectMessage,
  nip17: nostrKinds.PrivateDirectMessage
}

function parseJsonSafely(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Kind and tags of the stored rumor JSON, or null when it is missing or malformed. */
function parseMessageRumorInfo(event: string): NostrMessageRumorInfo | null {
  if (!event) {
    return null
  }
  const parsed = MessageRumorSchema.safeParse(parseJsonSafely(event))
  return parsed.success ? parsed.data : null
}

/** One tag per line, each as compact JSON. */
function formatMessageTags(tags: string[][]): string {
  return tags.map((tag) => JSON.stringify(tag)).join('\n')
}

function getChatProtocolKind(protocol: NostrChatProtocol): number {
  return PROTOCOL_KINDS[protocol]
}

function getMessageStatus(
  message: Pick<NostrDM, 'pending'>,
  failed: boolean
): NostrMessageStatus {
  if (failed) {
    return 'failed'
  }
  return message.pending ? 'pending' : 'sent'
}

function toAuthorNpub(author: string): string {
  if (author.startsWith(NPUB_PREFIX)) {
    return author
  }
  return safeNpubEncode(author.toLowerCase(), '')
}

function getStatusLabel(status: NostrMessageStatus): string {
  return t(`nostrIdentity.chat.message.status.${status}`)
}

function getProtocolLabel(protocol: NostrChatProtocol): string {
  return protocol === 'nip04'
    ? t('nostrIdentity.chat.tabNip4')
    : t('nostrIdentity.chat.tabNip17')
}

function buildMessageDetailRows({
  authorNpub,
  createdAt,
  id,
  kind,
  protocol,
  status,
  wrapCount
}: NostrMessageDetailRowsInput): NostrMessageDetailRow[] {
  const rows: NostrMessageDetailRow[] = [
    {
      copyValue: authorNpub,
      key: 'author',
      label: t('nostrIdentity.chat.message.author'),
      value: formatNpub(authorNpub)
    },
    {
      key: 'time',
      label: t('nostrIdentity.chat.message.time'),
      value: formatDateShort(createdAt)
    },
    {
      copyValue: String(createdAt),
      key: 'timestamp',
      label: t('nostrIdentity.chat.message.timestamp'),
      value: String(createdAt)
    },
    {
      copyValue: id,
      key: 'id',
      label: t('nostrIdentity.chat.message.id'),
      value: truncate(id, MESSAGE_ID_TRUNCATE_CHARS)
    }
  ]
  if (kind !== undefined) {
    rows.push({
      key: 'kind',
      label: t('nostrIdentity.chat.message.kind'),
      value: String(kind)
    })
  }
  if (protocol) {
    rows.push({
      key: 'protocol',
      label: t('nostrIdentity.chat.message.protocol'),
      value: getProtocolLabel(protocol)
    })
  }
  rows.push(
    {
      key: 'status',
      label: t('nostrIdentity.chat.message.status.label'),
      value: getStatusLabel(status)
    },
    {
      key: 'wraps',
      label: t('nostrIdentity.chat.message.wraps'),
      value: String(wrapCount)
    }
  )
  return rows
}

function truncatePreviewText(text: string): string {
  const singleLine = text.replaceAll(/\s+/g, ' ').trim()
  if (singleLine.length <= MESSAGE_PREVIEW_MAX_CHARS) {
    return singleLine
  }
  return `${singleLine.slice(0, MESSAGE_PREVIEW_MAX_CHARS)}${ELLIPSIS}`
}

function buildMessagePreview(
  message: NostrDM,
  authorLabel: string
): NostrMessagePreview {
  return {
    authorLabel,
    date: formatDateShort(message.created_at),
    id: message.id,
    text: truncatePreviewText(message.description)
  }
}

/** Optimistic copies have no relay id yet, so there is nothing to retract. */
function canDeleteMessageForEveryone(isOwn: boolean, messageId: string) {
  return isOwn && !isOptimisticDmId(messageId)
}

/** Direct replies to `messageId`, oldest first. */
function findMessageReplies(messages: NostrDM[], messageId: string) {
  return messages
    .filter((message) => message.replyToId === messageId)
    .toSorted((a, b) => a.created_at - b.created_at)
}

export {
  buildMessageDetailRows,
  buildMessagePreview,
  canDeleteMessageForEveryone,
  findMessageReplies,
  formatMessageTags,
  getChatProtocolKind,
  getMessageStatus,
  parseMessageRumorInfo,
  toAuthorNpub,
  truncatePreviewText
}
export type { NostrMessageDetailRow, NostrMessagePreview }
