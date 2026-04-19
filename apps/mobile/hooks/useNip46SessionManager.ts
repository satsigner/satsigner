import { Nip46BunkerService } from '@/api/nip46BunkerService'
import { NIP46_SUPPORTED_METHODS } from '@/constants/nip46'
import { useNip46Store } from '@/store/nip46'
import type {
  Nip46Method,
  Nip46Request,
  Nip46Session
} from '@/types/models/Nip46'
import { buildNip46ResponsePayload } from '@/utils/nip46'
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

// Module-level maps shared across all hook instances
const servicesMap = new Map<string, Nip46BunkerService>()
const secretKeysMap = new Map<string, Uint8Array>()

async function fireAndForget(promise: Promise<unknown>): Promise<void> {
  try {
    await promise
  } catch {
    // intentionally swallowed
  }
}

function isValidMethod(method: string): method is Nip46Method {
  return (NIP46_SUPPORTED_METHODS as string[]).includes(method)
}

function executeHandler(
  method: Nip46Method,
  params: string[],
  signerPubkeyHex: string,
  signerSecretKey: Uint8Array,
  expectedSecret: string | undefined
): string {
  switch (method) {
    case 'ping':
      return handlePing()
    case 'get_public_key':
      return handleGetPublicKey(signerPubkeyHex)
    case 'connect':
      return handleConnect(params, expectedSecret, signerPubkeyHex)
    case 'sign_event':
      return handleSignEvent(params[0], signerSecretKey)
    case 'nip04_encrypt':
      return handleNip04Encrypt(params[0], params[1], signerSecretKey)
    case 'nip04_decrypt':
      return handleNip04Decrypt(params[0], params[1], signerSecretKey)
    case 'nip44_encrypt':
      return handleNip44Encrypt(params[0], params[1], signerSecretKey)
    case 'nip44_decrypt':
      return handleNip44Decrypt(params[0], params[1], signerSecretKey)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
}

function getSessionById(sessionId: string): Nip46Session | undefined {
  return useNip46Store.getState().sessions.find((s) => s.id === sessionId)
}

async function respondToRequest(
  sessionId: string,
  request: Nip46Request
): Promise<void> {
  const session = getSessionById(sessionId)
  const service = servicesMap.get(sessionId)
  const secretKey = secretKeysMap.get(sessionId)

  if (!session || !service || !secretKey) {
    return
  }

  const signerPubkeyHex = getPubKeyHexFromNpub(session.signerNpub)
  if (!signerPubkeyHex) {
    return
  }

  try {
    const result = executeHandler(
      request.method,
      request.params,
      signerPubkeyHex,
      secretKey,
      session.secret
    )
    const payload = buildNip46ResponsePayload(request.id, result, null)
    await service.sendResponse(session.clientPubkey, secretKey, payload)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const payload = buildNip46ResponsePayload(request.id, null, errorMsg)
    await service.sendResponse(session.clientPubkey, secretKey, payload)
  }
}

async function sendError(
  sessionId: string,
  requestId: string,
  errorMessage: string
): Promise<void> {
  const session = getSessionById(sessionId)
  const service = servicesMap.get(sessionId)
  const secretKey = secretKeysMap.get(sessionId)

  if (!session || !service || !secretKey) {
    return
  }

  const payload = buildNip46ResponsePayload(requestId, null, errorMessage)
  await service.sendResponse(session.clientPubkey, secretKey, payload)
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

    const service = new Nip46BunkerService()
    await service.connect(session.relays)

    servicesMap.set(session.id, service)
    secretKeysMap.set(session.id, secretKey)

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
        updateSession(session.id, { lastActiveAt: Date.now() })

        if (permission === 'always_allow') {
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
      session.secret ?? '',
      null
    )
    await service.sendResponse(session.clientPubkey, secretKey, connectPayload)
  }

  async function approveRequest(
    requestId: string,
    alwaysAllow: boolean
  ): Promise<void> {
    const request = useNip46Store
      .getState()
      .pendingRequests.find((r) => r.id === requestId)
    if (!request) {
      return
    }

    removePendingRequest(requestId)

    if (alwaysAllow) {
      updatePermission(request.sessionId, request.method, 'always_allow')
    }

    await respondToRequest(request.sessionId, {
      ...request,
      status: 'approved'
    })
  }

  async function rejectRequest(
    requestId: string,
    alwaysReject: boolean
  ): Promise<void> {
    const request = useNip46Store
      .getState()
      .pendingRequests.find((r) => r.id === requestId)
    if (!request) {
      return
    }

    removePendingRequest(requestId)

    if (alwaysReject) {
      updatePermission(request.sessionId, request.method, 'always_reject')
    }

    await sendError(request.sessionId, request.id, 'Rejected by user')
  }

  function stopSession(sessionId: string): void {
    const service = servicesMap.get(sessionId)
    if (service) {
      service.disconnect()
      servicesMap.delete(sessionId)
    }
    secretKeysMap.delete(sessionId)
  }

  function stopAllSessions(): void {
    for (const [sessionId, service] of servicesMap) {
      service.disconnect()
      secretKeysMap.delete(sessionId)
    }
    servicesMap.clear()
  }

  function isSessionActive(sessionId: string): boolean {
    const service = servicesMap.get(sessionId)
    return service?.isConnected() ?? false
  }

  return {
    approveRequest,
    isSessionActive,
    rejectRequest,
    startSession,
    stopAllSessions,
    stopSession
  }
}
