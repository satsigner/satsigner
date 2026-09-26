import { getDb } from '@/db/connection'
import {
  getChatMessageById,
  listChatConversations
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
    it('reads each conversation with its latest message as preview', () => {
      execute
        .mockReturnValueOnce(
          mockQueryResult([
            {
              last_message_at: 1700000002,
              peer_pubkey: 'peer-1',
              unread_count: 2
            },
            {
              last_message_at: 1700000001,
              peer_pubkey: 'peer-2',
              unread_count: null
            }
          ])
        )
        .mockReturnValueOnce(mockQueryResult([{ content: 'latest' }]))

      expect(listChatConversations('npub1me', 'nip17')).toStrictEqual([
        {
          lastMessageAt: 1700000002,
          lastMessagePreview: 'latest',
          peerPubkey: 'peer-1',
          unreadCount: 2
        },
        {
          lastMessageAt: 1700000001,
          lastMessagePreview: '',
          peerPubkey: 'peer-2',
          unreadCount: 0
        }
      ])
    })
  })

  describe('getChatMessageById', () => {
    it('maps the stored message', () => {
      execute.mockReturnValue(
        mockQueryResult([
          {
            content: 'hi',
            created_at: 1700000000,
            direction: 'out',
            id: 'msg-1',
            identity_npub: 'npub1me',
            peer_pubkey: 'peer-1',
            protocol: 'nip04',
            read: 1,
            status: 'pending'
          }
        ])
      )

      expect(getChatMessageById('npub1me', 'msg-1')).toStrictEqual({
        content: 'hi',
        created_at: 1700000000,
        direction: 'out',
        id: 'msg-1',
        identityNpub: 'npub1me',
        peerPubkey: 'peer-1',
        protocol: 'nip04',
        read: true,
        status: 'pending'
      })
    })

    it('returns null when the message does not exist', () => {
      expect(getChatMessageById('npub1me', 'missing')).toBeNull()
    })
  })
})
