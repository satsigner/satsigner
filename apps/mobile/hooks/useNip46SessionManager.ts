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
import { useNip46Store } from '@/store/nip46'
import type {
  Nip46Method,
  Nip46Request,
  Nip46Session
} from '@/types/models/Nostr'
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

// A request being answered is not answered again: a double tap, or Approve
// then Reject, would otherwise sign twice or send two answers.
const requestsBeingAnswered = new Set<string>()

async function answerOnce(
  requestId: string,
  answer: () => Promise<boolean>
): Promise<boolean> {
  if (requestsBeingAnswered.has(requestId)) {
    return false
  }
  requestsBeingAnswered.add(requestId)
  try {
    return await answer()
  } finally {
    requestsBeingAnswered.delete(requestId)
  }
}

export function useNip46SessionManager() {
  const addPendingRequest = useNip46Store((s) => s.addPendingRequest)
  const removePendingRequest = useNip46Store((s) => s.removePendingRequest)
  const updateSession = useNip46Store((s) => s.updateSession)
  const updatePermission = useNip46Store((s) => s.updatePermission)

  async function startSession(
    session: Nip46Session,
    nsec: string
  ): Promise<void> {
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
      const service = new Nip46BunkerService()
      await service.connect(session.relays)

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
      await service.sendResponse(
        session.clientPubkey,
        secretKey,
        connectPayload
      )
      updateSession(session.id, { connectionStatus: 'connected' })
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : 'Connection failed'
      const isRelayError = errMsg.includes('Failed to connect to any relay')
      updateSession(session.id, {
        connectionError: isRelayError ? undefined : errMsg,
        connectionStatus: isRelayError ? 'relays_unreachable' : 'error'
      })

      stopNip46Session(session.id)

      throw error
    }
  }

  // A request leaves the queue only once its answer was sent, so a failed
  // send can be retried instead of leaving the client waiting forever.
  async function approveRequest(
    requestId: string,
    alwaysAllow: boolean
  ): Promise<boolean> {
    const request = getPendingRequestById(requestId)
    if (!request) {
      return false
    }

    // Never persist a blanket permission for requests that must always be
    // approved explicitly (decryption, sensitive sign_event kinds).
    if (alwaysAllow && canAutoApproveRequest(request.method, request.params)) {
      updatePermission(request.sessionId, request.method, 'always_allow')
    }

    const sent = await answerOnce(requestId, () =>
      respondToRequest(request.sessionId, { ...request, status: 'approved' })
    )
    if (sent) {
      removePendingRequest(requestId)
    }
    return sent
  }

  async function rejectRequest(
    requestId: string,
    alwaysReject: boolean
  ): Promise<boolean> {
    const request = getPendingRequestById(requestId)
    if (!request) {
      return false
    }

    if (alwaysReject) {
      updatePermission(request.sessionId, request.method, 'always_reject')
    }

    const sent = await answerOnce(requestId, () =>
      sendError(request.sessionId, request.id, 'Rejected by user')
    )
    if (sent) {
      removePendingRequest(requestId)
    }
    return sent
  }

  return {
    approveRequest,
    isSessionActive: isNip46SessionActive,
    rejectRequest,
    startSession,
    stopAllSessions: stopAllNip46Sessions,
    stopSession: stopNip46Session
  }
}

export { isNip46SessionActive, shouldRecordNip46Activity }
