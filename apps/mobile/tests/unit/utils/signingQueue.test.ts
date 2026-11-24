import { generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools'
import { decrypt as nip44Decrypt, getConversationKey } from 'nostr-tools/nip44'

import {
  NOSTR_SIGN_MAX_CLOCK_SKEW_SECS,
  NOSTR_SIGN_REQUEST_BATCH_MAX,
  NOSTR_SIGN_REQUEST_DEFAULT_TTL_SECS,
  NOSTR_SIGN_REQUEST_MAX_TTL_SECS
} from '@/constants/nostr'
import type { NostrSignRequest } from '@/types/models/Nostr'
import { parseNostrEvent } from '@/utils/nostrEvent'
import {
  approveSignRequestBatch,
  buildSignResponse,
  extractSignRequestPayloads,
  parseSignRequests,
  rejectSignRequestBatch
} from '@/utils/signingQueue'

// The shared manual mock stubs the crypto these tests sign and verify with.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

const ownSecretKey = generateSecretKey()
const ownPubkey = getPublicKey(ownSecretKey)
const otherPubkey = getPublicKey(generateSecretKey())
const REQUESTED_AT = 1_800_000_000

const context = {
  identityNpub: 'npub1me',
  messageId: 'm'.repeat(64),
  ownPubkey,
  peerPubkey: otherPubkey,
  receivedAt: REQUESTED_AT,
  requestedAt: REQUESTED_AT,
  sessionId: 'c'.repeat(32)
}

function signRequestTag(payload: Record<string, unknown>): string[] {
  return ['sign_request', JSON.stringify(payload)]
}

function eventParam(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    content: 'hello',
    created_at: REQUESTED_AT,
    kind: 1,
    tags: [],
    ...overrides
  })
}

function parse(payloads: Record<string, unknown>[]): NostrSignRequest[] {
  return parseSignRequests('', payloads.map(signRequestTag), context)
}

describe('extractSignRequestPayloads', () => {
  it('reads one request per sign_request tag', () => {
    expect(
      extractSignRequestPayloads('', [
        ['p', otherPubkey],
        signRequestTag({ id: '1', method: 'ping' }),
        signRequestTag({ id: '2', method: 'ping' })
      ])
    ).toStrictEqual([
      { id: '1', method: 'ping' },
      { id: '2', method: 'ping' }
    ])
  })

  it('reads fenced blocks when there are no tags, for text-only agents', () => {
    const content = [
      'Please sign the release:',
      '```nostr-sign-request',
      JSON.stringify([
        { id: 'a', method: 'ping' },
        { id: 'b', method: 'ping' }
      ]),
      '```'
    ].join('\n')

    expect(extractSignRequestPayloads(content, [])).toStrictEqual([
      { id: 'a', method: 'ping' },
      { id: 'b', method: 'ping' }
    ])
  })

  it('prefers tags over blocks', () => {
    const content = '```nostr-sign-request\n{"id":"block","method":"ping"}\n```'

    expect(
      extractSignRequestPayloads(content, [
        signRequestTag({ id: 'tag', method: 'ping' })
      ])
    ).toStrictEqual([{ id: 'tag', method: 'ping' }])
  })

  it('reads nothing from an oversized message', () => {
    expect(
      extractSignRequestPayloads('x'.repeat(70 * 1024), [
        signRequestTag({ id: '1', method: 'ping' })
      ])
    ).toStrictEqual([])
  })
})

describe('parseSignRequests', () => {
  it('queues a sign_event for the chat identity as pending', () => {
    const [request] = parse([
      {
        id: '1',
        label: 'Release 1.4',
        method: 'sign_event',
        params: [eventParam()],
        pubkey: ownPubkey
      }
    ])

    expect(request).toMatchObject({
      label: 'Release 1.4',
      method: 'sign_event',
      requestId: '1',
      sessionId: context.sessionId,
      status: 'pending'
    })
  })

  it('accepts an event object as well as a JSON string', () => {
    const [request] = parse([
      {
        id: '1',
        method: 'sign_event',
        params: [{ content: '', created_at: REQUESTED_AT, kind: 1, tags: [] }]
      }
    ])

    expect(request?.status).toBe('pending')
  })

  it('refuses a request naming any other key', () => {
    const [request] = parse([
      {
        id: '1',
        method: 'sign_event',
        params: [eventParam()],
        pubkey: otherPubkey
      }
    ])

    expect(request).toMatchObject({ error: 'wrong key', status: 'invalid' })
  })

  it('refuses connect and unknown methods over chat', () => {
    const requests = parse([
      { id: '1', method: 'connect', params: [] },
      { id: '2', method: 'sign_psbt', params: [] }
    ])

    expect(requests.map((request) => request.status)).toStrictEqual([
      'invalid',
      'invalid'
    ])
  })

  it('accepts every other NIP-46 method', () => {
    const requests = parse([
      { id: '1', method: 'get_public_key' },
      { id: '2', method: 'nip44_encrypt', params: [otherPubkey, 'hi'] },
      { id: '3', method: 'nip44_decrypt', params: [otherPubkey, 'x'] },
      { id: '4', method: 'nip04_encrypt', params: [otherPubkey, 'hi'] },
      { id: '5', method: 'nip04_decrypt', params: [otherPubkey, 'x'] },
      { id: '6', method: 'ping' }
    ])

    expect(requests.every((request) => request.status === 'pending')).toBe(true)
  })

  it('refuses an event dated far from the request', () => {
    const [backdated] = parse([
      {
        id: '1',
        method: 'sign_event',
        params: [
          eventParam({
            created_at: REQUESTED_AT - NOSTR_SIGN_MAX_CLOCK_SKEW_SECS - 1
          })
        ]
      }
    ])

    expect(backdated).toMatchObject({ status: 'invalid' })
  })

  it('refuses a message dated in the future, which would pre-date events', () => {
    const [request] = parseSignRequests(
      '',
      [
        signRequestTag({
          id: '1',
          method: 'sign_event',
          params: [eventParam()]
        })
      ],
      {
        ...context,
        receivedAt: REQUESTED_AT - NOSTR_SIGN_MAX_CLOCK_SKEW_SECS - 1
      }
    )

    expect(request).toMatchObject({
      error: 'request dated in the future',
      status: 'invalid'
    })
  })

  it('refuses a malformed event', () => {
    const [request] = parse([
      { id: '1', method: 'sign_event', params: ['{"kind":"one"}'] }
    ])

    expect(request).toMatchObject({ error: 'invalid event', status: 'invalid' })
  })

  it('caps the expiry and defaults it', () => {
    const [capped, defaulted] = parse([
      { expires: REQUESTED_AT * 2, id: '1', method: 'ping' },
      { id: '2', method: 'ping' }
    ])

    expect(capped?.expiresAt).toBe(
      REQUESTED_AT + NOSTR_SIGN_REQUEST_MAX_TTL_SECS
    )
    expect(defaulted?.expiresAt).toBe(
      REQUESTED_AT + NOSTR_SIGN_REQUEST_DEFAULT_TTL_SECS
    )
  })

  it('accepts no batch over the cap or with repeated ids', () => {
    const tooMany = Array.from(
      { length: NOSTR_SIGN_REQUEST_BATCH_MAX + 1 },
      (_, index) => ({ id: String(index), method: 'ping' })
    )

    expect(parse(tooMany)).toStrictEqual([])
    expect(
      parse([
        { id: '1', method: 'ping' },
        { id: '1', method: 'ping' }
      ])
    ).toStrictEqual([])
  })
})

describe('approveSignRequestBatch', () => {
  const now = REQUESTED_AT + 60

  it('signs every pending request with the chat key', () => {
    const batch = parse([
      { id: '1', method: 'sign_event', params: [eventParam()] },
      { id: '2', method: 'sign_event', params: [eventParam({ kind: 30_063 })] }
    ])

    const decisions = approveSignRequestBatch(
      batch,
      ownPubkey,
      ownSecretKey,
      now
    )

    expect(decisions.map((decision) => decision.status)).toStrictEqual([
      'signed',
      'signed'
    ])
    for (const decision of decisions) {
      const event = parseNostrEvent(JSON.parse(decision.result ?? ''))
      expect(event && verifyEvent(event)).toBe(true)
      expect(event?.pubkey).toBe(ownPubkey)
    }
  })

  it('dates an event without created_at at signing time', () => {
    const batch = parse([
      {
        id: '1',
        method: 'sign_event',
        params: [JSON.stringify({ content: '', kind: 1, tags: [] })]
      }
    ])

    const [decision] = approveSignRequestBatch(
      batch,
      ownPubkey,
      ownSecretKey,
      now
    )

    expect(JSON.parse(decision?.result ?? '{}').created_at).toBe(now)
  })

  it('keeps the reason of an invalid request and signs the rest', () => {
    const batch = parse([
      { id: '1', method: 'sign_event', params: [eventParam()] },
      {
        id: '2',
        method: 'sign_event',
        params: [eventParam()],
        pubkey: otherPubkey
      }
    ])

    expect(
      approveSignRequestBatch(batch, ownPubkey, ownSecretKey, now)
    ).toMatchObject([
      { requestId: '1', status: 'signed' },
      { error: 'wrong key', requestId: '2', status: 'invalid' }
    ])
  })

  it('signs nothing once the batch expired', () => {
    const batch = parse([
      { id: '1', method: 'sign_event', params: [eventParam()] }
    ])

    expect(
      approveSignRequestBatch(
        batch,
        ownPubkey,
        ownSecretKey,
        REQUESTED_AT + NOSTR_SIGN_REQUEST_DEFAULT_TTL_SECS
      )
    ).toStrictEqual([{ error: 'expired', requestId: '1', status: 'expired' }])
  })

  it('encrypts with the chat key', () => {
    const peerSecretKey = generateSecretKey()
    const batch = parse([
      {
        id: '1',
        method: 'nip44_encrypt',
        params: [getPublicKey(peerSecretKey), 'secret']
      }
    ])

    const [decision] = approveSignRequestBatch(
      batch,
      ownPubkey,
      ownSecretKey,
      now
    )

    expect(
      nip44Decrypt(
        decision?.result ?? '',
        getConversationKey(peerSecretKey, ownPubkey)
      )
    ).toBe('secret')
  })
})

describe('answers', () => {
  it('declines every request of a batch', () => {
    const batch = parse([
      { id: '1', method: 'ping' },
      { id: '2', method: 'connect' }
    ])

    expect(rejectSignRequestBatch(batch)).toStrictEqual([
      { error: 'rejected by user', requestId: '1', status: 'rejected' },
      { error: 'unsupported method', requestId: '2', status: 'rejected' }
    ])
  })

  it('answers as NIP-46 responses, as tags and as a text block', () => {
    const { content, tags } = buildSignResponse([
      { requestId: '1', result: '{"id":"x"}', status: 'signed' },
      { error: 'rejected by user', requestId: '2', status: 'rejected' }
    ])

    expect(tags).toStrictEqual([
      ['sign_response', JSON.stringify({ id: '1', result: '{"id":"x"}' })],
      ['sign_response', JSON.stringify({ error: 'rejected by user', id: '2' })]
    ])
    expect(content).toContain('```nostr-sign-response')
    expect(content).toContain('"id": "1"')
  })
})
