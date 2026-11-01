import { getDb } from '@/db/connection'
import {
  getNewestSentChatMessageCreatedAt,
  listChatConversations,
  listChatThread
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
            unread_count: 2
          },
          {
            last_message_at: 1_700_000_001,
            last_message_preview: 'older thread',
            peer_pubkey: 'peer-2',
            unread_count: null
          }
        ])
      )

      expect(listChatConversations('npub1me', 'nip17')).toStrictEqual([
        {
          lastMessageAt: 1_700_000_002,
          lastMessagePreview: 'latest',
          peerPubkey: 'peer-1',
          unreadCount: 2
        },
        {
          lastMessageAt: 1_700_000_001,
          lastMessagePreview: 'older thread',
          peerPubkey: 'peer-2',
          unreadCount: 0
        }
      ])
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY peer_pubkey'),
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

      expect(listChatThread('npub1me', 'nip04', 'peer-1', 50)).toStrictEqual([
        {
          content: 'hello',
          created_at: 1_700_000_000,
          direction: 'in',
          id: 'msg-1',
          identityNpub: 'npub1me',
          peerPubkey: 'peer-1',
          protocol: 'nip04',
          read: false,
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
          status: 'pending'
        }
      ])
    })
  })
})
