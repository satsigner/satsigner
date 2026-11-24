import { z } from 'zod'

import {
  NOSTR_NIP46_SUPPORTED_METHODS,
  NOSTR_SIGN_MAX_CLOCK_SKEW_SECS,
  NOSTR_SIGN_REQUEST_BATCH_MAX,
  NOSTR_SIGN_REQUEST_BLOCK,
  NOSTR_SIGN_REQUEST_DEFAULT_TTL_SECS,
  NOSTR_SIGN_REQUEST_LABEL_MAX,
  NOSTR_SIGN_REQUEST_MAX_BYTES,
  NOSTR_SIGN_REQUEST_MAX_TTL_SECS,
  NOSTR_SIGN_REQUEST_TAG,
  NOSTR_SIGN_RESPONSE_BLOCK,
  NOSTR_SIGN_RESPONSE_TAG
} from '@/constants/nostr'
import type { SignRequestDecision } from '@/db/signRequests'
import type {
  Nip46Method,
  NostrSignRequest,
  NostrSignRequestStatus
} from '@/types/models/Nostr'
import {
  handleGetPublicKey,
  handleNip04Decrypt,
  handleNip04Encrypt,
  handleNip44Decrypt,
  handleNip44Encrypt,
  handlePing,
  handleSignEvent
} from '@/utils/nip46Handlers'
import { parseNostrEventTemplate } from '@/utils/nostrEvent'
import { isRecord } from '@/utils/object'
import { toSingleLinePreview } from '@/utils/string'

/**
 * The NIP-46 JSON-RPC request, as an agent sends it inside a chat session.
 * `pubkey` names the key that should sign; `expires` is a unix time.
 */
const SignRequestPayloadSchema = z.object({
  expires: z.number().int().positive().optional(),
  id: z.string().min(1).max(128),
  label: z.string().optional(),
  method: z.string().min(1),
  params: z.array(z.unknown()).max(4).default([]),
  pubkey: z.string().optional()
})

type SignRequestPayload = z.infer<typeof SignRequestPayloadSchema>

/** Methods a chat request may use. `connect` only makes sense on a live link. */
const CHAT_SIGN_METHODS = NOSTR_NIP46_SUPPORTED_METHODS.filter(
  (method) => method !== 'connect'
)

const BLOCK_RE = new RegExp(
  String.raw`\`\`\`${NOSTR_SIGN_REQUEST_BLOCK}\s*\n([\s\S]*?)\n?\`\`\``,
  'g'
)

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** A block may hold one request or an array of them. */
function flattenPayloads(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Requests in a rumor: one `sign_request` tag each, or fenced
 * `nostr-sign-request` JSON blocks in the text for agents whose tools only
 * send text. Tags win when both are present. Oversized messages carry none.
 */
function extractSignRequestPayloads(content: string, tags: unknown): unknown[] {
  if (
    content.length + JSON.stringify(tags ?? []).length >
    NOSTR_SIGN_REQUEST_MAX_BYTES
  ) {
    return []
  }
  const fromTags = Array.isArray(tags)
    ? tags
        .filter(
          (tag): tag is string[] =>
            Array.isArray(tag) &&
            tag[0] === NOSTR_SIGN_REQUEST_TAG &&
            typeof tag[1] === 'string'
        )
        .map((tag) => parseJson(tag[1]))
    : []
  if (fromTags.length > 0) {
    return fromTags
  }
  return [...content.matchAll(BLOCK_RE)].flatMap((match) =>
    flattenPayloads(parseJson(match[1] ?? ''))
  )
}

function hasSignRequest(content: string, tags: unknown): boolean {
  return extractSignRequestPayloads(content, tags).length > 0
}

function toChatSignMethod(method: string): Nip46Method | null {
  return CHAT_SIGN_METHODS.find((supported) => supported === method) ?? null
}

function toStringParams(params: unknown[]): string[] {
  return params.map((param) => {
    if (typeof param === 'string') {
      return param
    }
    return isRecord(param) ? JSON.stringify(param) : ''
  })
}

type SignRequestContext = {
  identityNpub: string
  messageId: string
  ownPubkey: string
  peerPubkey: string
  /** Local clock when the message was read, which the peer can't set. */
  receivedAt: number
  /** The message's own time, set by the peer. */
  requestedAt: number
  sessionId: string
}

function clampExpiry(requestedAt: number, expires: number | undefined): number {
  const latest = requestedAt + NOSTR_SIGN_REQUEST_MAX_TTL_SECS
  if (expires === undefined) {
    return requestedAt + NOSTR_SIGN_REQUEST_DEFAULT_TTL_SECS
  }
  return Math.min(expires, latest)
}

/** Why a request can't be signed as sent, checked before the user sees it. */
function findRequestProblem(
  payload: SignRequestPayload,
  method: Nip46Method | null,
  params: string[],
  context: SignRequestContext
): string | undefined {
  if (method === null) {
    return 'unsupported method'
  }
  if (payload.pubkey !== undefined && payload.pubkey !== context.ownPubkey) {
    return 'wrong key'
  }
  // The request time anchors the event-date check, so a message dated in
  // the future could get events pre-dated.
  if (
    context.requestedAt - context.receivedAt >
    NOSTR_SIGN_MAX_CLOCK_SKEW_SECS
  ) {
    return 'request dated in the future'
  }
  if (method !== 'sign_event') {
    return undefined
  }
  return findEventProblem(params[0] ?? '', context.requestedAt)
}

/**
 * The event must be well formed and dated near the request, not the
 * signing: approving a day later still works, back-dating does not.
 */
function findEventProblem(
  eventJson: string,
  requestedAt: number
): string | undefined {
  const parsed = parseJson(eventJson)
  const withTime = isRecord(parsed)
    ? { created_at: requestedAt, ...parsed }
    : parsed
  const template = parseNostrEventTemplate(withTime)
  if (!template) {
    return 'invalid event'
  }
  if (
    Math.abs(template.created_at - requestedAt) > NOSTR_SIGN_MAX_CLOCK_SKEW_SECS
  ) {
    return 'created_at too far from the request'
  }
  return undefined
}

function normalizeLabel(label: string | undefined): string | undefined {
  if (label === undefined) {
    return undefined
  }
  const line = toSingleLinePreview(label, NOSTR_SIGN_REQUEST_LABEL_MAX)
  return line.length > 0 ? line : undefined
}

/**
 * Turns what a peer sent into stored requests, one batch per message. Each
 * is either pending or invalid with the reason; a batch over the cap, or with
 * repeated ids, is not accepted at all.
 */
function parseSignRequests(
  content: string,
  tags: unknown,
  context: SignRequestContext
): NostrSignRequest[] {
  const payloads = extractSignRequestPayloads(content, tags)
    .map((value) => SignRequestPayloadSchema.safeParse(value))
    .filter((result) => result.success)
    .map((result) => result.data)
  const ids = new Set(payloads.map((payload) => payload.id))
  if (
    payloads.length === 0 ||
    payloads.length > NOSTR_SIGN_REQUEST_BATCH_MAX ||
    ids.size !== payloads.length
  ) {
    return []
  }
  return payloads.map((payload) => {
    const method = toChatSignMethod(payload.method)
    const params = toStringParams(payload.params)
    const problem = findRequestProblem(payload, method, params, context)
    const status: NostrSignRequestStatus = problem ? 'invalid' : 'pending'
    return {
      answered: false,
      expiresAt: clampExpiry(context.requestedAt, payload.expires),
      identityNpub: context.identityNpub,
      label: normalizeLabel(payload.label),
      messageId: context.messageId,
      method: method ?? 'ping',
      params,
      peerPubkey: context.peerPubkey,
      requestId: payload.id,
      requestedAt: context.requestedAt,
      sessionId: context.sessionId,
      status,
      ...(problem ? { error: problem } : {})
    }
  })
}

/** A missing created_at is the time of signing, as NIP-46 clients expect. */
function withSigningTime(eventJson: string, nowSeconds: number): string {
  const parsed = parseJson(eventJson)
  return isRecord(parsed) && parsed.created_at === undefined
    ? JSON.stringify({ ...parsed, created_at: nowSeconds })
    : eventJson
}

function executeChatSignRequest(
  request: NostrSignRequest,
  signerPubkeyHex: string,
  secretKey: Uint8Array,
  nowSeconds: number
): string {
  const [first = '', second = ''] = request.params
  switch (request.method) {
    case 'sign_event': {
      return handleSignEvent(withSigningTime(first, nowSeconds), secretKey)
    }
    case 'get_public_key': {
      return handleGetPublicKey(signerPubkeyHex)
    }
    case 'nip04_encrypt': {
      return handleNip04Encrypt(first, second, secretKey)
    }
    case 'nip04_decrypt': {
      return handleNip04Decrypt(first, second, secretKey)
    }
    case 'nip44_encrypt': {
      return handleNip44Encrypt(first, second, secretKey)
    }
    case 'nip44_decrypt': {
      return handleNip44Decrypt(first, second, secretKey)
    }
    case 'ping': {
      return handlePing()
    }
    default: {
      throw new Error('unsupported method')
    }
  }
}

type BatchDecision = SignRequestDecision

function decideOne(
  request: NostrSignRequest,
  signerPubkeyHex: string,
  secretKey: Uint8Array,
  nowSeconds: number
): BatchDecision {
  if (request.status !== 'pending') {
    return {
      error: request.error ?? 'not signable',
      requestId: request.requestId,
      status: request.status
    }
  }
  try {
    return {
      requestId: request.requestId,
      result: executeChatSignRequest(
        request,
        signerPubkeyHex,
        secretKey,
        nowSeconds
      ),
      status: 'signed'
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'signing failed',
      requestId: request.requestId,
      status: 'invalid'
    }
  }
}

/**
 * Approving signs every pending request of the batch with the chat
 * identity; requests that were invalid keep their reason. A batch that
 * expired meanwhile is not signed.
 */
function approveSignRequestBatch(
  batch: NostrSignRequest[],
  signerPubkeyHex: string,
  secretKey: Uint8Array,
  nowSeconds: number
): BatchDecision[] {
  if (batch.some((request) => request.expiresAt <= nowSeconds)) {
    return batch.map((request) => ({
      error: 'expired',
      requestId: request.requestId,
      status: 'expired'
    }))
  }
  return batch.map((request) =>
    decideOne(request, signerPubkeyHex, secretKey, nowSeconds)
  )
}

/** Declining closes the batch; an unsignable request keeps its reason. */
function rejectSignRequestBatch(batch: NostrSignRequest[]): BatchDecision[] {
  return batch.map((request) => ({
    error:
      request.status === 'invalid' && request.error
        ? request.error
        : 'rejected by user',
    requestId: request.requestId,
    status: 'rejected'
  }))
}

type SignResponsePayload = { error?: string; id: string; result?: string }

function toResponsePayload(request: BatchDecision): SignResponsePayload {
  return request.status === 'signed' && request.result !== undefined
    ? { id: request.requestId, result: request.result }
    : { error: request.error ?? request.status, id: request.requestId }
}

/**
 * The answer as NIP-46 responses: one `sign_response` tag per request, and
 * the same JSON as a fenced block, so an agent that only reads text gets it.
 */
function buildSignResponse(decisions: BatchDecision[]): {
  content: string
  tags: string[][]
} {
  const payloads = decisions.map(toResponsePayload)
  const signed = decisions.filter((decision) => decision.status === 'signed')
  const summary =
    signed.length === decisions.length
      ? `Signed ${signed.length} of ${decisions.length}`
      : `Signed ${signed.length} of ${decisions.length}, the rest declined`
  return {
    content: [
      summary,
      '',
      `\`\`\`${NOSTR_SIGN_RESPONSE_BLOCK}`,
      JSON.stringify(payloads, null, 2),
      '```'
    ].join('\n'),
    tags: payloads.map((payload) => [
      NOSTR_SIGN_RESPONSE_TAG,
      JSON.stringify(payload)
    ])
  }
}

function getSignRequestEventKind(request: NostrSignRequest): number | null {
  if (request.method !== 'sign_event') {
    return null
  }
  const parsed = parseJson(request.params[0] ?? '')
  return isRecord(parsed) && typeof parsed.kind === 'number'
    ? parsed.kind
    : null
}

/** What the card shows for a request: the event, or the counterparty. */
function getSignRequestEvent(request: NostrSignRequest) {
  if (request.method !== 'sign_event') {
    return null
  }
  const parsed = parseJson(request.params[0] ?? '')
  return isRecord(parsed)
    ? parseNostrEventTemplate({ created_at: request.requestedAt, ...parsed })
    : null
}

export {
  approveSignRequestBatch,
  buildSignResponse,
  extractSignRequestPayloads,
  getSignRequestEvent,
  getSignRequestEventKind,
  hasSignRequest,
  parseSignRequests,
  rejectSignRequestBatch
}
export type { BatchDecision, SignRequestContext }
