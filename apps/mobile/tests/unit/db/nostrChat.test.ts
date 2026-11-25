import { getDb } from '@/db/connection'
import {
  adoptChatSessionSubject,
  deleteChatMessagesForIdentity,
  deleteChatSession,
  insertChatMessage,
  insertChatSession,
  markChatThreadRead,
  renameChatSession,
  upsertChatSessionState
} from '@/db/mutations/nostrChat'
import {
  getChatMessage,
  getChatReplyParent,
  getChatReplyParentSessionId,
  getChatSession,
  getChatSessionState,
  getNewestSentChatMessageCreatedAt,
  listChatConversations,
  listArchivedChatSessions,
  listChatReplies,
  listChatThread,
  listOwnChatSessionMessageIds,
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
        ['npub1me', 'npub1me']
      )
    })

    it('hides archived sessions', () => {
      listChatConversations('npub1me', 'nip17')

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(s.archived, 0) = 0'),
        ['npub1me', 'npub1me']
      )
    })

    it('lists named sessions that have no message yet', () => {
      listChatConversations('npub1me', 'nip17')

      expect(execute).toHaveBeenCalledWith(
        expect.stringMatching(/UNION ALL[\s\S]*NOT EXISTS/),
        ['npub1me', 'npub1me']
      )
    })

    it('never applies session rows to NIP-04 threads', () => {
      listChatConversations('npub1me', 'nip04')

      const [[sql, params]] = execute.mock.calls
      expect(sql).not.toContain('nostr_chat_sessions')
      expect(sql).toContain("protocol = 'nip04'")
      expect(params).toStrictEqual(['npub1me'])
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
        ['npub1me', 'peer-1', 'a'.repeat(32), 'First', 0, 1, 0]
      )
    })

    it('locks a title the user set', () => {
      renameChatSession(
        { identityNpub: 'npub1me', peerPubkey: 'peer-1', sessionId: 'a' },
        null
      )

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('title_locked = 1'),
        [null, 'npub1me', 'peer-1', 'a']
      )
    })

    it('adopts a late subject only for an unnamed, unlocked session', () => {
      adoptChatSessionSubject(
        { identityNpub: 'npub1me', peerPubkey: 'peer-1', sessionId: 'a' },
        'Late title'
      )

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('title IS NULL AND title_locked = 0'),
        ['Late title', 'npub1me', 'peer-1', 'a']
      )
    })

    it('includes every message we sent when deleting a session for everyone', () => {
      listOwnChatSessionMessageIds('npub1me', 'peer-1', 'a')

      const [[sql]] = execute.mock.calls
      expect(sql).toContain("direction = 'out'")
      expect(sql).not.toContain('status')
    })

    it('lists archived sessions to restore them', () => {
      listArchivedChatSessions('npub1me', 'peer-1')

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('archived = 1'),
        ['npub1me', 'peer-1']
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
          expect.stringContaining('DELETE FROM nostr_chat_sessions'),
          expect.stringContaining('DELETE FROM nostr_chat_session_states')
        ])
      )
    })
  })

  describe('agent reports', () => {
    const cost = { amount: 272, requests: 9, unit: 'sat', v: 1 }
    const model = { id: 'claude-opus-5.5', provider: 'routstr', v: 1 }
    const messageRow = {
      content: 'done',
      created_at: 10,
      direction: 'in',
      id: 'm1',
      identity_npub: 'npub1me',
      peer_pubkey: 'peer-1',
      protocol: 'nip17',
      read: 0,
      session_id: '',
      status: 'sent'
    }

    it('stores a reply cost and model as JSON', () => {
      insertChatMessage({
        agentCost: cost,
        agentModel: model,
        content: 'done',
        created_at: 10,
        direction: 'in',
        id: 'm1',
        identityNpub: 'npub1me',
        peerPubkey: 'peer-1',
        protocol: 'nip17',
        read: false,
        sessionId: '',
        status: 'sent'
      })

      const params = execute.mock.calls[0]?.[1] ?? []
      expect(params.slice(-2)).toStrictEqual([
        JSON.stringify(cost),
        JSON.stringify(model)
      ])
    })

    it('reads them back validated, and drops a row that no longer parses', () => {
      execute.mockReturnValueOnce(
        mockQueryResult([
          {
            ...messageRow,
            agent_cost: JSON.stringify(cost),
            agent_model: '{broken'
          }
        ])
      )

      const message = getChatMessage('npub1me', 'm1')

      expect(message?.agentCost).toMatchObject(cost)
      expect(message).not.toHaveProperty('agentModel')
    })

    it('keeps only a newer session state document', () => {
      upsertChatSessionState({
        author: 'peer-1',
        content: '{"v":1}',
        createdAt: 20,
        identityNpub: 'npub1me',
        peerPubkey: 'peer-1',
        sessionId: ''
      })

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining(
          'WHERE excluded.created_at > nostr_chat_session_states.created_at'
        ),
        ['npub1me', 'peer-1', '', 'peer-1', '{"v":1}', 20]
      )
    })

    it('reads the session state of one author', () => {
      execute.mockReturnValueOnce(
        mockQueryResult([
          {
            content: JSON.stringify({ session: { busy: true }, v: 1 }),
            created_at: 20
          }
        ])
      )

      expect(
        getChatSessionState('npub1me', 'peer-1', '', 'peer-1')
      ).toMatchObject({ state: { session: { busy: true } }, updatedAt: 20 })
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('FROM nostr_chat_session_states'),
        ['npub1me', 'peer-1', '', 'peer-1']
      )
    })

    it('reads no state when the stored document is invalid', () => {
      execute.mockReturnValueOnce(
        mockQueryResult([{ content: '{"v":2}', created_at: 20 }])
      )

      expect(getChatSessionState('npub1me', 'peer-1', '', 'peer-1')).toBeNull()
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
        'DELETE FROM nostr_chat_session_states WHERE identity_npub = ?',
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
