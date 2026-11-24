import { getDb } from '@/db/connection'
import {
  decideSignRequestBatch,
  expireSignRequests,
  insertSignRequests,
  listSignRequestBatch,
  pruneSignRequests
} from '@/db/signRequests'
import type { NostrSignRequest } from '@/types/models/Nostr'

import { mockQueryResult } from './queryResult'

const execute = jest.mocked(getDb().execute)

const request: NostrSignRequest = {
  answered: false,
  expiresAt: 2000,
  identityNpub: 'npub1me',
  label: 'Release',
  messageId: 'm1',
  method: 'sign_event',
  params: ['{"kind":1}'],
  peerPubkey: 'peer',
  requestId: 'r1',
  requestedAt: 1000,
  sessionId: 's1',
  status: 'pending'
}

describe('sign request storage', () => {
  beforeEach(() => {
    getDb()
    execute.mockClear()
    execute.mockReturnValue(mockQueryResult())
  })

  it('never overwrites a stored request when a relay resends it', () => {
    insertSignRequests([request])

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO nostr_sign_requests'),
      expect.arrayContaining(['npub1me', 'm1', 'r1', '["{\\"kind\\":1}"]'])
    )
  })

  it('maps stored rows back, with unknown values made safe', () => {
    execute.mockReturnValueOnce(
      mockQueryResult([
        {
          answered: 0,
          error: null,
          expires_at: 2000,
          identity_npub: 'npub1me',
          label: null,
          message_id: 'm1',
          method: 'sign_psbt',
          params: 'not json',
          peer_pubkey: 'peer',
          request_id: 'r1',
          requested_at: 1000,
          result: null,
          session_id: 's1',
          status: 'weird'
        }
      ])
    )

    expect(listSignRequestBatch('npub1me', 'm1')).toMatchObject([
      { method: 'ping', params: [], status: 'invalid' }
    ])
  })

  it('decides an open batch', () => {
    execute.mockImplementation((sql: string) =>
      sql.includes('COUNT(*)')
        ? mockQueryResult([{ closed: 0, total: 1 }])
        : mockQueryResult()
    )

    expect(
      decideSignRequestBatch('npub1me', 'm1', [
        { requestId: 'r1', result: '{}', status: 'signed' }
      ])
    ).toBe(true)
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE nostr_sign_requests SET status = ?'),
      ['signed', '{}', null, 'npub1me', 'm1', 'r1']
    )
  })

  it('never decides a batch twice', () => {
    execute.mockImplementation((sql: string) =>
      sql.includes('COUNT(*)')
        ? mockQueryResult([{ closed: 1, total: 1 }])
        : mockQueryResult()
    )

    expect(
      decideSignRequestBatch('npub1me', 'm1', [
        { requestId: 'r1', result: '{}', status: 'signed' }
      ])
    ).toBe(false)
    expect(execute).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE nostr_sign_requests SET status = ?'),
      expect.anything()
    )
  })

  it('expires only undecided requests', () => {
    expireSignRequests('npub1me', 1500)

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('pending', 'invalid')"),
      ['npub1me', 1500]
    )
  })

  it('prunes only settled requests', () => {
    pruneSignRequests('npub1me', 900)

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("status != 'pending'"),
      ['npub1me', 900]
    )
  })
})
