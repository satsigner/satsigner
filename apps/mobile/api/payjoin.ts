import {
  createReceiverSession,
  createSenderSession,
  fetchOhttpKeys,
  httpPost,
  isNativeAvailable,
  receiverContributeAndFinalize,
  receiverExtractRequest,
  receiverManualContribute,
  receiverManualFinalize,
  receiverProcessResponse,
  resumeReceiverSession,
  senderExtractRequest,
  senderProcessResponse
} from '@/api/payjoinNative'
import {
  PAYJOIN_BIP77_SEND_TIMEOUT_MS,
  PAYJOIN_BIP78_TIMEOUT_MS,
  PAYJOIN_DEFAULT_PJOS
} from '@/constants/payjoin'
import {
  buildNewSession,
  usePayjoinSessionsStore
} from '@/store/payjoinSessions'
import {
  getPayjoinSessionTtlMs,
  getResolvedPayjoinDirectoryUrl,
  useSettingsStore
} from '@/store/settings'
import {
  type PayjoinSendResult,
  type PayjoinSession,
  type PayjoinWalletCallbacks
} from '@/types/payjoin'
import {
  compactError,
  mailboxFromEndpoint,
  mailboxFromUri,
  payjoinLog,
  payjoinWarn,
  urlHost
} from '@/utils/payjoinLog'
import { hasCustomPayjoinDirectoryUrl } from '@/utils/payjoinMode'
import { getShuffledOhttpRelays } from '@/utils/payjoinRelays'
import {
  isPayjoinSuccess,
  isPayjoinTerminal
} from '@/utils/payjoinSessionStatus'
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
import { extractTransactionIdFromPSBT } from '@/utils/psbt'

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

/** While >0, receiver polls should skip so a same-device send can POST the mailbox. */
let senderPostDepth = 0

function beginSenderPost(): void {
  senderPostDepth += 1
}

function endSenderPost(): void {
  senderPostDepth = Math.max(0, senderPostDepth - 1)
}

function isSenderPostInFlight(): boolean {
  return senderPostDepth > 0
}

const PAYJOIN_FETCH_TIMEOUT_MS = 90_000

function withTimeoutSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  function onParentAbort() {
    controller.abort()
  }
  if (parent) {
    if (parent.aborted) {
      controller.abort()
    } else {
      parent.addEventListener('abort', onParentAbort, { once: true })
    }
  }

  return {
    clear() {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onParentAbort)
    },
    signal: controller.signal
  }
}

function isHttp2PrefaceError(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase()
  return (
    message.includes('settings') ||
    message.includes('preface') ||
    message.includes('http2') ||
    message.includes('http/2')
  )
}

function isSuccessfulHttpStatus(status: number): boolean {
  return status >= 200 && status < 300
}

function assertPayjoinHttpOk(res: HttpResponse, context: string): void {
  if (!isSuccessfulHttpStatus(res.status)) {
    throw new Error(
      `${context}: HTTP ${res.status}${res.body ? ` — ${res.body.slice(0, 160)}` : ''}`
    )
  }
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: Uint8Array | string
    signal?: AbortSignal
  }
): Promise<HttpResponse> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const host = urlHost(url)
  const bodyLen =
    typeof init?.body === 'string'
      ? init.body.length
      : (init?.body?.byteLength ?? 0)
  const timed = withTimeoutSignal(init?.signal, PAYJOIN_FETCH_TIMEOUT_MS)
  const startedAt = Date.now()

  // Prefer JS fetch (non-blocking). Android OkHttp often fails OHTTP relays with
  // HTTP/2 SETTINGS preface errors — fall back to native HTTP/1.1 reqwest only
  // then. Do NOT treat AbortSignal timeouts as preface failures: BIP77 mailbox
  // polls are long-lived and aborting them is normal; retry on the next tick.
  try {
    const response = await fetch(url, {
      body: init?.body as BodyInit | undefined,
      headers: init?.headers,
      method: init?.method ?? 'GET',
      signal: timed.signal
    })
    timed.clear()
    const bytes = new Uint8Array(await response.arrayBuffer())
    const body = new TextDecoder().decode(bytes)
    payjoinLog('http js', {
      bodyLen,
      host,
      method,
      ms: Date.now() - startedAt,
      resBytes: bytes.byteLength,
      status: response.status
    })
    return { body, bytes, status: response.status }
  } catch (error) {
    timed.clear()
    const timedOut = timed.signal.aborted && init?.signal?.aborted !== true
    if (timedOut) {
      payjoinWarn('http js timeout', {
        bodyLen,
        host,
        method,
        ms: Date.now() - startedAt
      })
      throw new Error(
        `payjoin fetch timed out after ${PAYJOIN_FETCH_TIMEOUT_MS}ms`,
        { cause: error }
      )
    }
    if (
      method !== 'POST' ||
      !isHttp2PrefaceError(error) ||
      !isNativeAvailable() ||
      init?.signal?.aborted === true
    ) {
      payjoinWarn('http js failed', {
        bodyLen,
        error: compactError(error),
        host,
        method,
        ms: Date.now() - startedAt
      })
      throw error
    }
    payjoinWarn('http js preface → native', {
      bodyLen,
      error: compactError(error),
      host,
      method,
      ms: Date.now() - startedAt
    })
  }

  const contentType =
    init?.headers?.['Content-Type'] ??
    init?.headers?.['content-type'] ??
    'application/octet-stream'
  const bodyBytes =
    typeof init?.body === 'string'
      ? new TextEncoder().encode(init.body)
      : (init?.body ?? new Uint8Array())
  const nativeStartedAt = Date.now()
  try {
    const native = await httpPost(url, contentType, bodyBytes, 45_000)
    if (init?.signal?.aborted) {
      throw new Error('The operation was aborted')
    }
    if (typeof native.status !== 'number') {
      throw new TypeError('native HTTP returned an invalid response')
    }
    payjoinLog('http native', {
      bodyLen: bodyBytes.byteLength,
      host,
      method,
      ms: Date.now() - nativeStartedAt,
      resBytes: native.body.byteLength,
      status: native.status
    })
    return {
      body: new TextDecoder().decode(native.body),
      bytes: native.body,
      status: native.status
    }
  } catch (nativeError) {
    const message =
      nativeError instanceof Error ? nativeError.message : String(nativeError)
    payjoinWarn('http native failed', {
      bodyLen: bodyBytes.byteLength,
      error: compactError(message),
      host,
      method,
      ms: Date.now() - nativeStartedAt
    })
    throw new Error(`native HTTP/1.1 fallback failed: ${message}`, {
      cause: nativeError
    })
  }
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
 *
 * Concurrent calls for the same mailbox (ioPreview remount / double focus)
 * share one in-flight promise so we do not POST twice and orphan the receiver.
 */
const bip77SendInFlight = new Map<string, Promise<Bip77AsyncSendResult>>()

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
  const parsed = parsePayjoinUri(params.payjoinUri)
  const mailbox =
    parsed.params?.pj?.split('/').pop()?.split('#')[0] ?? params.payjoinUri
  const existing = bip77SendInFlight.get(mailbox)
  if (existing) {
    payjoinLog('sender dedupe in-flight', { mailbox })
    return existing
  }

  const pending = startBip77SendOnce(params, mailbox)
  bip77SendInFlight.set(mailbox, pending)
  try {
    return await pending
  } finally {
    bip77SendInFlight.delete(mailbox)
  }
}

async function startBip77SendOnce(
  params: {
    accountId: string
    payjoinUri: string
    originalPsbtBase64: string
    paymentAmountSats: number
    disableOutputSubstitution: boolean
    callbacks: PayjoinWalletCallbacks
    fetchImpl?: FetchLike
    quickPollMs?: number
  },
  mailbox: string
): Promise<Bip77AsyncSendResult> {
  if (!isNativeAvailable()) {
    return {
      kind: 'fallback',
      originalPsbtBase64: params.originalPsbtBase64,
      reason: 'payjoin native module unavailable'
    }
  }

  const fetchImpl = params.fetchImpl ?? defaultFetch
  const relays = getShuffledOhttpRelays()
  const directoryUrl = getResolvedPayjoinDirectoryUrl()
  let lastError = 'bip77 send failed'
  const parsed = parsePayjoinUri(params.payjoinUri)

  beginSenderPost()
  const startedAt = Date.now()
  payjoinLog('sender start', {
    amountSats: params.paymentAmountSats,
    mailbox,
    relays: relays.length
  })
  try {
    for (const relay of relays) {
      try {
        payjoinLog('sender try relay', { mailbox, relay })
        await fetchOhttpKeys(relay, directoryUrl)
        const created = await createSenderSession({
          disableOutputSubstitution: params.disableOutputSubstitution,
          originalPsbtBase64: params.originalPsbtBase64,
          pjUri: params.payjoinUri
        })

        let { state } = created
        if (created.request) {
          payjoinLog('sender post original', {
            mailbox,
            relay,
            reqBytes: created.request.body.byteLength,
            urlHost: urlHost(created.request.url)
          })
          const res = await fetchImpl(created.request.url, {
            body: created.request.body,
            headers: { 'Content-Type': created.request.contentType },
            method: 'POST'
          })
          assertPayjoinHttpOk(res, 'bip77 sender original post')
          const processed = await senderProcessResponse(state, res.bytes)
          payjoinLog('sender post original result', {
            kind: processed.kind,
            mailbox,
            relay,
            status: res.status
          })
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
              payjoinLog('sender got proposal immediately', {
                mailbox,
                ms: Date.now() - startedAt
              })
              return { kind: 'proposal', result }
            }
            payjoinWarn('sender proposal finalize failed', {
              mailbox,
              reason: result.ok ? result.reason : result.error
            })
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
        let quickPolls = 0
        while (Date.now() < quickDeadline) {
          quickPolls += 1
          const { request, state: nextState } =
            await senderExtractRequest(state)
          state = nextState
          const res = await fetchImpl(request.url, {
            body: request.body,
            headers: { 'Content-Type': request.contentType },
            method: 'POST'
          })
          assertPayjoinHttpOk(res, 'bip77 sender poll')
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
              payjoinLog('sender got proposal after quick poll', {
                mailbox,
                ms: Date.now() - startedAt,
                quickPolls
              })
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
        payjoinLog('sender waiting for receiver', {
          mailbox,
          ms: Date.now() - startedAt,
          quickPolls,
          relay,
          sessionId: session.id
        })
        return { kind: 'waiting', session }
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError
        payjoinWarn('sender relay failed', {
          error: compactError(lastError),
          mailbox,
          relay
        })
      }
    }
  } finally {
    endSenderPost()
  }

  payjoinWarn('sender fallback', {
    mailbox,
    ms: Date.now() - startedAt,
    reason: lastError
  })
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
  const originalPsbtBase64 = params.session.originalPsbtBase64 ?? ''
  if (isPayjoinTerminal(params.session.status)) {
    if (
      isPayjoinSuccess(params.session.status) &&
      params.session.payjoinPsbtBase64
    ) {
      return {
        kind: 'proposal',
        result: {
          ok: true,
          protocol: 'v2',
          psbtBase64: params.session.payjoinPsbtBase64,
          usedPayjoin: true
        }
      }
    }
    return {
      kind: 'fallback',
      originalPsbtBase64,
      reason: `sender session already ${params.session.status}`
    }
  }

  if (!params.session.nativeState || !isNativeAvailable()) {
    return {
      kind: 'fallback',
      originalPsbtBase64,
      reason: 'payjoin sender session missing native state'
    }
  }

  const fetchImpl = params.fetchImpl ?? defaultFetch
  let state = params.session.nativeState
  let lastError = 'still waiting for receiver'
  const deadline = Date.now() + (params.timeoutMs ?? 15_000)
  const mailbox = mailboxFromEndpoint(params.session.pjEndpoint)
  const startedAt = Date.now()
  let polls = 0

  function isDeadNativeSession(message: string): boolean {
    // Durable nativeState can replay after process death. "not found" means
    // a legacy id-only blob or a corrupt/expired event log.
    return /sender session not found/i.test(message)
  }

  function fallbackDeadSession(reason: string): Bip77AsyncSendResult {
    usePayjoinSessionsStore
      .getState()
      .updateSessionStatus(params.session.id, 'fallback', {
        error: reason,
        nativeState: undefined
      })
    payjoinWarn('sender resume unrecoverable — falling back', {
      mailbox,
      reason: compactError(reason),
      sessionId: params.session.id
    })
    return { kind: 'fallback', originalPsbtBase64, reason }
  }

  payjoinLog('sender resume poll', {
    mailbox,
    sessionId: params.session.id,
    timeoutMs: params.timeoutMs ?? 15_000
  })

  usePayjoinSessionsStore
    .getState()
    .updateSessionStatus(params.session.id, 'negotiating')

  try {
    while (Date.now() < deadline) {
      const live = usePayjoinSessionsStore
        .getState()
        .getSession(params.session.id)
      if (live && isPayjoinTerminal(live.status)) {
        return {
          kind: 'fallback',
          originalPsbtBase64,
          reason: `sender session became ${live.status}`
        }
      }
      polls += 1
      const { request, state: nextState } = await senderExtractRequest(state)
      state = nextState
      const res = await fetchImpl(request.url, {
        body: request.body,
        headers: { 'Content-Type': request.contentType },
        method: 'POST'
      })
      assertPayjoinHttpOk(res, 'bip77 sender resume poll')
      const processed = await senderProcessResponse(state, res.bytes)
      payjoinLog('sender resume tick', {
        kind: processed.kind,
        mailbox,
        polls,
        status: res.status
      })
      if (processed.kind === 'proposal') {
        try {
          const result = await finalizeSenderProposal(
            processed.psbtBase64,
            originalPsbtBase64,
            params.paymentAmountSats,
            params.disableOutputSubstitution,
            params.callbacks,
            'v2'
          )
          if (result.ok && result.usedPayjoin) {
            usePayjoinSessionsStore
              .getState()
              .updateSessionStatus(params.session.id, 'completed', {
                nativeState: undefined,
                payjoinPsbtBase64: result.psbtBase64
              })
            payjoinLog('sender resume got proposal', {
              mailbox,
              ms: Date.now() - startedAt,
              polls
            })
            return { kind: 'proposal', result }
          }
          return {
            kind: 'fallback',
            originalPsbtBase64,
            reason: result.ok ? result.reason : result.error
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'finalize proposal failed'
          payjoinWarn('sender finalize threw — falling back', {
            error: compactError(message),
            mailbox,
            polls
          })
          return {
            kind: 'fallback',
            originalPsbtBase64,
            reason: message
          }
        }
      }
      if (processed.kind === 'error') {
        lastError = processed.message
        if (isDeadNativeSession(lastError)) {
          return fallbackDeadSession(lastError)
        }
        break
      }
      state = processed.state
      await sleep(500)
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError
    payjoinWarn('sender resume error', {
      error: compactError(lastError),
      mailbox,
      polls
    })
    if (isDeadNativeSession(lastError)) {
      return fallbackDeadSession(lastError)
    }
  }

  const updated: PayjoinSession = {
    ...params.session,
    error: lastError,
    nativeState: state,
    status: 'waiting',
    updatedAt: Date.now()
  }
  usePayjoinSessionsStore.getState().upsertSession(updated)
  payjoinLog('sender resume still waiting', {
    mailbox,
    ms: Date.now() - startedAt,
    polls,
    reason: compactError(lastError)
  })
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
    payjoinUri: params.payjoinUri,
    paymentAmountSats: params.paymentAmountSats,
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

type ManualReceiveResult =
  | { ok: true; proposalPsbtBase64: string; contributedOutpoint: string }
  | { ok: false; error: string }

/**
 * Manual (offline) receiver: ingest the sender's original PSBT out of band,
 * contribute one input, sign it, and return the Payjoin proposal PSBT to hand
 * back to the sender. No directory / OHTTP calls are made.
 */
async function processManualOriginalPsbt(params: {
  originalPsbtBase64: string
  receiveAddress: string
  disableOutputSubstitution: boolean
  ownedScriptsHex: string[]
  seenOutpoints: string[]
  callbacks: PayjoinWalletCallbacks
}): Promise<ManualReceiveResult> {
  if (!isNativeAvailable()) {
    return { error: 'payjoin native module unavailable', ok: false }
  }

  try {
    const candidates = await params.callbacks.listCandidateOutpoints()
    const chosen =
      candidates.find(
        (c) => !params.callbacks.hasSeenInput(`${c.txid}:${c.vout}`)
      ) ?? candidates[0]
    if (!chosen) {
      return { error: 'no utxos to contribute', ok: false }
    }
    const outpoint = `${chosen.txid}:${chosen.vout}`
    // Rejects an original PSBT that already spends our own coins, which is what
    // stops a sender from getting the receiver to fund their payment.
    const ownedOutpoints = candidates.map((c) => `${c.txid}:${c.vout}`)

    const contribute = await receiverManualContribute(
      params.originalPsbtBase64,
      params.receiveAddress,
      params.disableOutputSubstitution,
      chosen,
      params.ownedScriptsHex,
      params.seenOutpoints,
      ownedOutpoints
    )
    const signed = await params.callbacks.signPsbt(
      contribute.provisionalPsbtBase64
    )
    const { proposalPsbtBase64 } = await receiverManualFinalize(
      contribute.provisionalState,
      signed
    )

    await params.callbacks.markInputSeen(outpoint)
    return { contributedOutpoint: outpoint, ok: true, proposalPsbtBase64 }
  } catch (error) {
    return { error: compactError(error), ok: false }
  }
}

/**
 * Manual (offline) sender: validate the receiver's proposal against the original
 * PSBT, then sign it. No directory / OHTTP calls are made.
 */
function applyManualSenderProposal(params: {
  proposalPsbtBase64: string
  originalPsbtBase64: string
  paymentAmountSats: number
  disableOutputSubstitution: boolean
  callbacks: PayjoinWalletCallbacks
}): Promise<PayjoinSendResult> {
  return finalizeSenderProposal(
    params.proposalPsbtBase64,
    params.originalPsbtBase64,
    params.paymentAmountSats,
    params.disableOutputSubstitution,
    params.callbacks,
    'v1'
  )
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
 *
 * - Missing nativeState: remove the JS session so Receive can mint cleanly.
 * - Native map miss (Metro reload / process death): keep the JS session.
 *   Deleting here used to mint a new pj= every time the user reopened Receive
 *   to check status, orphaning any sender already waiting on the old mailbox.
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
    return null
  }
}

/**
 * Soft resume: restore the in-memory handle from persisted nativeState without
 * deleting the JS session. Used when a poll fails with "session not found"
 * after Metro reload — keep the same pj= so a waiting sender is not orphaned.
 */
async function resumePersistedReceiverSession(
  session: PayjoinSession
): Promise<boolean> {
  if (!session.nativeState || !isNativeAvailable()) {
    return false
  }
  try {
    await resumeReceiverSession(session.nativeState)
    return true
  } catch {
    return false
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
  const directoryUrl = getResolvedPayjoinDirectoryUrl()
  const expireSeconds = Math.floor(
    (params.ttlMs ?? getPayjoinSessionTtlMs()) / 1000
  )

  let pjUri: string
  let nativeState: string | undefined
  let protocol: 'v1' | 'v2' = 'v2'
  let createError: string | undefined

  if (isNativeAvailable()) {
    let lastError: unknown
    for (const relay of relays) {
      try {
        payjoinLog('receiver create try relay', {
          address: params.address.slice(0, 12),
          relay
        })
        await fetchOhttpKeys(relay, directoryUrl)
        const handle = await createReceiverSession({
          address: params.address,
          directoryUrl,
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
        payjoinLog('receiver mailbox ready', {
          mailbox: mailboxFromUri(pjUri),
          relay,
          sessionNativeId: handle.id
        })
        break
      } catch (error) {
        lastError = error
        payjoinWarn('receiver create relay failed', {
          error: compactError(error),
          relay
        })
      }
    }
    if (!nativeState) {
      createError =
        lastError instanceof Error
          ? lastError.message
          : 'failed to create payjoin session'
      // Custom directory must not silently fall back to the default host.
      const customDirectory = useSettingsStore.getState().payjoinDirectoryUrl
      if (hasCustomPayjoinDirectoryUrl(customDirectory)) {
        throw new Error(createError)
      }
      const placeholderEndpoint = `${directoryUrl}/unavailable#RK1-pending`
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
    const placeholderEndpoint = `${directoryUrl}/unlinked#RK1-pending`
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
    // 'ready' = mailbox created (URI has pj=); poll moves it to 'waiting'.
    status: nativeState ? 'ready' : 'error',
    ttlMs: params.ttlMs,
    uri: pjUri!
  })

  usePayjoinSessionsStore.getState().upsertSession(session)
  payjoinLog('receiver session stored', {
    error: createError ? compactError(createError) : undefined,
    mailbox: mailboxFromEndpoint(session.pjEndpoint),
    sessionId: session.id,
    status: session.status
  })
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
    payjoinWarn('receiver poll skipped', {
      hasNative: isNativeAvailable(),
      hasState: !!params.session.nativeState,
      mailbox: mailboxFromEndpoint(params.session.pjEndpoint),
      sessionId: params.session.id
    })
    return { session: params.session }
  }

  const mailbox = mailboxFromEndpoint(params.session.pjEndpoint)
  const startedAt = Date.now()
  const fetchImpl = params.fetchImpl ?? defaultFetch
  const { request, state } = await receiverExtractRequest(
    params.session.nativeState
  )
  const res = await fetchImpl(request.url, {
    body: request.body,
    headers: { 'Content-Type': request.contentType },
    method: 'POST'
  })
  assertPayjoinHttpOk(res, 'bip77 receiver poll')
  const processed = await receiverProcessResponse(state, res.bytes)
  payjoinLog('receiver poll result', {
    kind: processed.kind,
    mailbox,
    ms: Date.now() - startedAt,
    prevStatus: params.session.status,
    resBytes: res.bytes.byteLength,
    sessionId: params.session.id,
    status: res.status
  })

  if (processed.kind === 'pending') {
    const now = Date.now()
    // Never downgrade a session that already holds the sender original —
    // overwriting proposal_received → waiting made the UI poll forever.
    if (params.session.originalPsbtBase64) {
      const updated = {
        ...params.session,
        expiresAt: Math.max(
          params.session.expiresAt,
          now + getPayjoinSessionTtlMs()
        ),
        nativeState: processed.state,
        status: 'proposal_received' as const,
        updatedAt: now
      }
      usePayjoinSessionsStore.getState().upsertSession(updated)
      return {
        originalPsbtBase64: params.session.originalPsbtBase64,
        session: updated
      }
    }
    const updated = {
      ...params.session,
      // Keep the mailbox alive in the app while the user is still polling.
      expiresAt: Math.max(
        params.session.expiresAt,
        now + getPayjoinSessionTtlMs()
      ),
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

  // Prefer inputs never contributed. If every unspent candidate is already
  // marked seen, reuse one — still being listed means the prior Payjoin did
  // not spend it (abandoned / failed POST), so hard-rejecting left wallets
  // stuck on "Negotiating…" forever.
  let chosen = candidates.find(
    (c) => !store.hasSeenInput(`${c.txid}:${c.vout}`)
  )
  if (!chosen && candidates.length > 0) {
    const [firstCandidate] = candidates
    chosen = firstCandidate
    payjoinWarn('receiver finalize reusing unspent seen input', {
      outpoint: `${chosen.txid}:${chosen.vout}`,
      sessionId: params.session.id
    })
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

  const fetchImpl = params.fetchImpl ?? defaultFetch

  payjoinLog('receiver finalize contribute', {
    mailbox: mailboxFromEndpoint(params.session.pjEndpoint),
    outpoint,
    sessionId: params.session.id
  })

  // First pass builds the provisional Payjoin PSBT (empty signature). The
  // ownership and replay checks reject a sender that tries to spend the
  // receiver's own coins or probe its UTXO set with a replayed input.
  const walletChecks = {
    isInputOwned: (scriptHex: string) => {
      const owned = params.callbacks.isScriptOwned(scriptHex)
      return typeof owned === 'boolean' ? owned : false
    },
    isInputSeen: (outpoint: string) => {
      const seen = params.callbacks.hasSeenInput(outpoint)
      return typeof seen === 'boolean' ? seen : false
    }
  }
  const prepared = await receiverContributeAndFinalize(
    params.session.nativeState,
    chosen,
    '',
    walletChecks
  )
  const signed = await params.callbacks.signPsbt(prepared.psbtBase64)
  const {
    request,
    state: finalizedState,
    psbtBase64
  } = await receiverContributeAndFinalize(prepared.state, chosen, signed)

  // Never mark complete until the payjoin proposal is posted back — otherwise
  // the receive UI celebrates while the sender keeps "waiting for receiver".
  if (!request.url) {
    const updated = {
      ...params.session,
      error: 'missing directory post after finalize',
      nativeState: finalizedState,
      payjoinPsbtBase64: psbtBase64,
      proposalPsbtBase64: psbtBase64,
      status: 'error' as const,
      updatedAt: Date.now()
    }
    store.upsertSession(updated)
    return updated
  }

  const res = await fetchImpl(request.url, {
    body: request.body,
    headers: { 'Content-Type': request.contentType },
    method: 'POST'
  })
  assertPayjoinHttpOk(res, 'bip77 receiver proposal post')

  store.markInputSeen(outpoint)

  let txid: string | undefined
  try {
    txid = extractTransactionIdFromPSBT(psbtBase64) ?? undefined
  } catch (error) {
    payjoinWarn('receiver finalize txid extract failed', {
      error: compactError(error),
      sessionId: params.session.id
    })
  }
  const now = Date.now()
  const updated: PayjoinSession = {
    ...params.session,
    error: undefined,
    // Keep the card alive past mailbox TTL until broadcast sync or discard.
    expiresAt: Math.max(
      params.session.expiresAt,
      now + getPayjoinSessionTtlMs()
    ),
    // Drop native handle after the proposal is posted — keeps MMKV small and
    // avoids retaining the receiver entry once the sender can poll it.
    nativeState: undefined,
    payjoinPsbtBase64: psbtBase64,
    proposalPsbtBase64: psbtBase64,
    status: 'completed',
    txid,
    updatedAt: now
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
  applyManualSenderProposal,
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession,
  defaultFetch,
  finalizeReceiverPayjoin,
  isSenderPostInFlight,
  pollBip77Send,
  pollReceiverSession,
  postBip78OriginalPsbt,
  processDirectoryBridgedBip78Proposal,
  processManualOriginalPsbt,
  resumePersistedReceiverSession,
  sendBip78,
  sendPayjoin,
  startBip77Send,
  tryResumeReceiverSession
}

export type {
  Bip77AsyncSendResult,
  FetchLike,
  HttpResponse,
  ManualReceiveResult
}
