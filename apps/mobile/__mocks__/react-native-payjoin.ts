/**
 * Jest mock for react-native-payjoin.
 * Simulates PDK session handles and an in-memory mailbox for unit tests.
 */
/* eslint-disable require-await -- async signatures match the native facade */

import { type PayjoinNativeRequest } from '@/types/payjoin'

type ReceiverSessionInit = {
  address: string
  directoryUrl: string
  ohttpRelayUrl: string
  expireSeconds: number
}

type ReceiverSessionHandle = {
  id: string
  pjUri: string
  state: string
}

type SenderSessionInit = {
  pjUri: string
  originalPsbtBase64: string
  disableOutputSubstitution: boolean
}

type SenderSessionHandle = {
  id: string
  protocol: 'v1' | 'v2'
  state: string
  request?: PayjoinNativeRequest
}

type ProcessResult =
  | { kind: 'pending'; nextRequest?: PayjoinNativeRequest; state: string }
  | { kind: 'proposal'; psbtBase64: string; state: string }
  | { kind: 'completed'; state: string }
  | { kind: 'error'; message: string }

type MockMailbox = {
  originalPsbtBase64?: string
  proposalPsbtBase64?: string
}

const mailboxes = new Map<string, MockMailbox>()
let idCounter = 0

function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

function encodeState(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64')
}

function decodeState(state: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(state, 'base64').toString('utf8')) as Record<
    string,
    unknown
  >
}

function textEncoder(body: string): Uint8Array {
  return new Uint8Array(Buffer.from(body, 'utf8'))
}

function isNativeAvailable(): boolean {
  return true
}

async function fetchOhttpKeys(
  _relayUrl: string,
  _directoryUrl: string
): Promise<string> {
  return 'mock-ohttp-keys'
}

async function httpPost(
  url: string,
  contentType: string,
  body: Uint8Array,
  _timeoutMs = 45_000
): Promise<{ status: number; body: Uint8Array }> {
  const response = await fetch(url, {
    body: body as BodyInit,
    headers: { 'Content-Type': contentType },
    method: 'POST'
  })
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { body: bytes, status: response.status }
}

async function createReceiverSession(
  init: ReceiverSessionInit
): Promise<ReceiverSessionHandle> {
  const id = nextId('recv')
  const mailboxId = nextId('mb')
  mailboxes.set(mailboxId, {})
  const pjEndpoint = `${init.directoryUrl}/${mailboxId}#RK1-mock-EX1${init.expireSeconds}-OH1-mock-RK1-mock`
  const pjUri = `bitcoin:${init.address}?pjos=0&pj=${pjEndpoint}`
  const state = encodeState({
    address: init.address,
    id,
    mailboxId,
    phase: 'ready',
    role: 'receiver'
  })
  return { id, pjUri, state }
}

async function resumeReceiverSession(
  state: string
): Promise<ReceiverSessionHandle> {
  const data = decodeState(state)
  const mailboxId = String(data.mailboxId)
  const address = String(data.address)
  const pjEndpoint = `https://payjo.in/${mailboxId}#RK1-mock`
  return {
    id: String(data.id),
    pjUri: `bitcoin:${address}?pjos=0&pj=${pjEndpoint}`,
    state
  }
}

async function receiverExtractRequest(
  state: string
): Promise<{ request: PayjoinNativeRequest; state: string }> {
  const data = decodeState(state)
  return {
    request: {
      body: textEncoder('poll'),
      contentType: 'message/ohttp-req',
      url: 'https://ohttp.example/mock'
    },
    state: encodeState({ ...data, phase: 'waiting' })
  }
}

async function receiverProcessResponse(
  state: string,
  _body: Uint8Array
): Promise<ProcessResult> {
  const data = decodeState(state)
  const mailbox = mailboxes.get(String(data.mailboxId))
  if (!mailbox?.originalPsbtBase64) {
    return {
      kind: 'pending',
      state: encodeState({ ...data, phase: 'waiting' })
    }
  }
  return {
    kind: 'proposal',
    psbtBase64: mailbox.originalPsbtBase64,
    state: encodeState({ ...data, phase: 'proposal' })
  }
}

async function receiverContributeAndFinalize(
  state: string,
  _input: {
    txid: string
    vout: number
    value: number
    scriptHex: string
  },
  signedPsbtBase64: string,
  _checks?: {
    isInputOwned: (scriptHex: string) => boolean
    isInputSeen: (outpoint: string) => boolean
  }
): Promise<{
  request: PayjoinNativeRequest
  state: string
  psbtBase64: string
}> {
  const data = decodeState(state)
  const mailboxId = String(data.mailboxId)

  // First pass: return provisional PSBT for the wallet to sign.
  if (!signedPsbtBase64) {
    const provisional =
      (mailboxes.get(mailboxId)?.originalPsbtBase64 as string | undefined) ??
      'cHNidP2provisional'
    return {
      psbtBase64: provisional,
      request: {
        body: new Uint8Array(),
        contentType: 'application/octet-stream',
        url: ''
      },
      state: encodeState({ ...data, phase: 'provisional' })
    }
  }

  const mailbox = mailboxes.get(mailboxId) ?? {}
  mailbox.proposalPsbtBase64 = signedPsbtBase64
  mailboxes.set(mailboxId, mailbox)
  return {
    psbtBase64: signedPsbtBase64,
    request: {
      body: textEncoder(signedPsbtBase64),
      contentType: 'message/ohttp-req',
      url: 'https://ohttp.example/mock'
    },
    state: encodeState({ ...data, phase: 'completed' })
  }
}

async function receiverManualContribute(
  originalPsbtBase64: string,
  _receiveAddress: string,
  _disableOutputSubstitution: boolean,
  _input: { txid: string; vout: number; value: number; scriptHex: string },
  _ownedScriptsHex: string[],
  _seenOutpoints: string[],
  _ownedOutpoints: string[] = []
): Promise<{ provisionalPsbtBase64: string; provisionalState: string }> {
  return {
    provisionalPsbtBase64: originalPsbtBase64,
    provisionalState: encodeState({
      originalPsbtBase64,
      phase: 'manual-provisional',
      role: 'receiver'
    })
  }
}

async function receiverManualFinalize(
  _provisionalState: string,
  signedPsbtBase64: string
): Promise<{ proposalPsbtBase64: string }> {
  return { proposalPsbtBase64: signedPsbtBase64 }
}

function detectProtocol(pjUri: string): 'v1' | 'v2' {
  if (pjUri.includes('payjo.in') || pjUri.includes('#')) {
    return 'v2'
  }
  return 'v1'
}

async function createSenderSession(
  init: SenderSessionInit
): Promise<SenderSessionHandle> {
  const id = nextId('send')
  const protocol = detectProtocol(init.pjUri)
  const pjMatch = init.pjUri.match(/[?&]pj=([^&]+)/i)
  const pjEndpoint = pjMatch
    ? decodeURIComponent(pjMatch[1]!)
    : 'https://example.com/pj'

  if (protocol === 'v1') {
    const state = encodeState({
      id,
      originalPsbtBase64: init.originalPsbtBase64,
      phase: 'request',
      pjEndpoint,
      protocol,
      role: 'sender'
    })
    return {
      id,
      protocol,
      request: {
        body: textEncoder(init.originalPsbtBase64),
        contentType: 'text/plain',
        url: pjEndpoint
      },
      state
    }
  }

  // v2: stash original into mailbox if endpoint contains mailbox id
  const mailboxId = pjEndpoint.split('/').pop()?.split('#')[0] ?? nextId('mb')
  const mailbox = mailboxes.get(mailboxId) ?? {}
  mailbox.originalPsbtBase64 = init.originalPsbtBase64
  mailboxes.set(mailboxId, mailbox)

  const state = encodeState({
    id,
    mailboxId,
    originalPsbtBase64: init.originalPsbtBase64,
    phase: 'waiting',
    protocol,
    role: 'sender'
  })

  return {
    id,
    protocol,
    request: {
      body: textEncoder(init.originalPsbtBase64),
      contentType: 'message/ohttp-req',
      url: 'https://ohttp.example/mock'
    },
    state
  }
}

async function resumeSenderSession(
  state: string
): Promise<SenderSessionHandle> {
  const data = decodeState(state)
  return {
    id: String(data.id),
    protocol: data.protocol as 'v1' | 'v2',
    state
  }
}

async function senderExtractRequest(
  state: string
): Promise<{ request: PayjoinNativeRequest; state: string }> {
  return {
    request: {
      body: textEncoder('poll'),
      contentType: 'message/ohttp-req',
      url: 'https://ohttp.example/mock'
    },
    state
  }
}

async function senderProcessResponse(
  state: string,
  body: Uint8Array
): Promise<ProcessResult> {
  const data = decodeState(state)
  const text = Buffer.from(body).toString('utf8')

  if (data.protocol === 'v1') {
    if (text.startsWith('{')) {
      return { kind: 'error', message: text }
    }
    return {
      kind: 'proposal',
      psbtBase64: text,
      state: encodeState({ ...data, phase: 'proposal' })
    }
  }

  const mailbox = mailboxes.get(String(data.mailboxId))
  if (mailbox?.proposalPsbtBase64) {
    return {
      kind: 'proposal',
      psbtBase64: mailbox.proposalPsbtBase64,
      state: encodeState({ ...data, phase: 'proposal' })
    }
  }

  return {
    kind: 'pending',
    state: encodeState({ ...data, phase: 'waiting' })
  }
}

/** Test helper: clear in-memory mailboxes between tests. */
function __resetPayjoinMock() {
  mailboxes.clear()
  idCounter = 0
}

/** Test helper: inject a proposal into a mailbox. */
function __setMailboxProposal(mailboxId: string, proposalPsbtBase64: string) {
  const mailbox = mailboxes.get(mailboxId) ?? {}
  mailbox.proposalPsbtBase64 = proposalPsbtBase64
  mailboxes.set(mailboxId, mailbox)
}

export {
  __resetPayjoinMock,
  __setMailboxProposal,
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

export type {
  ProcessResult,
  ReceiverSessionHandle,
  ReceiverSessionInit,
  SenderSessionHandle,
  SenderSessionInit
}
