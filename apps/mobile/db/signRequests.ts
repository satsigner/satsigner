import { NOSTR_NIP46_SUPPORTED_METHODS } from '@/constants/nostr'
import type {
  Nip46Method,
  NostrSignRequest,
  NostrSignRequestStatus
} from '@/types/models/Nostr'

import { getDb, runTransaction } from './connection'
import { boolToInt } from './mappers'

type SignRequestRow = {
  answered: number
  error: string | null
  expires_at: number
  identity_npub: string
  label: string | null
  message_id: string
  method: string
  params: string
  peer_pubkey: string
  request_id: string
  requested_at: number
  result: string | null
  session_id: string
  status: string
}

const SIGN_REQUEST_STATUSES: NostrSignRequestStatus[] = [
  'expired',
  'invalid',
  'pending',
  'rejected',
  'signed'
]

function toStatus(value: string): NostrSignRequestStatus {
  return SIGN_REQUEST_STATUSES.find((status) => status === value) ?? 'invalid'
}

function toMethod(value: string): Nip46Method {
  return (
    NOSTR_NIP46_SUPPORTED_METHODS.find((method) => method === value) ?? 'ping'
  )
}

function parseParams(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed)
      ? parsed.map((param) => (typeof param === 'string' ? param : ''))
      : []
  } catch {
    return []
  }
}

function rowToSignRequest(row: SignRequestRow): NostrSignRequest {
  return {
    answered: row.answered === 1,
    expiresAt: row.expires_at,
    identityNpub: row.identity_npub,
    messageId: row.message_id,
    method: toMethod(row.method),
    params: parseParams(row.params),
    peerPubkey: row.peer_pubkey,
    requestId: row.request_id,
    requestedAt: row.requested_at,
    sessionId: row.session_id,
    status: toStatus(row.status),
    ...(row.label ? { label: row.label } : {}),
    ...(row.result ? { result: row.result } : {}),
    ...(row.error ? { error: row.error } : {})
  }
}

/** INSERT OR IGNORE: a relay resending the message must not reset a decision. */
function insertSignRequests(requests: NostrSignRequest[]): number {
  const inserted = { count: 0 }
  runTransaction((tx) => {
    for (const request of requests) {
      const { rowsAffected } = tx.execute(
        `INSERT OR IGNORE INTO nostr_sign_requests (
          identity_npub, peer_pubkey, session_id, message_id, request_id,
          method, params, label, status, result, error, answered,
          requested_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          request.identityNpub,
          request.peerPubkey,
          request.sessionId,
          request.messageId,
          request.requestId,
          request.method,
          JSON.stringify(request.params),
          request.label ?? null,
          request.status,
          request.result ?? null,
          request.error ?? null,
          boolToInt(request.answered),
          request.requestedAt,
          request.expiresAt
        ]
      )
      inserted.count += rowsAffected ?? 0
    }
  })
  return inserted.count
}

function listSignRequestsForMessages(
  identityNpub: string,
  messageIds: string[]
): NostrSignRequest[] {
  if (messageIds.length === 0) {
    return []
  }
  const placeholders = messageIds.map(() => '?').join(', ')
  return getDb()
    .execute<SignRequestRow>(
      `SELECT * FROM nostr_sign_requests
        WHERE identity_npub = ? AND message_id IN (${placeholders})
        ORDER BY rowid ASC`,
      [identityNpub, ...messageIds]
    )
    .rows._array.map(rowToSignRequest)
}

function listSignRequestBatch(
  identityNpub: string,
  messageId: string
): NostrSignRequest[] {
  return listSignRequestsForMessages(identityNpub, [messageId])
}

function countPendingSignRequests(
  identityNpub: string,
  peerPubkey: string
): number {
  const row = getDb()
    .execute<{ total: number }>(
      `SELECT COUNT(*) AS total FROM nostr_sign_requests
        WHERE identity_npub = ? AND peer_pubkey = ? AND status = 'pending'`,
      [identityNpub, peerPubkey]
    )
    .rows.item(0)
  return row?.total ?? 0
}

type SignRequestDecision = Pick<
  NostrSignRequest,
  'error' | 'requestId' | 'result' | 'status'
>

/**
 * Stores the decision for a whole batch at once, while it is still open: no
 * request in it is signed, rejected or expired, and no answer went out. A
 * second tap can't sign twice. Returns whether this call made the decision.
 */
function decideSignRequestBatch(
  identityNpub: string,
  messageId: string,
  decisions: SignRequestDecision[]
): boolean {
  const decided = { changed: false }
  runTransaction((tx) => {
    const { rows } = tx.execute<{ closed: number; total: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN answered = 1
                         OR status IN ('signed', 'rejected', 'expired')
                       THEN 1 ELSE 0 END) AS closed
         FROM nostr_sign_requests
        WHERE identity_npub = ? AND message_id = ?`,
      [identityNpub, messageId]
    )
    const counts = rows.item(0)
    if (!counts || counts.total === 0 || (counts.closed ?? 0) > 0) {
      return
    }
    for (const decision of decisions) {
      tx.execute(
        `UPDATE nostr_sign_requests SET status = ?, result = ?, error = ?
          WHERE identity_npub = ? AND message_id = ? AND request_id = ?`,
        [
          decision.status,
          decision.result ?? null,
          decision.error ?? null,
          identityNpub,
          messageId,
          decision.requestId
        ]
      )
    }
    decided.changed = true
  })
  return decided.changed
}

function markSignRequestBatchAnswered(identityNpub: string, messageId: string) {
  getDb().execute(
    `UPDATE nostr_sign_requests SET answered = 1
      WHERE identity_npub = ? AND message_id = ?`,
    [identityNpub, messageId]
  )
}

function expireSignRequests(identityNpub: string, nowSeconds: number): number {
  const { rowsAffected } = getDb().execute(
    `UPDATE nostr_sign_requests SET status = 'expired'
      WHERE identity_npub = ? AND status IN ('pending', 'invalid')
        AND expires_at <= ?`,
    [identityNpub, nowSeconds]
  )
  return rowsAffected ?? 0
}

/** Settled requests are only kept for replay protection and retries. */
function pruneSignRequests(identityNpub: string, olderThanSeconds: number) {
  getDb().execute(
    `DELETE FROM nostr_sign_requests
      WHERE identity_npub = ? AND status != 'pending'
        AND (answered = 1 OR status = 'expired') AND requested_at < ?`,
    [identityNpub, olderThanSeconds]
  )
}

function deleteSignRequestsForSession(
  identityNpub: string,
  peerPubkey: string,
  sessionId: string
) {
  getDb().execute(
    `DELETE FROM nostr_sign_requests
      WHERE identity_npub = ? AND peer_pubkey = ? AND session_id = ?`,
    [identityNpub, peerPubkey, sessionId]
  )
}

function deleteSignRequestsForIdentity(identityNpub: string) {
  getDb().execute('DELETE FROM nostr_sign_requests WHERE identity_npub = ?', [
    identityNpub
  ])
}

export {
  countPendingSignRequests,
  decideSignRequestBatch,
  deleteSignRequestsForIdentity,
  deleteSignRequestsForSession,
  expireSignRequests,
  insertSignRequests,
  listSignRequestBatch,
  listSignRequestsForMessages,
  markSignRequestBatchAnswered,
  pruneSignRequests
}
export type { SignRequestDecision }
