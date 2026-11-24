import { getDb } from '@/db/connection'
import {
  deleteChatMessagesForIdentity,
  deleteChatSession,
  insertChatSession,
  markChatThreadRead
} from '@/db/mutations/nostrChat'
import {
  getChatReplyParent,
  getChatReplyParentSessionId,
  getChatSession,
  getNewestSentChatMessageCreatedAt,
  listChatConversations,
  listChatReplies,
  listChatThread,
  listPeersWrittenTo
} from '@/db/queries/nostrChat'

import { mockQueryResult } from './queryResult'

const execute = jest.mocked(getDb().execute)

describe('nostr chat queries', () => {
  beforeEach(() => {
    // Migrations run on first getDb(); clear so assertions only see chat SQL.
    getDb()
    execute.mockClear()
    execute.mockReturnValue(mockQueryResult())
  })

  describe('listChatConversations', () => {
    it('reads every conversation with its latest preview in one query', () => {
      execute.mockReturnValueOnce(
        mockQueryResult([
          {
            last_message_at: 1_700_000_002,
            last_message_preview: 'latest',
            peer_pubkey: 'peer-1',
            session_id: '',
            title: null,
            unread_count: 2
          },
          {
            last_message_at: 1_700_000_001,
            last_message_preview: 'older thread',
            peer_pubkey: 'peer-2',
            session_id: 'c'.repeat(32),
            title: 'Release',
            unread_count: null
          }
        ])
      )

      expect(listChatConversations('npub1me', 'nip17')).toStrictEqual([
        {
          lastMessageAt: 1_700_000_002,
          lastMessagePreview: 'latest',
          peerPubkey: 'peer-1',
          sessionId: '',
          unreadCount: 2
        },
        {
          lastMessageAt: 1_700_000_001,
          lastMessagePreview: 'older thread',
          peerPubkey: 'peer-2',
          sessionId: 'c'.repeat(32),
          title: 'Release',
          unreadCount: 0
        }
      ])
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY m.peer_pubkey, m.session_id'),
        ['npub1me', 'nip17']
      )
    })

    it('hides archived sessions', () => {
      listChatConversations('npub1me', 'nip17')

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(s.archived, 0) = 0'),
        ['npub1me', 'nip17']
      )
    })
  })

  describe('chat cursors', () => {
    it('reads the newest relay-confirmed message as the catch-up cursor', () => {
      execute.mockReturnValueOnce(mockQueryResult([{ newest: 1_700_000_005 }]))

      expect(getNewestSentChatMessageCreatedAt('npub1me', 'nip04')).toBe(
        1_700_000_005
      )
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining("status = 'sent'"),
        ['npub1me', 'nip04']
      )
    })

    it('returns null when nothing is stored', () => {
      execute.mockReturnValueOnce(mockQueryResult([{ newest: null }]))

      expect(getNewestSentChatMessageCreatedAt('npub1me', 'nip17')).toBeNull()
    })
  })

  describe('listChatThread', () => {
    it('maps the stored messages oldest first', () => {
      execute.mockReturnValue(
        mockQueryResult([
          {
            content: 'hi',
            created_at: 1_700_000_001,
            direction: 'out',
            id: 'msg-2',
            identity_npub: 'npub1me',
            peer_pubkey: 'peer-1',
            protocol: 'nip04',
            read: 1,
            status: 'pending'
          },
          {
            content: 'hello',
            created_at: 1_700_000_000,
            direction: 'in',
            id: 'msg-1',
            identity_npub: 'npub1me',
            peer_pubkey: 'peer-1',
            protocol: 'nip04',
            read: 0,
            status: 'sent'
          }
        ])
      )

      const thread = {
        identityNpub: 'npub1me',
        peerPubkey: 'peer-1',
        protocol: 'nip04' as const,
        sessionId: ''
      }
      expect(listChatThread(thread, 50)).toStrictEqual([
        {
          content: 'hello',
          created_at: 1_700_000_000,
          direction: 'in',
          id: 'msg-1',
          identityNpub: 'npub1me',
          peerPubkey: 'peer-1',
          protocol: 'nip04',
          read: false,
          sessionId: '',
          status: 'sent'
        },
        {
          content: 'hi',
          created_at: 1_700_000_001,
          direction: 'out',
          id: 'msg-2',
          identityNpub: 'npub1me',
          peerPubkey: 'peer-1',
          protocol: 'nip04',
          read: true,
          sessionId: '',
          status: 'pending'
        }
      ])
    })

    it('reads one session only', () => {
      const sessionId = 'd'.repeat(32)
      listChatThread(
        {
          identityNpub: 'npub1me',
          peerPubkey: 'peer-1',
          protocol: 'nip17',
          sessionId
        },
        50
      )

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('session_id = ?'),
        ['npub1me', 'nip17', 'peer-1', sessionId, 50]
      )
    })
  })

  describe('reply links', () => {
    const message = {
      id: 'msg-2',
      identityNpub: 'npub1me',
      peerPubkey: 'peer-1',
      protocol: 'nip17' as const,
      replyToId: 'msg-1',
      sessionId: 'e'.repeat(32)
    }

    it('looks for the parent only in the same chat', () => {
      getChatReplyParent(message)

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('session_id = ? AND id = ?'),
        ['npub1me', 'nip17', 'peer-1', 'e'.repeat(32), 'msg-1']
      )
    })

    it('has no parent for a message that is not a reply', () => {
      expect(
        getChatReplyParent({ ...message, replyToId: undefined })
      ).toBeNull()
      expect(execute).not.toHaveBeenCalled()
    })

    it('lists replies only from the same chat', () => {
      listChatReplies(message)

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('session_id = ? AND reply_to_id = ?'),
        ['npub1me', 'nip17', 'peer-1', 'e'.repeat(32), 'msg-2']
      )
    })
  })

  describe('listPeersWrittenTo', () => {
    it('lists each peer with an outgoing message once', () => {
      execute.mockReturnValueOnce(
        mockQueryResult([{ peer_pubkey: 'peer-1' }, { peer_pubkey: 'peer-2' }])
      )

      expect(listPeersWrittenTo('npub1me')).toStrictEqual(['peer-1', 'peer-2'])
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining("direction = 'out'"),
        ['npub1me']
      )
    })

    it('counts a peer written to over any protocol', () => {
      listPeersWrittenTo('npub1me')

      expect(execute).toHaveBeenCalledWith(
        expect.not.stringContaining('protocol'),
        ['npub1me']
      )
    })
  })

  describe('chat sessions', () => {
    it('finds a reply parent session only for the same identity and peer', () => {
      execute.mockReturnValueOnce(mockQueryResult([{ session_id: 'f' }]))

      expect(getChatReplyParentSessionId('npub1me', 'peer-1', 'msg-1')).toBe(
        'f'
      )
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining(
          'identity_npub = ? AND peer_pubkey = ? AND id = ?'
        ),
        ['npub1me', 'peer-1', 'msg-1']
      )
    })

    it('has no parent session when the parent is unknown', () => {
      expect(
        getChatReplyParentSessionId('npub1me', 'peer-1', 'msg-1')
      ).toBeNull()
    })

    it('maps a stored session', () => {
      execute.mockReturnValueOnce(
        mockQueryResult([
          {
            archived: 1,
            created_at: 5,
            identity_npub: 'npub1me',
            peer_pubkey: 'peer-1',
            session_id: 'a'.repeat(32),
            title: 'Release'
          }
        ])
      )

      expect(getChatSession('npub1me', 'peer-1', 'a'.repeat(32))).toStrictEqual(
        {
          archived: true,
          createdAt: 5,
          identityNpub: 'npub1me',
          peerPubkey: 'peer-1',
          sessionId: 'a'.repeat(32),
          title: 'Release'
        }
      )
    })

    it('keeps the first title a session got', () => {
      insertChatSession({
        archived: false,
        createdAt: 1,
        identityNpub: 'npub1me',
        peerPubkey: 'peer-1',
        sessionId: 'a'.repeat(32),
        title: 'First'
      })

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO nostr_chat_sessions'),
        ['npub1me', 'peer-1', 'a'.repeat(32), 'First', 1, 0]
      )
    })

    it('marks only one session read', () => {
      markChatThreadRead({
        identityNpub: 'npub1me',
        peerPubkey: 'peer-1',
        protocol: 'nip17',
        sessionId: 'a'.repeat(32)
      })

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('session_id = ? AND read = 0'),
        ['npub1me', 'nip17', 'peer-1', 'a'.repeat(32)]
      )
    })

    it('deletes a session with its messages and their reactions', () => {
      deleteChatSession({
        identityNpub: 'npub1me',
        peerPubkey: 'peer-1',
        sessionId: 'a'.repeat(32)
      })

      const statements = execute.mock.calls.map(([sql]) => sql)
      expect(statements).toStrictEqual(
        expect.arrayContaining([
          expect.stringContaining('DELETE FROM nostr_chat_reactions'),
          expect.stringContaining('DELETE FROM nostr_chat_messages'),
          expect.stringContaining('DELETE FROM nostr_chat_sessions')
        ])
      )
    })
  })

  describe('deleteChatMessagesForIdentity', () => {
    it('also forgets the wraps the identity sent and the messages it deleted', () => {
      deleteChatMessagesForIdentity('npub1me')

      expect(execute).toHaveBeenCalledWith(
        'DELETE FROM nostr_chat_sessions WHERE identity_npub = ?',
        ['npub1me']
      )
      expect(execute).toHaveBeenCalledWith(
        'DELETE FROM nostr_message_wraps WHERE scope = ?',
        ['chat:npub1me']
      )
      expect(execute).toHaveBeenCalledWith(
        'DELETE FROM nostr_deleted_messages WHERE scope = ?',
        ['chat:npub1me']
      )
    })
  })
})
