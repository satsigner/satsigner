import {
  createReceiverSession,
  createSenderSession,
  fetchOhttpKeys,
  isNativeAvailable,
  receiverContributeAndFinalize,
  receiverExtractRequest,
  receiverProcessResponse,
  resumeReceiverSession,
  senderExtractRequest,
  senderProcessResponse
} from 'react-native-payjoin'

import {
  PAYJOIN_BIP77_SEND_TIMEOUT_MS,
  PAYJOIN_BIP78_TIMEOUT_MS,
  PAYJOIN_DEFAULT_PJOS,
  PAYJOIN_DIRECTORY_URL,
  PAYJOIN_SESSION_TTL_MS
} from '@/constants/payjoin'
import {
  buildNewSession,
  usePayjoinSessionsStore
} from '@/store/payjoinSessions'
import {
  type PayjoinSendResult,
  type PayjoinSession,
  type PayjoinWalletCallbacks
} from '@/types/payjoin'
import { getShuffledOhttpRelays } from '@/utils/payjoinRelays'
import {
  appendParamsToPayjoinUri,
  buildPayjoinUri,
  detectEndpointKind,
  parsePayjoinUri
} from '@/utils/payjoinUri'
import {
  isSelfTransfer,
  parseBip78ErrorBody,
  validatePayjoinProposal
} from '@/utils/payjoinValidate'

type HttpResponse = {
  status: number
  body: string
  bytes: Uint8Array
}

type FetchLike = (
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: Uint8Array | string
    signal?: AbortSignal
  }
) => Promise<HttpResponse>

async function defaultFetch(
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: Uint8Array | string
    signal?: AbortSignal
  }
): Promise<HttpResponse> {
  const response = await fetch(url, {
    body: init?.body as BodyInit | undefined,
    headers: init?.headers,
    method: init?.method ?? 'GET',
    signal: init?.signal
  })
  const bytes = new Uint8Array(await response.arrayBuffer())
  const body = new TextDecoder().decode(bytes)
  return { body, bytes, status: response.status }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function postBip78OriginalPsbt(params: {
  endpoint: string
  psbtBase64: string
  timeoutMs?: number
  fetchImpl?: FetchLike
}): Promise<
  { ok: true; proposalBase64: string } | { ok: false; error: string }
> {
  const fetchImpl = params.fetchImpl ?? defaultFetch
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    params.timeoutMs ?? PAYJOIN_BIP78_TIMEOUT_MS
  )
  try {
    const res = await fetchImpl(params.endpoint, {
      body: params.psbtBase64,
      headers: {
        Accept: 'text/plain',
        'Content-Type': 'text/plain'
      },
      method: 'POST',
      signal: controller.signal
    })
    if (res.status < 200 || res.status >= 300) {
      const err = parseBip78ErrorBody(res.body)
      return {
        error: `${err.errorCode}: ${err.message}`,
        ok: false
      }
    }
    const trimmed = res.body.trim()
    if (trimmed.startsWith('{')) {
      const err = parseBip78ErrorBody(trimmed)
      return { error: `${err.errorCode}: ${err.message}`, ok: false }
    }
    if (!trimmed.startsWith('cHNidP')) {
      return { error: 'response is not a PSBT', ok: false }
    }
    return { ok: true, proposalBase64: trimmed }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'bip78 request failed'
    return { error: message, ok: false }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendPayjoin(params: {
  payjoinUri: string
  originalPsbtBase64: string
  paymentAmountSats: number
  outputScriptsHex: string[]
  callbacks: PayjoinWalletCallbacks
  fetchImpl?: FetchLike
  timeoutMs?: number
  accountId?: string
}): Promise<PayjoinSendResult> {
  const parsed = parsePayjoinUri(params.payjoinUri)
  if (!parsed.isValid || !parsed.params) {
    return {
      error: parsed.error ?? 'invalid payjoin uri',
      fallbackAllowed: true,
      ok: false,
      originalPsbtBase64: params.originalPsbtBase64
    }
  }

  if (
    isSelfTransfer({
      isScriptOwned: (scriptHex) => {
        const result = params.callbacks.isScriptOwned(scriptHex)
        return typeof result === 'boolean' ? result : false
      },
      outputScriptsHex: params.outputScriptsHex
    })
  ) {
    return {
      ok: true,
      originalPsbtBase64: params.originalPsbtBase64,
      reason: 'self-transfer',
      usedPayjoin: false
    }
  }

  const endpointKind =
    parsed.endpointKind ?? detectEndpointKind(parsed.params.pj)
  const disableOutputSubstitution =
    (parsed.params.pjos ?? PAYJOIN_DEFAULT_PJOS) === 0

  if (endpointKind === 'bip78') {
    return await sendBip78({
      callbacks: params.callbacks,
      disableOutputSubstitution,
      endpoint: parsed.params.pj,
      fetchImpl: params.fetchImpl,
      originalPsbtBase64: params.originalPsbtBase64,
      payjoinUri: params.payjoinUri,
      paymentAmountSats: params.paymentAmountSats,
      timeoutMs: params.timeoutMs
    })
  }

  return await sendBip77({
    accountId: params.accountId,
    callbacks: params.callbacks,
    disableOutputSubstitution,
    fetchImpl: params.fetchImpl,
    originalPsbtBase64: params.originalPsbtBase64,
    payjoinUri: params.payjoinUri,
    paymentAmountSats: params.paymentAmountSats,
    timeoutMs: params.timeoutMs ?? PAYJOIN_BIP77_SEND_TIMEOUT_MS
  })
}

async function sendBip78(params: {
  endpoint: string
  originalPsbtBase64: string
  paymentAmountSats: number
  disableOutputSubstitution: boolean
  callbacks: PayjoinWalletCallbacks
  fetchImpl?: FetchLike
  timeoutMs?: number
  payjoinUri?: string
}): Promise<PayjoinSendResult> {
  // Prefer native PDK when available; otherwise HTTP + TS validation.
  if (isNativeAvailable()) {
    try {
      const session = await createSenderSession({
        disableOutputSubstitution: params.disableOutputSubstitution,
        originalPsbtBase64: params.originalPsbtBase64,
        pjUri:
          params.payjoinUri ?? `bitcoin:bc1qplaceholder?pj=${params.endpoint}`
      })
      if (session.request) {
        const fetchImpl = params.fetchImpl ?? defaultFetch
        const res = await fetchImpl(session.request.url, {
          body: session.request.body,
          headers: { 'Content-Type': session.request.contentType },
          method: 'POST'
        })
        if (
          res.status < 200 ||
          res.status >= 300 ||
          res.body.trim().startsWith('{')
        ) {
          const err = parseBip78ErrorBody(
            res.body || '{"errorCode":"unavailable"}'
          )
          return {
            ok: true,
            originalPsbtBase64: params.originalPsbtBase64,
            reason: `${err.errorCode}: ${err.message}`,
            usedPayjoin: false
          }
        }
        const processed = await senderProcessResponse(session.state, res.bytes)
        if (
          processed.kind === 'proposal' &&
          processed.psbtBase64.startsWith('cHNidP')
        ) {
          const validation = validatePayjoinProposal({
            disableOutputSubstitution: params.disableOutputSubstitution,
            isScriptOwned: (scriptHex) => {
              const result = params.callbacks.isScriptOwned(scriptHex)
              return typeof result === 'boolean' ? result : false
            },
            originalPsbtBase64: params.originalPsbtBase64,
            paymentAmountSats: params.paymentAmountSats,
            proposalPsbtBase64: processed.psbtBase64
          })
          if (!validation.ok) {
            return {
              ok: true,
              originalPsbtBase64: params.originalPsbtBase64,
              reason: validation.reason,
              usedPayjoin: false
            }
          }
          const signed = await params.callbacks.signPsbt(processed.psbtBase64)
          return {
            ok: true,
            protocol: 'v1',
            psbtBase64: signed,
            usedPayjoin: true
          }
        }
        if (processed.kind === 'error') {
          return {
            ok: true,
            originalPsbtBase64: params.originalPsbtBase64,
            reason: processed.message,
            usedPayjoin: false
          }
        }
      }
    } catch {
      // Fall through to pure HTTP path.
    }
  }

  const response = await postBip78OriginalPsbt({
    endpoint: params.endpoint,
    fetchImpl: params.fetchImpl,
    psbtBase64: params.originalPsbtBase64,
    timeoutMs: params.timeoutMs
  })

  if (!response.ok) {
    return {
      ok: true,
      originalPsbtBase64: params.originalPsbtBase64,
      reason: response.error,
      usedPayjoin: false
    }
  }

  const validation = validatePayjoinProposal({
    disableOutputSubstitution: params.disableOutputSubstitution,
    isScriptOwned: (scriptHex) => {
      const result = params.callbacks.isScriptOwned(scriptHex)
      return typeof result === 'boolean' ? result : false
    },
    originalPsbtBase64: params.originalPsbtBase64,
    paymentAmountSats: params.paymentAmountSats,
    proposalPsbtBase64: response.proposalBase64
  })

  if (!validation.ok) {
    return {
      ok: true,
      originalPsbtBase64: params.originalPsbtBase64,
      reason: validation.reason,
      usedPayjoin: false
    }
  }

  try {
    const signed = await params.callbacks.signPsbt(response.proposalBase64)
    return {
      ok: true,
      protocol: 'v1',
      psbtBase64: signed,
      usedPayjoin: true
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'sign failed',
      fallbackAllowed: true,
      ok: false,
      originalPsbtBase64: params.originalPsbtBase64
    }
  }
}

type Bip77AsyncSendResult =
  | {
      kind: 'proposal'
      result: Extract<PayjoinSendResult, { ok: true; usedPayjoin: true }>
    }
  | {
      kind: 'waiting'
      session: PayjoinSession
    }
  | {
      kind: 'fallback'
      reason: string
      originalPsbtBase64: string
    }

/**
 * Post the original PSBT to the BIP77 mailbox, then return quickly.
 * If the receiver is already polling, a proposal may arrive immediately;
 * otherwise persists sender nativeState so the user can open Receive and
 * come back to pollBip77Send.
 */
async function startBip77Send(params: {
  accountId: string
  payjoinUri: string
  originalPsbtBase64: string
  paymentAmountSats: number
  disableOutputSubstitution: boolean
  callbacks: PayjoinWalletCallbacks
  fetchImpl?: FetchLike
  /** Brief wait for an already-online receiver before returning "waiting". */
  quickPollMs?: number
}): Promise<Bip77AsyncSendResult> {
  if (!isNativeAvailable()) {
    return {
      kind: 'fallback',
      originalPsbtBase64: params.originalPsbtBase64,
      reason: 'payjoin native module unavailable'
    }
  }

  const fetchImpl = params.fetchImpl ?? defaultFetch
  const relays = getShuffledOhttpRelays()
  let lastError = 'bip77 send failed'
  const parsed = parsePayjoinUri(params.payjoinUri)

  for (const relay of relays) {
    try {
      await fetchOhttpKeys(relay, PAYJOIN_DIRECTORY_URL)
      const created = await createSenderSession({
        disableOutputSubstitution: params.disableOutputSubstitution,
        originalPsbtBase64: params.originalPsbtBase64,
        pjUri: params.payjoinUri
      })

      let { state } = created
      if (created.request) {
        const res = await fetchImpl(created.request.url, {
          body: created.request.body,
          headers: { 'Content-Type': created.request.contentType },
          method: 'POST'
        })
        const processed = await senderProcessResponse(state, res.bytes)
        if (processed.kind === 'error') {
          lastError = processed.message
          continue
        }
        if (processed.kind === 'proposal') {
          const result = await finalizeSenderProposal(
            processed.psbtBase64,
            params.originalPsbtBase64,
            params.paymentAmountSats,
            params.disableOutputSubstitution,
            params.callbacks,
            'v2'
          )
          if (result.ok && result.usedPayjoin) {
            return { kind: 'proposal', result }
          }
          return {
            kind: 'fallback',
            originalPsbtBase64: params.originalPsbtBase64,
            reason: result.ok ? result.reason : result.error
          }
        }
        state = processed.state
      }

      // Short poll in case the receiver is already online.
      const quickDeadline = Date.now() + (params.quickPollMs ?? 3_000)
      while (Date.now() < quickDeadline) {
        const { request, state: nextState } = await senderExtractRequest(state)
        state = nextState
        const res = await fetchImpl(request.url, {
          body: request.body,
          headers: { 'Content-Type': request.contentType },
          method: 'POST'
        })
        const processed = await senderProcessResponse(state, res.bytes)
        if (processed.kind === 'proposal') {
          const result = await finalizeSenderProposal(
            processed.psbtBase64,
            params.originalPsbtBase64,
            params.paymentAmountSats,
            params.disableOutputSubstitution,
            params.callbacks,
            'v2'
          )
          if (result.ok && result.usedPayjoin) {
            return { kind: 'proposal', result }
          }
          return {
            kind: 'fallback',
            originalPsbtBase64: params.originalPsbtBase64,
            reason: result.ok ? result.reason : result.error
          }
        }
        if (processed.kind === 'error') {
          lastError = processed.message
          break
        }
        state = processed.state
        await sleep(400)
      }

      const session = buildNewSession({
        accountId: params.accountId,
        address: parsed.params?.address ?? '',
        amountSats: params.paymentAmountSats,
        nativeState: state,
        originalPsbtBase64: params.originalPsbtBase64,
        pjEndpoint: parsed.params?.pj ?? '',
        pjos: parsed.params?.pjos ?? PAYJOIN_DEFAULT_PJOS,
        protocol: 'v2',
        role: 'sender',
        status: 'waiting',
        uri: params.payjoinUri
      })
      usePayjoinSessionsStore.getState().upsertSession(session)
      console.log('[payjoin] startBip77Send waiting for receiver', {
        sessionId: session.id
      })
      return { kind: 'waiting', session }
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
    }
  }

  return {
    kind: 'fallback',
    originalPsbtBase64: params.originalPsbtBase64,
    reason: lastError
  }
}

/** Resume a persisted BIP77 sender session (after visiting Receive). */
async function pollBip77Send(params: {
  session: PayjoinSession
  paymentAmountSats: number
  disableOutputSubstitution: boolean
  callbacks: PayjoinWalletCallbacks
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<Bip77AsyncSendResult> {
  if (!params.session.nativeState || !isNativeAvailable()) {
    return {
      kind: 'fallback',
      originalPsbtBase64: params.session.originalPsbtBase64 ?? '',
      reason: 'payjoin sender session missing native state'
    }
  }

  const fetchImpl = params.fetchImpl ?? defaultFetch
  const originalPsbtBase64 = params.session.originalPsbtBase64 ?? ''
  let state = params.session.nativeState
  let lastError = 'still waiting for receiver'
  const deadline = Date.now() + (params.timeoutMs ?? 15_000)

  usePayjoinSessionsStore
    .getState()
    .updateSessionStatus(params.session.id, 'negotiating')

  try {
    while (Date.now() < deadline) {
      const { request, state: nextState } = await senderExtractRequest(state)
      state = nextState
      const res = await fetchImpl(request.url, {
        body: request.body,
        headers: { 'Content-Type': request.contentType },
        method: 'POST'
      })
      const processed = await senderProcessResponse(state, res.bytes)
      if (processed.kind === 'proposal') {
        const result = await finalizeSenderProposal(
          processed.psbtBase64,
          originalPsbtBase64,
          params.paymentAmountSats,
          params.disableOutputSubstitution,
          params.callbacks,
          'v2'
        )
        if (result.ok && result.usedPayjoin) {
          usePayjoinSessionsStore.getState().updateSessionStatus(
            params.session.id,
            'completed',
            { nativeState: undefined, payjoinPsbtBase64: result.psbtBase64 }
          )
          return { kind: 'proposal', result }
        }
        return {
          kind: 'fallback',
          originalPsbtBase64,
          reason: result.ok ? result.reason : result.error
        }
      }
      if (processed.kind === 'error') {
        lastError = processed.message
        break
      }
      state = processed.state
      await sleep(500)
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError
  }

  const updated: PayjoinSession = {
    ...params.session,
    error: lastError,
    nativeState: state,
    status: 'waiting',
    updatedAt: Date.now()
  }
  usePayjoinSessionsStore.getState().upsertSession(updated)
  console.log('[payjoin] pollBip77Send still waiting', { reason: lastError })
  return { kind: 'waiting', session: updated }
}

async function sendBip77(params: {
  payjoinUri: string
  originalPsbtBase64: string
  paymentAmountSats: number
  disableOutputSubstitution: boolean
  callbacks: PayjoinWalletCallbacks
  fetchImpl?: FetchLike
  timeoutMs: number
  accountId?: string
}): Promise<PayjoinSendResult> {
  const started = await startBip77Send({
    accountId: params.accountId ?? 'unknown',
    callbacks: params.callbacks,
    disableOutputSubstitution: params.disableOutputSubstitution,
    fetchImpl: params.fetchImpl,
    originalPsbtBase64: params.originalPsbtBase64,
    paymentAmountSats: params.paymentAmountSats,
    payjoinUri: params.payjoinUri,
    quickPollMs: Math.min(params.timeoutMs, 5_000)
  })

  if (started.kind === 'proposal') {
    return started.result
  }
  if (started.kind === 'fallback') {
    return {
      ok: true,
      originalPsbtBase64: started.originalPsbtBase64,
      reason: started.reason,
      usedPayjoin: false
    }
  }

  const polled = await pollBip77Send({
    callbacks: params.callbacks,
    disableOutputSubstitution: params.disableOutputSubstitution,
    fetchImpl: params.fetchImpl,
    paymentAmountSats: params.paymentAmountSats,
    session: started.session,
    timeoutMs: params.timeoutMs
  })

  if (polled.kind === 'proposal') {
    return polled.result
  }
  if (polled.kind === 'fallback') {
    return {
      ok: true,
      originalPsbtBase64: polled.originalPsbtBase64,
      reason: polled.reason,
      usedPayjoin: false
    }
  }

  return {
    ok: true,
    originalPsbtBase64: params.originalPsbtBase64,
    reason: polled.session.error ?? 'receiver did not respond in time',
    usedPayjoin: false
  }
}

async function finalizeSenderProposal(
  proposalPsbtBase64: string,
  originalPsbtBase64: string,
  paymentAmountSats: number,
  disableOutputSubstitution: boolean,
  callbacks: PayjoinWalletCallbacks,
  protocol: 'v1' | 'v2'
): Promise<PayjoinSendResult> {
  const validation = validatePayjoinProposal({
    disableOutputSubstitution,
    isScriptOwned: (scriptHex) => {
      const result = callbacks.isScriptOwned(scriptHex)
      return typeof result === 'boolean' ? result : false
    },
    originalPsbtBase64,
    paymentAmountSats,
    proposalPsbtBase64
  })

  if (!validation.ok) {
    return {
      ok: true,
      originalPsbtBase64,
      reason: validation.reason,
      usedPayjoin: false
    }
  }

  const signed = await callbacks.signPsbt(proposalPsbtBase64)
  return {
    ok: true,
    protocol,
    psbtBase64: signed,
    usedPayjoin: true
  }
}

function clearReceiverSessionsForAccount(accountId: string) {
  const store = usePayjoinSessionsStore.getState()
  for (const session of store.sessions) {
    if (session.accountId === accountId && session.role === 'receiver') {
      store.removeSession(session.id)
    }
  }
}

/**
 * Resume a persisted receiver session only if Rust still has it in memory.
 * After Metro reload / process death, nativeState is stale — callers recreate.
 * Always removes the JS session when resume is impossible so we do not keep
 * polling a dead mailbox id.
 */
async function tryResumeReceiverSession(
  session: PayjoinSession
): Promise<PayjoinSession | null> {
  if (!session.nativeState || !isNativeAvailable()) {
    usePayjoinSessionsStore.getState().removeSession(session.id)
    return null
  }
  try {
    await resumeReceiverSession(session.nativeState)
    return session
  } catch {
    usePayjoinSessionsStore.getState().removeSession(session.id)
    return null
  }
}

async function createReceivePayjoinSession(params: {
  accountId: string
  address: string
  amountSats?: number
  label?: string
  ttlMs?: number
}): Promise<PayjoinSession> {
  const relays = getShuffledOhttpRelays()
  const expireSeconds = Math.floor(
    (params.ttlMs ?? PAYJOIN_SESSION_TTL_MS) / 1000
  )

  let pjUri: string
  let nativeState: string | undefined
  let protocol: 'v1' | 'v2' = 'v2'
  let createError: string | undefined

  if (isNativeAvailable()) {
    let lastError: unknown
    for (const relay of relays) {
      try {
        await fetchOhttpKeys(relay, PAYJOIN_DIRECTORY_URL)
        const handle = await createReceiverSession({
          address: params.address,
          directoryUrl: PAYJOIN_DIRECTORY_URL,
          expireSeconds,
          ohttpRelayUrl: relay
        })
        pjUri = appendParamsToPayjoinUri(handle.pjUri, {
          amountSats: params.amountSats,
          label: params.label,
          pjos: PAYJOIN_DEFAULT_PJOS
        })
        nativeState = handle.state
        lastError = undefined
        break
      } catch (error) {
        lastError = error
      }
    }
    if (!nativeState) {
      createError =
        lastError instanceof Error
          ? lastError.message
          : 'failed to create payjoin session'
      const placeholderEndpoint = `${PAYJOIN_DIRECTORY_URL}/unavailable#RK1-pending`
      pjUri = buildPayjoinUri({
        address: params.address,
        amountSats: params.amountSats,
        label: params.label,
        pjEndpoint: placeholderEndpoint,
        pjos: PAYJOIN_DEFAULT_PJOS
      })
    }
  } else {
    // Offline / unlinked: still produce a structurally valid BIP21+pj URI
    // so QR/copy flows and unit tests work. Negotiation requires native PDK.
    const placeholderEndpoint = `${PAYJOIN_DIRECTORY_URL}/unlinked#RK1-pending`
    pjUri = buildPayjoinUri({
      address: params.address,
      amountSats: params.amountSats,
      label: params.label,
      pjEndpoint: placeholderEndpoint,
      pjos: PAYJOIN_DEFAULT_PJOS
    })
    protocol = 'v2'
    createError = 'native module unavailable'
  }

  const parsed = parsePayjoinUri(pjUri!)
  const session = buildNewSession({
    accountId: params.accountId,
    address: params.address,
    amountSats: params.amountSats,
    error: createError,
    label: params.label,
    nativeState,
    pjEndpoint: parsed.params?.pj ?? '',
    pjos: PAYJOIN_DEFAULT_PJOS,
    protocol,
    role: 'receiver',
    status: nativeState ? 'ready' : 'error',
    ttlMs: params.ttlMs,
    uri: pjUri!
  })

  usePayjoinSessionsStore.getState().upsertSession(session)
  return session
}

/**
 * Poll a receiver session once. Returns updated session and optional
 * original PSBT from the sender (to contribute / finalize).
 */
async function pollReceiverSession(params: {
  session: PayjoinSession
  callbacks: PayjoinWalletCallbacks
  fetchImpl?: FetchLike
}): Promise<{
  session: PayjoinSession
  originalPsbtBase64?: string
}> {
  if (!params.session.nativeState || !isNativeAvailable()) {
    return { session: params.session }
  }

  const fetchImpl = params.fetchImpl ?? defaultFetch
  const { request, state } = await receiverExtractRequest(
    params.session.nativeState
  )
  const res = await fetchImpl(request.url, {
    body: request.body,
    headers: { 'Content-Type': request.contentType },
    method: 'POST'
  })
  const processed = await receiverProcessResponse(state, res.bytes)

  if (processed.kind === 'pending') {
    const now = Date.now()
    const updated = {
      ...params.session,
      // Keep the mailbox alive in the app while the user is still polling.
      expiresAt: Math.max(params.session.expiresAt, now + PAYJOIN_SESSION_TTL_MS),
      nativeState: processed.state,
      status: 'waiting' as const,
      updatedAt: now
    }
    usePayjoinSessionsStore.getState().upsertSession(updated)
    return { session: updated }
  }

  if (processed.kind === 'proposal') {
    const updated = {
      ...params.session,
      nativeState: processed.state,
      originalPsbtBase64: processed.psbtBase64,
      status: 'proposal_received' as const,
      updatedAt: Date.now()
    }
    usePayjoinSessionsStore.getState().upsertSession(updated)
    return { originalPsbtBase64: processed.psbtBase64, session: updated }
  }

  if (processed.kind === 'error') {
    const updated = {
      ...params.session,
      error: processed.message,
      status: 'error' as const,
      updatedAt: Date.now()
    }
    usePayjoinSessionsStore.getState().upsertSession(updated)
    return { session: updated }
  }

  return { session: params.session }
}

async function finalizeReceiverPayjoin(params: {
  session: PayjoinSession
  callbacks: PayjoinWalletCallbacks
  fetchImpl?: FetchLike
}): Promise<PayjoinSession> {
  if (!params.session.nativeState || !params.session.originalPsbtBase64) {
    return {
      ...params.session,
      error: 'missing proposal state',
      status: 'error'
    }
  }

  const candidates = await params.callbacks.listCandidateOutpoints()
  const store = usePayjoinSessionsStore.getState()

  let chosen = candidates.find(
    (c) => !store.hasSeenInput(`${c.txid}:${c.vout}`)
  )
  if (!chosen && candidates.length > 0) {
    const [firstCandidate] = candidates
    chosen = firstCandidate
  }
  if (!chosen) {
    const updated = {
      ...params.session,
      error: 'no utxos to contribute',
      status: 'error' as const
    }
    store.upsertSession(updated)
    return updated
  }

  const outpoint = `${chosen.txid}:${chosen.vout}`
  if (store.hasSeenInput(outpoint)) {
    const updated = {
      ...params.session,
      error: 'input seen before',
      status: 'error' as const
    }
    store.upsertSession(updated)
    return updated
  }

  const fetchImpl = params.fetchImpl ?? defaultFetch

  // First pass builds the provisional Payjoin PSBT (empty signature).
  const prepared = await receiverContributeAndFinalize(
    params.session.nativeState,
    chosen,
    ''
  )
  const signed = await params.callbacks.signPsbt(prepared.psbtBase64)
  const { request, state, psbtBase64 } = await receiverContributeAndFinalize(
    prepared.state,
    chosen,
    signed
  )

  if (request.url) {
    await fetchImpl(request.url, {
      body: request.body,
      headers: { 'Content-Type': request.contentType },
      method: 'POST'
    })
  }

  store.markInputSeen(outpoint)

  const updated: PayjoinSession = {
    ...params.session,
    nativeState: state,
    payjoinPsbtBase64: psbtBase64,
    proposalPsbtBase64: psbtBase64,
    status: 'completed',
    updatedAt: Date.now()
  }
  store.upsertSession(updated)
  return updated
}

/**
 * Directory-bridged BIP78 receive: when a BIP78 sender posts an original PSBT
 * into the BIP77 mailbox, the receiver processes it like a v2 proposal.
 */
async function processDirectoryBridgedBip78Proposal(params: {
  session: PayjoinSession
  originalPsbtBase64: string
  callbacks: PayjoinWalletCallbacks
  fetchImpl?: FetchLike
}): Promise<PayjoinSession> {
  const withProposal = {
    ...params.session,
    originalPsbtBase64: params.originalPsbtBase64,
    status: 'proposal_received' as const,
    updatedAt: Date.now()
  }
  usePayjoinSessionsStore.getState().upsertSession(withProposal)
  return await finalizeReceiverPayjoin({
    callbacks: params.callbacks,
    fetchImpl: params.fetchImpl,
    session: withProposal
  })
}

export {
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession,
  defaultFetch,
  finalizeReceiverPayjoin,
  pollBip77Send,
  pollReceiverSession,
  postBip78OriginalPsbt,
  processDirectoryBridgedBip78Proposal,
  sendBip78,
  sendPayjoin,
  startBip77Send,
  tryResumeReceiverSession
}

export type { Bip77AsyncSendResult, FetchLike, HttpResponse }
