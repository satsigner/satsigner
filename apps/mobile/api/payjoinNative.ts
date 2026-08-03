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

import {
  InputPair,
  type InputPairLike,
  type JsonReceiverSessionPersister,
  type JsonSenderSessionPersister,
  type PayjoinProposalLike,
  type PjUriLike,
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
  type UncheckedOriginalPayloadLike,
  type WithReplyKeyLike,
  fetchOhttpKeys as nativeFetchOhttpKeys,
  mergeFinalizedProposalInputs,
  parsePjUri,
  receiverManualContribute as nativeReceiverManualContribute,
  receiverManualFinalize as nativeReceiverManualFinalize
} from 'react-native-payjoin'

import {
  PAYJOIN_MIN_SESSION_EXPIRE_SECONDS,
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
  const parsed: unknown = JSON.parse(decodeBase64(state))
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('invalid state encoding')
  }
  const value = parsed as Partial<ReceiverStatePayload>
  if (typeof value.id !== 'string') {
    throw new TypeError('state missing id')
  }
  return {
    events: Array.isArray(value.events) ? value.events : [],
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
  const parsed: unknown = JSON.parse(decodeBase64(state))
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('invalid state encoding')
  }
  const value = parsed as Partial<SenderStatePayload>
  if (typeof value.id !== 'string') {
    throw new TypeError('state missing id')
  }
  return {
    events: Array.isArray(value.events) ? value.events : [],
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
  return body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength
  ) as ArrayBuffer
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
    const { inner } = error as { inner: unknown }
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
  timeoutMs = 45_000
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
      receiveScriptHex: ''
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

    const next = unwrapOptionalTransition(outcome)
    if (!next) {
      entry.live = { kind: 'initialized', receiver: initialized }
      return {
        kind: 'pending',
        state: encodeReceiverState(id, entry)
      }
    }

    entry.live = { kind: 'unchecked', receiver: next }
    const psbtBase64 = originalPsbtFromEvents(entry.events)
    if (!psbtBase64) {
      return {
        kind: 'error',
        message: 'original psbt missing from receiver event log'
      }
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

/**
 * `processResponse` returns a progress/stasis union: stasis means the mailbox
 * was empty and the same session should keep polling.
 */
function unwrapOptionalTransition(
  outcome: unknown
): UncheckedOriginalPayloadLike | undefined {
  if (!outcome || typeof outcome !== 'object') {
    return undefined
  }
  if ('tag' in outcome && 'inner' in outcome) {
    const tag = String((outcome as { tag: unknown }).tag)
    if (tag.toLowerCase().includes('stasis')) {
      return undefined
    }
    const [value] = (outcome as { inner: [unknown] }).inner
    return value as UncheckedOriginalPayloadLike
  }
  return outcome as UncheckedOriginalPayloadLike
}

/** The sender's original PSBT is recorded in the receiver event log. */
function originalPsbtFromEvents(events: string[]): string | undefined {
  for (const raw of [...events].toReversed()) {
    const found = findPsbtInEvent(raw)
    if (found) {
      return found
    }
  }
  return undefined
}

function findPsbtInEvent(raw: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    return searchForPsbt(parsed)
  } catch {
    return undefined
  }
}

function searchForPsbt(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.startsWith('cHNidP') ? value : undefined
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = searchForPsbt(item)
      if (found) {
        return found
      }
    }
    return undefined
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = searchForPsbt(item)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

type ReceiverInput = {
  txid: string
  vout: number
  value: number
  scriptHex: string
}

function buildInputPair(input: ReceiverInput): InputPairLike {
  const scriptPubkey = toArrayBuffer(hexToBytes(input.scriptHex))
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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Runs the receiver checks and contributes one input, or — when a signed PSBT
 * is supplied — finalizes the provisional proposal and builds the directory
 * POST. Two-phase so the wallet can sign in between.
 */
async function receiverContributeAndFinalize(
  state: string,
  input: ReceiverInput,
  signedPsbtBase64: string
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
    return contributeReceiver(id, entry, input)
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

function contributeReceiver(
  id: string,
  entry: ReceiverEntry,
  input: ReceiverInput
): { request: PayjoinNativeRequest; state: string; psbtBase64: string } {
  if (entry.live.kind !== 'unchecked') {
    throw new Error('no original proposal to contribute to; poll first')
  }
  const persister = createPersister()
  const { receiveScriptHex } = entry

  const maybeOwned = entry.live.receiver
    .assumeInteractiveReceiver()
    .save(persister)
  const maybeSeen = maybeOwned
    .checkInputsNotOwned({ callback: () => false })
    .save(persister)
  const outputsUnknown = maybeSeen
    .checkNoInputsSeenBefore({ callback: () => false })
    .save(persister)
  const wantsOutputs = outputsUnknown
    .identifyReceiverOutputs({
      callback: (script: ArrayBuffer) =>
        bytesToHex(new Uint8Array(script)) === receiveScriptHex
    })
    .save(persister)

  const wantsInputs = wantsOutputs.commitOutputs().save(persister)
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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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

    const psbtBase64 = proposalPsbtFromOutcome(outcome)
    if (psbtBase64) {
      return {
        kind: 'proposal',
        psbtBase64,
        state: encodeSenderState(id, entry)
      }
    }
    return { kind: 'pending', state: encodeSenderState(id, entry) }
  } catch (error) {
    return { kind: 'error', message: toError(error).message }
  }
}

function proposalPsbtFromOutcome(outcome: unknown): string | undefined {
  if (typeof outcome === 'string') {
    return outcome
  }
  if (!outcome || typeof outcome !== 'object') {
    return undefined
  }
  if ('tag' in outcome && 'inner' in outcome) {
    const tag = String((outcome as { tag: unknown }).tag)
    if (tag.toLowerCase().includes('stasis')) {
      return undefined
    }
    const [value] = (outcome as { inner: [unknown] }).inner
    return typeof value === 'string' ? value : undefined
  }
  return undefined
}

export {
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
  resumeSenderSession,
  senderExtractRequest,
  senderProcessResponse
}
