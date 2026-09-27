/**
 * Adapter from the app-facing Payjoin facade onto the `react-native-payjoin`
 * typestate API.
 *
 * The app persists an opaque `nativeState` string in MMKV and replays it after
 * process death, while the upstream package exposes live PDK typestate objects
 * whose OHTTP contexts cannot cross a restart. This module bridges the two:
 *
 * - `nativeState` is base64 JSON holding the session id, the PDK event log, and
 *   the few fields the log does not carry (relay, pj URI, receive script).
 * - Live typestates and their pending OHTTP context are held in a module-level
 *   registry keyed by session id, rebuilt from the event log on a miss.
 *
 * The event log entries are the same JSON strings the previous Rust facade
 * persisted, so existing stored sessions replay unchanged.
 */
/* eslint-disable require-await -- the upstream typestate calls are synchronous, but `@/api/payjoin` consumes this facade as async */
import { Buffer } from 'buffer'

import { hex } from '@scure/base'
import {
  Initialized,
  InputPair,
  type InputPairLike,
  type JsonReceiverSessionPersister,
  type JsonSenderSessionPersister,
  type PayjoinProposalLike,
  type PjUriLike,
  PollingForProposal,
  type PollingForProposalLike,
  ReceiveSession_Tags,
  ReceiverBuilder,
  replayReceiverEventLog,
  replaySenderEventLog,
  SendSession_Tags,
  SenderBuilder,
  type ClientResponseLike,
  type InitializedLike,
  type ProvisionalProposalLike,
  type Request,
  type SendSession,
  type ReceiveSession,
  UncheckedOriginalPayload,
  type UncheckedOriginalPayloadLike,
  type WithReplyKeyLike,
  fetchOhttpKeys as nativeFetchOhttpKeys,
  mergeFinalizedProposalInputs,
  parsePjUri,
  receiverManualContribute as nativeReceiverManualContribute,
  receiverManualFinalize as nativeReceiverManualFinalize
} from 'react-native-payjoin'

import {
  PAYJOIN_BOARD_TXID_UNSTABLE_ERROR,
  PAYJOIN_MIN_SESSION_EXPIRE_SECONDS,
  PAYJOIN_MISSING_RECEIVE_SCRIPT_ERROR,
  PAYJOIN_NATIVE_HTTP_TIMEOUT_MS,
  PAYJOIN_NATIVE_PROBE_URI,
  PAYJOIN_OHTTP_KEYS_PROBE_OK
} from '@/constants/payjoin'
import type {
  HttpResponse,
  PayjoinNativeRequest,
  ProcessResult,
  ReceiverSessionHandle,
  ReceiverSessionInit,
  SenderSessionHandle,
  SenderSessionInit
} from '@/types/payjoin'
import { isStringArray } from '@/utils/array'
import { isRecord } from '@/utils/object'
import { payjoinWarn } from '@/utils/payjoinLog'
import { extractPayjoinOriginalPsbt } from '@/utils/payjoinOriginalPsbt'
import {
  unwrapInitializedTransition,
  unwrapPollingProposalPsbt,
  unwrapPollingStasis
} from '@/utils/payjoinTransition'

type ReceiverLive =
  | { kind: 'initialized'; receiver: InitializedLike }
  | { kind: 'unchecked'; receiver: UncheckedOriginalPayloadLike }
  | { kind: 'provisional'; receiver: ProvisionalProposalLike }

type ReceiverEntry = {
  live: ReceiverLive
  events: string[]
  ohttpRelay: string
  pjUri: string
  receiveScriptHex: string
  pendingOhttp?: ClientResponseLike
}

type SenderLive =
  | { kind: 'withReplyKey'; sender: WithReplyKeyLike }
  | { kind: 'polling'; sender: PollingForProposalLike }

type SenderEntry = {
  live: SenderLive
  events: string[]
  ohttpRelay: string
  protocol: 'v1' | 'v2'
  pendingOhttp?: ClientResponseLike
}

const receivers = new Map<string, ReceiverEntry>()
const senders = new Map<string, SenderEntry>()

/**
 * The relay is chosen by the caller immediately before creating a session, but
 * `SenderBuilder` derives its own endpoint from the URI, so the relay has to be
 * carried across the `fetchOhttpKeys` probe the way the Rust facade did.
 */
let nextSenderOhttpRelay: string | undefined

/**
 * Collects PDK events for one transition, then appends them to the entry log.
 * `save()` writes through this, so a fresh persister per call yields only the
 * new events.
 */
function createPersister(): JsonReceiverSessionPersister &
  JsonSenderSessionPersister & { drain: () => string[] } {
  const collected: string[] = []
  return {
    close() {
      // Session lifetime is owned by the registry, not by a single transition.
    },
    drain() {
      return collected.splice(0)
    },
    load() {
      return [...collected]
    },
    save(event: string) {
      collected.push(event)
    }
  }
}

function replayPersister(
  events: string[]
): JsonReceiverSessionPersister & JsonSenderSessionPersister {
  const log = [...events]
  return {
    close() {
      // No-op: replay never mutates the stored log.
    },
    load() {
      return [...log]
    },
    save(event: string) {
      log.push(event)
    }
  }
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8')
}

function randomId(): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `pj_${Date.now().toString(36)}_${rand}`
}

type ReceiverStatePayload = {
  id: string
  events: string[]
  ohttp_relay: string
  pj_uri: string
  receive_script_hex: string
  protocol: 'v2'
  role: 'receiver'
}

function encodeReceiverState(id: string, entry: ReceiverEntry): string {
  const payload: ReceiverStatePayload = {
    events: entry.events,
    id,
    ohttp_relay: entry.ohttpRelay,
    pj_uri: entry.pjUri,
    protocol: 'v2',
    receive_script_hex: entry.receiveScriptHex,
    role: 'receiver'
  }
  return encodeBase64(JSON.stringify(payload))
}

function decodeReceiverState(state: string): ReceiverStatePayload {
  const value: unknown = JSON.parse(decodeBase64(state))
  if (!isRecord(value)) {
    throw new Error('invalid state encoding')
  }
  if (typeof value.id !== 'string') {
    throw new TypeError('state missing id')
  }
  return {
    events: isStringArray(value.events) ? value.events : [],
    id: value.id,
    ohttp_relay: typeof value.ohttp_relay === 'string' ? value.ohttp_relay : '',
    pj_uri: typeof value.pj_uri === 'string' ? value.pj_uri : '',
    protocol: 'v2',
    receive_script_hex:
      typeof value.receive_script_hex === 'string'
        ? value.receive_script_hex
        : '',
    role: 'receiver'
  }
}

type SenderStatePayload = {
  id: string
  events: string[]
  ohttp_relay: string
  protocol: 'v1' | 'v2'
  role: 'sender'
}

function encodeSenderState(id: string, entry: SenderEntry): string {
  const payload: SenderStatePayload = {
    events: entry.events,
    id,
    ohttp_relay: entry.ohttpRelay,
    protocol: entry.protocol,
    role: 'sender'
  }
  return encodeBase64(JSON.stringify(payload))
}

function decodeSenderState(state: string): SenderStatePayload {
  const value: unknown = JSON.parse(decodeBase64(state))
  if (!isRecord(value)) {
    throw new Error('invalid state encoding')
  }
  if (typeof value.id !== 'string') {
    throw new TypeError('state missing id')
  }
  return {
    events: isStringArray(value.events) ? value.events : [],
    id: value.id,
    ohttp_relay: typeof value.ohttp_relay === 'string' ? value.ohttp_relay : '',
    protocol: value.protocol === 'v1' ? 'v1' : 'v2',
    role: 'sender'
  }
}

function toUint8Array(body: ArrayBuffer | Uint8Array): Uint8Array {
  if (body instanceof Uint8Array) {
    return body
  }
  return new Uint8Array(body)
}

function toArrayBuffer(body: Uint8Array): ArrayBuffer {
  return new Uint8Array(body).buffer
}

function adaptRequest(request: Request): PayjoinNativeRequest {
  return {
    body: toUint8Array(request.body),
    contentType: request.contentType,
    url: request.url
  }
}

const EMPTY_REQUEST: PayjoinNativeRequest = {
  body: new Uint8Array(),
  contentType: 'application/octet-stream',
  url: ''
}

/** UniFFI throws structured error objects; surface their message as an Error. */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  if (error && typeof error === 'object' && 'inner' in error) {
    const { inner } = error
    if (Array.isArray(inner) && typeof inner[0] === 'string') {
      return new Error(inner[0])
    }
  }
  if (error && typeof error === 'object' && 'toString' in error) {
    return new Error(String(error))
  }
  return new Error(String(error))
}

/**
 * Upstream exposes no availability flag, so this probes a real binding: parsing
 * a URI crosses the JSI boundary into Rust. A missing or stale native library
 * throws here, which is exactly the condition callers need to detect before
 * offering Payjoin.
 */
function isNativeAvailable(): boolean {
  try {
    parsePjUri(PAYJOIN_NATIVE_PROBE_URI)
    return true
  } catch (error) {
    return !isNativeBindingFailure(error)
  }
}

/**
 * Distinguishes "the native module is missing" from "that URI is not payjoin
 * capable". Only the former means Payjoin is unavailable — a parse rejection
 * still proves the bindings are loaded and callable.
 */
function isNativeBindingFailure(error: unknown): boolean {
  if (error instanceof TypeError || error instanceof ReferenceError) {
    return true
  }
  const message = error instanceof Error ? error.message : String(error)
  return NATIVE_FAILURE_PATTERN.test(message)
}

const NATIVE_FAILURE_PATTERN =
  /native|turbomodule|not a function|undefined is not|uniffi|checksum/i

/**
 * Probes relay reachability before a session is created. Callers discard the
 * value; the upstream keys object is not serializable, so a sentinel is
 * returned to preserve the previous `Promise<string>` contract.
 */
async function fetchOhttpKeys(
  relayUrl: string,
  directoryUrl: string
): Promise<string> {
  try {
    await nativeFetchOhttpKeys(relayUrl, directoryUrl)
    nextSenderOhttpRelay = relayUrl
    return PAYJOIN_OHTTP_KEYS_PROBE_OK
  } catch (error) {
    throw toError(error)
  }
}

async function httpPost(
  url: string,
  contentType: string,
  body: Uint8Array,
  timeoutMs = PAYJOIN_NATIVE_HTTP_TIMEOUT_MS
): Promise<HttpResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      body: toArrayBuffer(body),
      headers: { 'Content-Type': contentType },
      method: 'POST',
      signal: controller.signal
    })
    const bytes = new Uint8Array(await response.arrayBuffer())
    return { body: bytes, status: response.status }
  } catch (error) {
    throw toError(error)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Transition outcomes arrive untyped from `@/utils/payjoinTransition`; these
 * confirm the unwrapped value is the live UniFFI typestate object before the
 * registry holds on to it.
 */
function isInitialized(value: unknown): value is Initialized {
  return isRecord(value) && Initialized.instanceOf(value)
}

function isUncheckedOriginalPayload(
  value: unknown
): value is UncheckedOriginalPayload {
  return isRecord(value) && UncheckedOriginalPayload.instanceOf(value)
}

function isPollingForProposal(value: unknown): value is PollingForProposal {
  return isRecord(value) && PollingForProposal.instanceOf(value)
}

/**
 * Only the three states the app drives are resumable. Anything else — a
 * terminal, errored, or mid-check session — cannot be re-entered from a
 * persisted log, so the caller mints a fresh session instead.
 */
function receiverLiveFromSession(session: ReceiveSession): ReceiverLive {
  if (session.tag === ReceiveSession_Tags.Initialized) {
    return { kind: 'initialized', receiver: session.inner.inner }
  }
  if (session.tag === ReceiveSession_Tags.UncheckedOriginalPayload) {
    return { kind: 'unchecked', receiver: session.inner.inner }
  }
  if (session.tag === ReceiveSession_Tags.ProvisionalProposal) {
    return { kind: 'provisional', receiver: session.inner.inner }
  }
  throw new Error('unsupported receiver resume state after replay')
}

function rehydrateReceiver(payload: ReceiverStatePayload): ReceiverEntry {
  if (payload.events.length === 0) {
    throw new Error('receiver session not found in memory; recreate it')
  }
  const replayed = replayReceiverEventLog(replayPersister(payload.events))
  return {
    events: payload.events,
    live: receiverLiveFromSession(replayed.state()),
    ohttpRelay: payload.ohttp_relay,
    pjUri: payload.pj_uri,
    receiveScriptHex: payload.receive_script_hex
  }
}

function ensureReceiver(state: string): { id: string; entry: ReceiverEntry } {
  const payload = decodeReceiverState(state)
  const existing = receivers.get(payload.id)
  if (existing) {
    return { entry: existing, id: payload.id }
  }
  const entry = rehydrateReceiver(payload)
  receivers.set(payload.id, entry)
  return { entry, id: payload.id }
}

async function createReceiverSession(
  init: ReceiverSessionInit
): Promise<ReceiverSessionHandle> {
  try {
    if (!init.receiveScriptHex) {
      throw new Error(PAYJOIN_MISSING_RECEIVE_SCRIPT_ERROR)
    }
    const ohttpKeys = await nativeFetchOhttpKeys(
      init.ohttpRelayUrl,
      init.directoryUrl
    )
    const expireSeconds = Math.max(
      init.expireSeconds,
      PAYJOIN_MIN_SESSION_EXPIRE_SECONDS
    )
    const builder = new ReceiverBuilder(
      init.address,
      init.directoryUrl,
      ohttpKeys
    ).withExpiration(BigInt(expireSeconds))

    const persister = createPersister()
    const receiver = builder.build().save(persister)
    const pjUri = receiver.pjUri().asString()
    const id = randomId()
    const entry: ReceiverEntry = {
      events: persister.drain(),
      live: { kind: 'initialized', receiver },
      ohttpRelay: init.ohttpRelayUrl,
      pjUri,
      receiveScriptHex: init.receiveScriptHex
    }
    receivers.set(id, entry)
    return { id, pjUri, state: encodeReceiverState(id, entry) }
  } catch (error) {
    throw toError(error)
  }
}

async function resumeReceiverSession(
  state: string
): Promise<ReceiverSessionHandle> {
  try {
    const { id, entry } = ensureReceiver(state)
    return {
      id,
      pjUri: entry.pjUri,
      state: encodeReceiverState(id, entry)
    }
  } catch (error) {
    throw toError(error)
  }
}

async function receiverExtractRequest(
  state: string
): Promise<{ request: PayjoinNativeRequest; state: string }> {
  try {
    const { id, entry } = ensureReceiver(state)
    if (entry.live.kind !== 'initialized') {
      throw new Error(
        'receiver already has a proposal; finalize instead of polling'
      )
    }
    const { request, clientResponse } = entry.live.receiver.createPollRequest(
      entry.ohttpRelay
    )
    entry.pendingOhttp = clientResponse
    return {
      request: adaptRequest(request),
      state: encodeReceiverState(id, entry)
    }
  } catch (error) {
    throw toError(error)
  }
}

async function receiverProcessResponse(
  state: string,
  body: Uint8Array
): Promise<ProcessResult> {
  const { id, entry } = ensureReceiver(state)
  const ohttpCtx = entry.pendingOhttp
  if (!ohttpCtx) {
    throw new Error('missing ohttp context; call extract first')
  }
  entry.pendingOhttp = undefined

  if (entry.live.kind !== 'initialized') {
    return { kind: 'error', message: 'receiver already has unchecked proposal' }
  }

  // PDK consumes the receiver on `processResponse`. A transient directory error
  // must not drop the mailbox handle, or the next poll mints a new QR and
  // orphans the sender — so the Initialized handle is kept on failure.
  const initialized = entry.live.receiver
  const persister = createPersister()
  try {
    const outcome = initialized
      .processResponse(toArrayBuffer(body), ohttpCtx)
      .save(persister)
    entry.events.push(...persister.drain())

    const next = unwrapInitializedTransition(outcome)
    if (next.kind !== 'progress') {
      // Stasis consumes the previous handle; only the returned Initialized
      // object is valid for the next poll.
      entry.live = {
        kind: 'initialized',
        receiver:
          next.kind === 'stasis' && isInitialized(next.value)
            ? next.value
            : initialized
      }
      return {
        kind: 'pending',
        state: encodeReceiverState(id, entry)
      }
    }

    if (!isUncheckedOriginalPayload(next.value)) {
      throw new Error('receiver progressed without an original proposal')
    }
    entry.live = { kind: 'unchecked', receiver: next.value }
    // PDK may persist the original as hex or a byte array, not `cHNidP`
    // base64. Finalize uses the live Unchecked handle; the string is optional.
    const psbtBase64 = extractPayjoinOriginalPsbt(entry.events) ?? ''
    if (!psbtBase64) {
      payjoinWarn('receiver original not in event log — using native handle', {
        eventCount: entry.events.length
      })
    }
    return {
      kind: 'proposal',
      psbtBase64,
      state: encodeReceiverState(id, entry)
    }
  } catch (error) {
    entry.live = { kind: 'initialized', receiver: initialized }
    entry.pendingOhttp = undefined
    return { kind: 'error', message: toError(error).message }
  }
}

type ReceiverInput = {
  txid: string
  vout: number
  value: number
  scriptHex: string
}

function buildInputPair(input: ReceiverInput): InputPairLike {
  const scriptPubkey = toArrayBuffer(hex.decode(input.scriptHex))
  return new InputPair(
    {
      previousOutput: { txid: input.txid, vout: input.vout },
      scriptSig: new ArrayBuffer(0),
      sequence: 0xff_ff_ff_ff,
      witness: []
    },
    { witnessUtxo: { scriptPubkey, valueSat: BigInt(input.value) } },
    undefined
  )
}

/**
 * Ownership and replay predicates the receiver runs against the sender's
 * original PSBT inputs, keyed by outpoint (`txid:vout`). Mirrors the data the
 * manual path hands to `receiverManualContribute`, but as callbacks the JS
 * typestate can invoke directly.
 */
type ReceiverWalletChecks = {
  isOutpointOwned: (outpoint: string) => boolean
  isOutpointSeen: (outpoint: string) => boolean
}

/**
 * Runs the receiver checks and contributes one input, or — when a signed PSBT
 * is supplied — finalizes the provisional proposal and builds the directory
 * POST. Two-phase so the wallet can sign in between. `checks` is only consumed
 * on the contribute pass; the finalize pass leaves it undefined.
 */
async function receiverContributeAndFinalize(
  state: string,
  input: ReceiverInput,
  signedPsbtBase64: string,
  checks?: ReceiverWalletChecks
): Promise<{
  request: PayjoinNativeRequest
  state: string
  psbtBase64: string
}> {
  try {
    const { id, entry } = ensureReceiver(state)

    if (signedPsbtBase64) {
      return finalizeReceiver(id, entry, signedPsbtBase64)
    }
    return contributeReceiver(id, entry, input, checks)
  } catch (error) {
    throw toError(error)
  }
}

function finalizeReceiver(
  id: string,
  entry: ReceiverEntry,
  signedPsbtBase64: string
): { request: PayjoinNativeRequest; state: string; psbtBase64: string } {
  if (entry.live.kind !== 'provisional') {
    throw new Error(
      'expected provisional proposal; call contribute with empty signed first'
    )
  }
  const nextState = encodeReceiverState(id, entry)
  const persister = createPersister()
  const proposal: PayjoinProposalLike = entry.live.receiver
    .finalizeProposal({
      callback(cleared: string) {
        return mergeFinalizedProposalInputs(cleared, signedPsbtBase64)
      }
    })
    .save(persister)
  entry.events.push(...persister.drain())

  const psbtBase64 = proposal.psbt()
  const { request } = proposal.createPostRequest(entry.ohttpRelay)
  // Proposal is consumed into the directory POST; the caller must deliver the
  // request before treating the receive as complete.
  receivers.delete(id)
  return { psbtBase64, request: adaptRequest(request), state: nextState }
}

/**
 * Runs the receiver checks against the sender's original payload and commits
 * the receiver outputs, advancing the typestate to WantsInputs. Shared by the
 * contributing path and the zero-input board path.
 */
function advanceReceiverToWantsInputs(
  receiver: UncheckedOriginalPayloadLike,
  receiveScriptHex: string,
  persister: ReturnType<typeof createPersister>,
  checks?: ReceiverWalletChecks
) {
  // A session persisted before the receive script was recorded can never match
  // an output and would loop on PDK's "Missing payment." forever. Fail with a
  // terminal error instead so the caller mints a fresh mailbox.
  if (!receiveScriptHex) {
    throw new Error(PAYJOIN_MISSING_RECEIVE_SCRIPT_ERROR)
  }
  const isOutpointOwned = checks?.isOutpointOwned ?? (() => false)
  const isOutpointSeen = checks?.isOutpointSeen ?? (() => false)

  const maybeOwned = receiver.assumeInteractiveReceiver().save(persister)
  const maybeSeen = maybeOwned
    .checkInputsNotOwned({
      callback: (outpoint: { txid: string; vout: number }) =>
        isOutpointOwned(`${outpoint.txid}:${outpoint.vout}`)
    })
    .save(persister)
  const outputsUnknown = maybeSeen
    .checkNoInputsSeenBefore({
      callback: (outpoint: { txid: string; vout: number }) =>
        isOutpointSeen(`${outpoint.txid}:${outpoint.vout}`)
    })
    .save(persister)
  const wantsOutputs = outputsUnknown
    .identifyReceiverOutputs({
      callback: (script: ArrayBuffer) =>
        hex.encode(new Uint8Array(script)) === receiveScriptHex
    })
    .save(persister)

  return wantsOutputs.commitOutputs().save(persister)
}

function contributeReceiver(
  id: string,
  entry: ReceiverEntry,
  input: ReceiverInput,
  checks?: ReceiverWalletChecks
): { request: PayjoinNativeRequest; state: string; psbtBase64: string } {
  if (entry.live.kind !== 'unchecked') {
    throw new Error('no original proposal to contribute to; poll first')
  }
  const persister = createPersister()
  const wantsInputs = advanceReceiverToWantsInputs(
    entry.live.receiver,
    entry.receiveScriptHex,
    persister,
    checks
  )
  const wantsFeeRange = wantsInputs
    .contributeInputs([buildInputPair(input)])
    .commitInputs()
    .save(persister)
  const provisional = wantsFeeRange
    .applyFeeRange(undefined, undefined)
    .save(persister)

  entry.events.push(...persister.drain())
  entry.live = { kind: 'provisional', receiver: provisional }

  return {
    psbtBase64: provisional.psbtToSign(),
    request: EMPTY_REQUEST,
    state: encodeReceiverState(id, entry)
  }
}

/**
 * Zero-input receiver finalize for board payjoins: runs the receiver checks,
 * commits the outputs with no input contribution, finalizes the proposal
 * (the receiver has nothing to sign) and builds the directory POST in one
 * pass. Refuses senders whose final signatures would change the txid — bark
 * registers the pending board under the unsigned proposal's txid, so an
 * unstable txid would strand the board funds.
 */
async function receiverFinalizeWithoutInputs(
  state: string,
  checks?: ReceiverWalletChecks
): Promise<{
  request: PayjoinNativeRequest
  state: string
  psbtBase64: string
}> {
  try {
    const { id, entry } = ensureReceiver(state)
    if (entry.live.kind !== 'unchecked') {
      throw new Error('no original proposal to finalize; poll first')
    }
    const persister = createPersister()
    const wantsInputs = advanceReceiverToWantsInputs(
      entry.live.receiver,
      entry.receiveScriptHex,
      persister,
      checks
    )
    if (!wantsInputs.proposalTxidIsStable()) {
      throw new Error(PAYJOIN_BOARD_TXID_UNSTABLE_ERROR)
    }
    const wantsFeeRange = wantsInputs.commitInputs().save(persister)
    const provisional = wantsFeeRange
      .applyFeeRange(undefined, undefined)
      .save(persister)
    const proposal: PayjoinProposalLike = provisional
      .finalizeProposal({
        callback(cleared: string) {
          return cleared
        }
      })
      .save(persister)
    entry.events.push(...persister.drain())

    const psbtBase64 = proposal.psbt()
    const { request } = proposal.createPostRequest(entry.ohttpRelay)
    // Proposal is consumed into the directory POST; the caller must deliver
    // the request before treating the board receive as complete.
    receivers.delete(id)
    return {
      psbtBase64,
      request: adaptRequest(request),
      state: encodeReceiverState(id, entry)
    }
  } catch (error) {
    throw toError(error)
  }
}

/**
 * Fully offline receiver contribution: runs the receiver checks against
 * wallet-supplied ownership data and returns a provisional PSBT plus a resumable
 * state, with no directory or relay involvement.
 */
async function receiverManualContribute(
  originalPsbtBase64: string,
  receiveAddress: string,
  disableOutputSubstitution: boolean,
  input: ReceiverInput,
  ownedScriptsHex: string[],
  seenOutpoints: string[],
  ownedOutpoints: string[] = []
): Promise<{ provisionalPsbtBase64: string; provisionalState: string }> {
  try {
    const result = nativeReceiverManualContribute(
      originalPsbtBase64,
      receiveAddress,
      disableOutputSubstitution,
      {
        scriptHex: input.scriptHex,
        txid: input.txid,
        value: BigInt(input.value),
        vout: input.vout
      },
      ownedScriptsHex,
      ownedOutpoints,
      seenOutpoints
    )
    return {
      provisionalPsbtBase64: result.provisionalPsbtBase64,
      provisionalState: result.provisionalState
    }
  } catch (error) {
    throw toError(error)
  }
}

async function receiverManualFinalize(
  provisionalState: string,
  signedPsbtBase64: string
): Promise<{ proposalPsbtBase64: string }> {
  try {
    const result = nativeReceiverManualFinalize(
      provisionalState,
      signedPsbtBase64
    )
    return { proposalPsbtBase64: result.proposalPsbtBase64 }
  } catch (error) {
    throw toError(error)
  }
}

/**
 * A replayed sender can only be resumed from the two live states. A terminal or
 * fallback session has no request left to make, so callers must recreate it.
 */
function senderLiveFromSession(session: SendSession): SenderLive {
  if (session.tag === SendSession_Tags.WithReplyKey) {
    return { kind: 'withReplyKey', sender: session.inner.inner }
  }
  if (session.tag === SendSession_Tags.PollingForProposal) {
    return { kind: 'polling', sender: session.inner.inner }
  }
  throw new Error('unsupported sender resume state after replay')
}

function ensureSender(state: string): { id: string; entry: SenderEntry } {
  const payload = decodeSenderState(state)
  const existing = senders.get(payload.id)
  if (existing) {
    return { entry: existing, id: payload.id }
  }
  if (payload.events.length === 0) {
    throw new Error('sender session not found in memory; recreate it')
  }
  const replayed = replaySenderEventLog(replayPersister(payload.events))
  const live = senderLiveFromSession(replayed.state())
  const entry: SenderEntry = {
    events: payload.events,
    live,
    ohttpRelay: payload.ohttp_relay,
    protocol: payload.protocol
  }
  senders.set(payload.id, entry)
  return { entry, id: payload.id }
}

async function createSenderSession(
  init: SenderSessionInit
): Promise<SenderSessionHandle> {
  try {
    const uri: PjUriLike = parsePjUri(init.pjUri)
    const builder = new SenderBuilder(init.originalPsbtBase64, uri)
    const configured = init.disableOutputSubstitution
      ? builder.alwaysDisableOutputSubstitution()
      : builder
    const persister = createPersister()
    const sender = configured.buildRecommended(0n).save(persister)

    const ohttpRelay = nextSenderOhttpRelay ?? ''
    const id = randomId()
    const { request, ohttpCtx } = sender.createV2PostRequest(ohttpRelay)
    const entry: SenderEntry = {
      events: persister.drain(),
      live: { kind: 'withReplyKey', sender },
      ohttpRelay,
      pendingOhttp: ohttpCtx,
      protocol: 'v2'
    }
    senders.set(id, entry)
    return {
      id,
      protocol: 'v2',
      request: adaptRequest(request),
      state: encodeSenderState(id, entry)
    }
  } catch (error) {
    throw toError(error)
  }
}

async function resumeSenderSession(
  state: string
): Promise<SenderSessionHandle> {
  try {
    const { id, entry } = ensureSender(state)
    return {
      id,
      protocol: entry.protocol,
      state: encodeSenderState(id, entry)
    }
  } catch (error) {
    throw toError(error)
  }
}

async function senderExtractRequest(
  state: string
): Promise<{ request: PayjoinNativeRequest; state: string }> {
  try {
    const { id, entry } = ensureSender(state)
    const { request, ohttpCtx } =
      entry.live.kind === 'polling'
        ? entry.live.sender.createPollRequest(entry.ohttpRelay)
        : entry.live.sender.createV2PostRequest(entry.ohttpRelay)
    entry.pendingOhttp = ohttpCtx
    return {
      request: adaptRequest(request),
      state: encodeSenderState(id, entry)
    }
  } catch (error) {
    throw toError(error)
  }
}

async function senderProcessResponse(
  state: string,
  body: Uint8Array
): Promise<ProcessResult> {
  const { id, entry } = ensureSender(state)
  const ohttpCtx = entry.pendingOhttp
  if (!ohttpCtx) {
    throw new Error('missing ohttp context; call extract first')
  }
  entry.pendingOhttp = undefined

  const persister = createPersister()
  try {
    if (entry.live.kind === 'withReplyKey') {
      const polling = entry.live.sender
        .processResponse(toArrayBuffer(body), ohttpCtx)
        .save(persister)
      entry.events.push(...persister.drain())
      entry.live = { kind: 'polling', sender: polling }
      return { kind: 'pending', state: encodeSenderState(id, entry) }
    }

    const outcome = entry.live.sender
      .processResponse(toArrayBuffer(body), ohttpCtx)
      .save(persister)
    entry.events.push(...persister.drain())

    const psbtBase64 = unwrapPollingProposalPsbt(outcome)
    if (psbtBase64) {
      return {
        kind: 'proposal',
        psbtBase64,
        state: encodeSenderState(id, entry)
      }
    }
    const nextPoller = unwrapPollingStasis(outcome)
    if (isPollingForProposal(nextPoller)) {
      entry.live = { kind: 'polling', sender: nextPoller }
    }
    return { kind: 'pending', state: encodeSenderState(id, entry) }
  } catch (error) {
    return { kind: 'error', message: toError(error).message }
  }
}

export {
  createReceiverSession,
  createSenderSession,
  fetchOhttpKeys,
  httpPost,
  isNativeAvailable,
  receiverContributeAndFinalize,
  receiverExtractRequest,
  receiverFinalizeWithoutInputs,
  receiverManualContribute,
  receiverManualFinalize,
  receiverProcessResponse,
  resumeReceiverSession,
  resumeSenderSession,
  senderExtractRequest,
  senderProcessResponse
}
