import * as nostrKinds from 'nostr-tools/kinds'

import { NOSTR_PENDING_DM_ID_PREFIX } from '@/constants/nostr'
import { type NostrDM } from '@/types/models/Nostr'
import { safeNpubEncode } from '@/utils/nostr'
import {
  buildMessageDetailRows,
  buildMessagePreview,
  canDeleteMessageForEveryone,
  findMessageReplies,
  formatMessageTags,
  getChatProtocolKind,
  getMessageStatus,
  parseMessageRumorInfo,
  toAuthorNpub
} from '@/utils/nostrMessageDetail'
import {
  deviceChatMessageHref,
  nostrChatMessageHref
} from '@/utils/nostrNavigation'

const AUTHOR_HEX =
  '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
const AUTHOR_NPUB = safeNpubEncode(AUTHOR_HEX)
const MESSAGE_ID = 'a'.repeat(64)
const PARENT_ID = 'b'.repeat(64)

function makeDm(overrides: Partial<NostrDM> = {}): NostrDM {
  return {
    author: AUTHOR_HEX,
    content: { created_at: 1_700_000_000, description: 'hello' },
    created_at: 1_700_000_000,
    description: 'hello',
    event: '',
    id: MESSAGE_ID,
    label: 1,
    ...overrides
  }
}

describe('parseMessageRumorInfo', () => {
  it('reads kind and tags from a stored rumor', () => {
    const event = JSON.stringify({
      content: 'x',
      kind: 14,
      tags: [
        ['p', AUTHOR_HEX],
        ['e', PARENT_ID, '', 'reply']
      ]
    })
    expect(parseMessageRumorInfo(event)).toStrictEqual({
      kind: 14,
      tags: [
        ['p', AUTHOR_HEX],
        ['e', PARENT_ID, '', 'reply']
      ]
    })
  })

  it('returns null for an empty event', () => {
    expect(parseMessageRumorInfo('')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseMessageRumorInfo('{not json')).toBeNull()
  })

  it('returns null for malformed tags', () => {
    expect(
      parseMessageRumorInfo(JSON.stringify({ kind: 14, tags: [[1, 2]] }))
    ).toBeNull()
  })
})

describe('formatMessageTags', () => {
  it('prints one tag per line', () => {
    expect(
      formatMessageTags([
        ['p', 'abc'],
        ['k', '14']
      ])
    ).toBe('["p","abc"]\n["k","14"]')
  })
})

describe('getMessageStatus', () => {
  it('prefers failed over pending', () => {
    expect(getMessageStatus({ pending: true }, true)).toBe('failed')
  })

  it('reports pending and sent', () => {
    expect(getMessageStatus({ pending: true }, false)).toBe('pending')
    expect(getMessageStatus({}, false)).toBe('sent')
  })
})

describe('getChatProtocolKind', () => {
  it('maps protocols to DM kinds', () => {
    expect(getChatProtocolKind('nip04')).toBe(nostrKinds.EncryptedDirectMessage)
    expect(getChatProtocolKind('nip17')).toBe(nostrKinds.PrivateDirectMessage)
  })
})

describe('toAuthorNpub', () => {
  it('encodes hex authors and keeps npubs', () => {
    expect(AUTHOR_NPUB.startsWith('npub1')).toBe(true)
    expect(toAuthorNpub(AUTHOR_HEX.toUpperCase())).toBe(AUTHOR_NPUB)
    expect(toAuthorNpub(AUTHOR_NPUB)).toBe(AUTHOR_NPUB)
  })
})

describe('buildMessageDetailRows', () => {
  it('includes optional rows only when known', () => {
    const rows = buildMessageDetailRows({
      authorNpub: AUTHOR_NPUB,
      createdAt: 1_700_000_000,
      id: MESSAGE_ID,
      status: 'sent',
      wrapCount: 3
    })
    expect(rows.map((row) => row.key)).toStrictEqual([
      'author',
      'time',
      'timestamp',
      'id',
      'status',
      'wraps'
    ])
  })

  it('adds kind and protocol rows and copy values', () => {
    const rows = buildMessageDetailRows({
      authorNpub: AUTHOR_NPUB,
      createdAt: 1_700_000_000,
      id: MESSAGE_ID,
      kind: 14,
      protocol: 'nip17',
      status: 'pending',
      wrapCount: 0
    })
    const byKey = new Map(rows.map((row) => [row.key, row]))
    expect(byKey.get('kind')?.value).toBe('14')
    expect(byKey.get('protocol')?.value).toBe('NIP-17')
    expect(byKey.get('status')?.value).toBe('Pending')
    expect(byKey.get('wraps')?.value).toBe('0')
    expect(byKey.get('timestamp')?.value).toBe('1700000000')
    expect(byKey.get('id')?.copyValue).toBe(MESSAGE_ID)
    expect(byKey.get('id')?.value).not.toBe(MESSAGE_ID)
    expect(byKey.get('author')?.copyValue).toBe(AUTHOR_NPUB)
  })
})

describe('buildMessagePreview', () => {
  it('carries id, author label and text', () => {
    const preview = buildMessagePreview(makeDm(), 'Alice')
    expect(preview).toMatchObject({
      authorLabel: 'Alice',
      id: MESSAGE_ID,
      text: 'hello'
    })
    expect(preview.date).not.toBe('')
  })
})

describe('canDeleteMessageForEveryone', () => {
  it('requires an own, relay-published message', () => {
    expect(canDeleteMessageForEveryone(true, MESSAGE_ID)).toBe(true)
    expect(canDeleteMessageForEveryone(false, MESSAGE_ID)).toBe(false)
    expect(
      canDeleteMessageForEveryone(true, `${NOSTR_PENDING_DM_ID_PREFIX}123`)
    ).toBe(false)
  })
})

describe('findMessageReplies', () => {
  it('returns direct replies oldest first', () => {
    const late = makeDm({ created_at: 30, id: 'late', replyToId: PARENT_ID })
    const early = makeDm({ created_at: 10, id: 'early', replyToId: PARENT_ID })
    const other = makeDm({ id: 'other', replyToId: 'x' })
    expect(
      findMessageReplies([late, other, early], PARENT_ID).map((m) => m.id)
    ).toStrictEqual(['early', 'late'])
  })
})

describe('message detail hrefs', () => {
  it('builds the identity chat message href', () => {
    expect(nostrChatMessageHref('npub1me', MESSAGE_ID)).toStrictEqual({
      params: { messageId: MESSAGE_ID, npub: 'npub1me' },
      pathname: '/signer/nostr/account/[npub]/chat/message/[messageId]'
    })
  })

  it('builds the device chat message href', () => {
    expect(deviceChatMessageHref('acc', MESSAGE_ID)).toStrictEqual({
      params: { id: 'acc', messageId: MESSAGE_ID },
      pathname:
        '/signer/bitcoin/account/[id]/settings/nostr/message/[messageId]'
    })
  })
})
