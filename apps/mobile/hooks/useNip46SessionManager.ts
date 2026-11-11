import { Nip46BunkerService } from '@/api/nostrNip446'
import {
  NIP46_ACTIVITY_WRITE_INTERVAL_MS,
  NOSTR_NIP46_SUPPORTED_METHODS
} from '@/constants/nostr'
import {
  getNip46Runtime,
  isNip46SessionActive,
  registerNip46Session,
  stopAllNip46Sessions,
  stopNip46Session
} from '@/services/nip46Sessions'
import { useAuthStore } from '@/store/auth'
import { useNip46Store } from '@/store/nip46'
import type {
  Nip46Method,
  Nip46Request,
  Nip46Session
} from '@/types/models/Nostr'
import { isAppLocked } from '@/utils/appLifecycle'
import { buildNip46ResponsePayload, canAutoApproveRequest } from '@/utils/nip46'
import {
  handleConnect,
  handleGetPublicKey,
  handleNip04Decrypt,
  handleNip04Encrypt,
  handleNip44Decrypt,
  handleNip44Encrypt,
  handlePing,
  handleSignEvent
} from '@/utils/nip46Handlers'
import { getPubKeyHexFromNpub, getSecretFromNsec } from '@/utils/nostr'

function shouldRecordNip46Activity(lastActiveAt: number, now: number) {
  return now - lastActiveAt >= NIP46_ACTIVITY_WRITE_INTERVAL_MS
}

async function fireAndForget(promise: Promise<unknown>): Promise<void> {
  try {
    await promise
  } catch {
    // intentionally swallowed
  }
}

function isValidMethod(method: string): method is Nip46Method {
  return NOSTR_NIP46_SUPPORTED_METHODS.some((supported) => supported === method)
}

function getPendingRequestById(requestId: string): Nip46Request | undefined {
  return useNip46Store
    .getState()
    .pendingRequests.find((r) => r.id === requestId)
}

function executeHandler(
  method: Nip46Method,
  params: string[],
  signerPubkeyHex: string,
  signerSecretKey: Uint8Array,
  expectedSecret: string | undefined
): string {
  switch (method) {
    case 'ping': {
      return handlePing()
    }
    case 'get_public_key': {
      return handleGetPublicKey(signerPubkeyHex)
    }
    case 'connect': {
      return handleConnect(params, expectedSecret, signerPubkeyHex)
    }
    case 'sign_event': {
      return handleSignEvent(params[0], signerSecretKey)
    }
    case 'nip04_encrypt': {
      return handleNip04Encrypt(params[0], params[1], signerSecretKey)
    }
    case 'nip04_decrypt': {
      return handleNip04Decrypt(params[0], params[1], signerSecretKey)
    }
    case 'nip44_encrypt': {
      return handleNip44Encrypt(params[0], params[1], signerSecretKey)
    }
    case 'nip44_decrypt': {
      return handleNip44Decrypt(params[0], params[1], signerSecretKey)
    }
    default: {
      throw new Error(`Unsupported method: ${method}`)
    }
  }
}

function getSessionById(sessionId: string): Nip46Session | undefined {
  return useNip46Store.getState().sessions.find((s) => s.id === sessionId)
}

function buildRequestResponse(
  request: Nip46Request,
  signerPubkeyHex: string,
  secretKey: Uint8Array,
  expectedSecret: string | undefined
) {
  try {
    const result = executeHandler(
      request.method,
      request.params,
      signerPubkeyHex,
      secretKey,
      expectedSecret
    )
    return buildNip46ResponsePayload(request.id, result, null)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return buildNip46ResponsePayload(request.id, null, errorMsg)
  }
}

async function sendPayload(
  sessionId: string,
  buildPayload: (signerPubkeyHex: string, secretKey: Uint8Array) => string
): Promise<boolean> {
  const session = getSessionById(sessionId)
  const runtime = getNip46Runtime(sessionId)
  const signerPubkeyHex = session
    ? getPubKeyHexFromNpub(session.signerNpub)
    : null
  if (!session || !runtime || !signerPubkeyHex) {
    return false
  }
  const { secretKey, service } = runtime
  try {
    await service.sendResponse(
      session.clientPubkey,
      secretKey,
      buildPayload(signerPubkeyHex, secretKey)
    )
    return true
  } catch {
    return false
  }
}

/** Answers a request; resolves to whether the answer reached the relays. */
function respondToRequest(
  sessionId: string,
  request: Nip46Request
): Promise<boolean> {
  const session = getSessionById(sessionId)
  return sendPayload(sessionId, (signerPubkeyHex, secretKey) =>
    buildRequestResponse(request, signerPubkeyHex, secretKey, session?.secret)
  )
}

function sendError(
  sessionId: string,
  requestId: string,
  errorMessage: string
): Promise<boolean> {
  return sendPayload(sessionId, () =>
    buildNip46ResponsePayload(requestId, null, errorMessage)
  )
}

/** `skipped`: the request is gone or already being answered. */
export type Nip46AnswerResult = 'sent' | 'failed' | 'skipped'

// A request being answered is not answered again: a double tap, or Approve
// then Reject, would otherwise sign twice, send two answers or store the
// permission of the answer that was not sent.
const requestsBeingAnswered = new Set<string>()

async function answerOnce(
  requestId: string,
  answer: () => Promise<boolean>
): Promise<Nip46AnswerResult> {
  if (requestsBeingAnswered.has(requestId)) {
    return 'skipped'
  }
  requestsBeingAnswered.add(requestId)
  try {
    return (await answer()) ? 'sent' : 'failed'
  } finally {
    requestsBeingAnswered.delete(requestId)
  }
}

// An approved request leaves the queue only once its answer was sent, so a
// failed send can be retried instead of leaving the client waiting forever.
export function approveNip46Request(
  requestId: string,
  alwaysAllow: boolean
): Promise<Nip46AnswerResult> {
  const request = getPendingRequestById(requestId)
  if (!request) {
    return Promise.resolve('skipped')
  }
  return answerOnce(requestId, async () => {
    const sent = await respondToRequest(request.sessionId, {
      ...request,
      status: 'approved'
    })
    if (!sent) {
      return false
    }
    // Persisted only once sent: a failed send leaves the request queued, and
    // the user may still reject it. Never persist a blanket permission for
    // requests that must always be approved explicitly (decryption,
    // sensitive sign_event kinds).
    if (alwaysAllow && canAutoApproveRequest(request.method, request.params)) {
      useNip46Store
        .getState()
        .updatePermission(request.sessionId, request.method, 'always_allow')
    }
    useNip46Store.getState().removePendingRequest(requestId)
    return true
  })
}

// A rejection leaves the queue even when its answer cannot be sent: the
// client times out on its own, and the prompt must never trap the user.
export function rejectNip46Request(
  requestId: string,
  alwaysReject: boolean
): Promise<Nip46AnswerResult> {
  const request = getPendingRequestById(requestId)
  if (!request) {
    return Promise.resolve('skipped')
  }
  return answerOnce(requestId, () => {
    if (alwaysReject) {
      useNip46Store
        .getState()
        .updatePermission(request.sessionId, request.method, 'always_reject')
    }
    useNip46Store.getState().removePendingRequest(requestId)
    return sendError(request.sessionId, request.id, 'Rejected by user')
  })
}

export async function startNip46Session(
  session: Nip46Session,
  nsec: string
): Promise<void> {
  const { addPendingRequest, updateSession } = useNip46Store.getState()
  const secretKey = getSecretFromNsec(nsec)
  if (!secretKey) {
    throw new Error('Invalid nsec')
  }

  const signerPubkeyHex = getPubKeyHexFromNpub(session.signerNpub)
  if (!signerPubkeyHex) {
    throw new Error('Invalid signer npub')
  }

  updateSession(session.id, { connectionStatus: 'connecting' })
  const connectSecret = session.secret ?? ''

  try {
    const service = new Nip46BunkerService({
      onConnectionChange: (isConnected) =>
        updateSession(session.id, {
          connectionStatus: isConnected ? 'connected' : 'connecting'
        })
    })
    await service.connect(session.relays)
    // Locking stopped every bunker while this one was still connecting.
    if (isAppLocked(useAuthStore.getState())) {
      service.disconnect()
      secretKey.fill(0)
      updateSession(session.id, { connectionStatus: 'disconnected' })
      return
    }

    registerNip46Session(session.id, service, secretKey)

    service.subscribe(
      signerPubkeyHex,
      secretKey,
      session.clientPubkey,
      (request) => {
        if (!isValidMethod(request.method)) {
          return
        }

        const currentSession = getSessionById(session.id)
        if (!currentSession) {
          return
        }

        const permission = currentSession.permissions[request.method]
        const now = Date.now()
        if (
          now < currentSession.lastActiveAt ||
          shouldRecordNip46Activity(currentSession.lastActiveAt, now)
        ) {
          updateSession(session.id, { lastActiveAt: now })
        }

        // A stored "always allow" is honored only for requests that are
        // safe to auto-approve; decryption and sensitive sign_event kinds
        // always require explicit approval.
        if (
          permission === 'always_allow' &&
          canAutoApproveRequest(request.method, request.params)
        ) {
          fireAndForget(
            respondToRequest(session.id, {
              id: request.id,
              method: request.method,
              params: request.params,
              receivedAt: Date.now(),
              sessionId: session.id,
              status: 'approved'
            })
          )
          return
        }

        if (permission === 'always_reject') {
          fireAndForget(sendError(session.id, request.id, 'Rejected by user'))
          return
        }

        addPendingRequest({
          id: request.id,
          method: request.method,
          params: request.params,
          receivedAt: Date.now(),
          sessionId: session.id,
          status: 'pending'
        })
      }
    )

    const connectPayload = buildNip46ResponsePayload(
      'connect',
      connectSecret,
      null
    )
    await service.sendResponse(session.clientPubkey, secretKey, connectPayload)
    updateSession(session.id, { connectionStatus: 'connected' })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Connection failed'
    const isRelayError = errMsg.includes('Failed to connect to any relay')
    updateSession(session.id, {
      connectionError: isRelayError ? undefined : errMsg,
      connectionStatus: isRelayError ? 'relays_unreachable' : 'error'
    })

    stopNip46Session(session.id)

    throw error
  }
}

export function useNip46SessionManager() {
  return {
    approveRequest: approveNip46Request,
    isSessionActive: isNip46SessionActive,
    rejectRequest: rejectNip46Request,
    startSession: startNip46Session,
    stopAllSessions: stopAllNip46Sessions,
    stopSession: stopNip46Session
  }
}

export { isNip46SessionActive, shouldRecordNip46Activity }
