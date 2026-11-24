import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { getDb } from '@/db/connection'
import type { NostrChatConversationItem } from '@/types/models/Nostr'
import {
  archiveChatSession,
  countSessionsByPeer,
  createChatSessionId,
  getConversationKey,
  isDefaultChatSession,
  labelConversationSessions,
  renameChatSessionTitle,
  startChatSession
} from '@/utils/nostrChatSessions'
import { isChatSessionId } from '@/utils/nostrChatTags'

import { mockQueryResult } from '../db/queryResult'

const execute = jest.mocked(getDb().execute)

function conversation(
  peerPubkey: string,
  sessionId: string
): NostrChatConversationItem {
  return {
    lastMessageAt: 1,
    lastMessagePreview: '',
    peerNpub: `npub-${peerPubkey}`,
    peerPubkey,
    sessionId,
    unreadCount: 0
  }
}

describe('nostrChatSessions', () => {
  beforeEach(() => {
    getDb()
    execute.mockClear()
    execute.mockReturnValue(mockQueryResult())
  })

  it('creates random, well-formed session ids', () => {
    const first = createChatSessionId()
    const second = createChatSessionId()

    expect(isChatSessionId(first)).toBe(true)
    expect(first).not.toBe(second)
  })

  it('starts a session locally with a cleaned title', () => {
    const session = startChatSession('npub1me', 'peer-1', '  Release\n 1.4 ')

    expect(session).toMatchObject({
      archived: false,
      identityNpub: 'npub1me',
      peerPubkey: 'peer-1',
      title: 'Release 1.4'
    })
    expect(isChatSessionId(session.sessionId)).toBe(true)
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO nostr_chat_sessions'),
      expect.arrayContaining([session.sessionId, 'Release 1.4'])
    )
  })

  it('creates the default session row before renaming it', () => {
    const key = { identityNpub: 'npub1me', peerPubkey: 'peer-1', sessionId: '' }

    renameChatSessionTitle(key, 'Main')

    const statements = execute.mock.calls.map(([sql]) => String(sql))
    expect(statements.some((sql) => sql.includes('INSERT OR IGNORE'))).toBe(
      true
    )
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE nostr_chat_sessions SET title = ?'),
      ['Main', 'npub1me', 'peer-1', '']
    )
  })

  it('clears a title renamed to nothing', () => {
    const key = {
      identityNpub: 'npub1me',
      peerPubkey: 'peer-1',
      sessionId: 'a'
    }

    renameChatSessionTitle(key, '   ')

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('SET title = ?'),
      [null, 'npub1me', 'peer-1', 'a']
    )
  })

  it('archives a session', () => {
    archiveChatSession(
      { identityNpub: 'npub1me', peerPubkey: 'peer-1', sessionId: 'a' },
      true
    )

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('SET archived = ?'),
      [1, 'npub1me', 'peer-1', 'a']
    )
  })

  it('keys and counts conversations per session', () => {
    const items = [
      conversation('peer-1', ''),
      conversation('peer-1', 'a'),
      conversation('peer-2', '')
    ]

    expect(items.map(getConversationKey)).toStrictEqual([
      'peer-1:',
      'peer-1:a',
      'peer-2:'
    ])
    expect(countSessionsByPeer(items)).toStrictEqual(
      new Map([
        ['peer-1', 2],
        ['peer-2', 1]
      ])
    )
  })

  it('treats the empty id as the default session', () => {
    expect(isDefaultChatSession('')).toBe(true)
    expect(isDefaultChatSession('a'.repeat(32))).toBe(false)
  })

  it('labels sessions only when a peer has several or one is named', () => {
    const labeled = labelConversationSessions([
      conversation('peer-1', ''),
      { ...conversation('peer-1', 'a'), title: 'Release' },
      conversation('peer-1', 'b'),
      conversation('peer-2', '')
    ])

    expect(labeled.map((item) => item.sessionLabel)).toStrictEqual([
      'Main chat',
      'Release',
      'Untitled session',
      undefined
    ])
  })

  it('masks session titles in privacy mode', () => {
    const labeled = labelConversationSessions(
      [
        { ...conversation('peer-1', 'a'), title: 'Secret project' },
        conversation('peer-2', '')
      ],
      true
    )

    expect(labeled.map((item) => item.sessionLabel)).toStrictEqual([
      NOSTR_PRIVACY_MASK,
      undefined
    ])
  })
})
