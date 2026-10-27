import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'
import WebSocket from 'ws'

import { BASE_CREATED_AT, fixturePubkey, makeEvent } from './support/fixtures'
import { connectRawClient, type RawRelayClient } from './support/rawClient'
import { startTestRelay, type TestRelay } from './support/testRelay'

const METADATA_KIND = 0
const TEXT_NOTE_KIND = 1
const DELETION_KIND = 5
const RELAY_LIST_KIND = 10_002
const APP_DATA_KIND = 30_078
const GIFT_WRAP_KIND = 1059
const EOSE_DELAY_MS = 150
const REFUSED_STATUS_CODE = 503

function isVerb(verb: string, subId?: string) {
  return ([messageVerb, id]: unknown[]) =>
    messageVerb === verb && (subId === undefined || id === subId)
}

function idsOf(events: unknown[]) {
  return events.map((event) =>
    typeof event === 'object' && event !== null && 'id' in event
      ? event.id
      : null
  )
}

function storedIds(relay: TestRelay) {
  return relay.events().map((event) => event.id)
}

describe('test relay', () => {
  const state: { relay?: TestRelay; client?: RawRelayClient } = {}

  function relay() {
    if (!state.relay) {
      throw new Error('relay not started')
    }
    return state.relay
  }

  function client() {
    if (!state.client) {
      throw new Error('client not connected')
    }
    return state.client
  }

  beforeEach(async () => {
    state.relay = await startTestRelay()
    state.client = await connectRawClient(state.relay.url)
  })

  afterEach(async () => {
    await state.client?.close()
    await state.relay?.stop()
  })

  it('binds a random local port and counts connections', () => {
    expect(relay().url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
    expect(relay().connectionCount()).toBe(1)
  })

  describe('req frames', () => {
    it('returns stored events newest first, honours limit, then EOSE', async () => {
      const oldest = makeEvent({ created_at: BASE_CREATED_AT })
      const middle = makeEvent({ created_at: BASE_CREATED_AT + 10 })
      const newest = makeEvent({ created_at: BASE_CREATED_AT + 20 })
      relay().seed([middle, oldest, newest])

      const all = await client().query('all', [{ kinds: [TEXT_NOTE_KIND] }])
      const limited = await client().query('limited', [
        { kinds: [TEXT_NOTE_KIND], limit: 2 }
      ])

      expect(idsOf(all)).toStrictEqual([newest.id, middle.id, oldest.id])
      expect(idsOf(limited)).toStrictEqual([newest.id, middle.id])
    })

    it('filters by ids, authors, kinds, tags, since and until', async () => {
      const alice = fixturePubkey(0xa)
      const bob = fixturePubkey(0xb)
      const target = fixturePubkey(0xc)
      const toTarget = makeEvent({
        created_at: BASE_CREATED_AT + 100,
        kind: GIFT_WRAP_KIND,
        pubkey: alice,
        tags: [['p', target]]
      })
      const reply = makeEvent({
        created_at: BASE_CREATED_AT + 200,
        pubkey: bob,
        tags: [['e', toTarget.id]]
      })
      const unrelated = makeEvent({ created_at: BASE_CREATED_AT + 300 })
      relay().seed([toTarget, reply, unrelated])

      expect(
        idsOf(await client().query('ids', [{ ids: [reply.id] }]))
      ).toStrictEqual([reply.id])
      expect(
        idsOf(await client().query('authors', [{ authors: [alice, bob] }]))
      ).toStrictEqual([reply.id, toTarget.id])
      expect(
        idsOf(await client().query('kinds', [{ kinds: [GIFT_WRAP_KIND] }]))
      ).toStrictEqual([toTarget.id])
      expect(
        idsOf(await client().query('p', [{ '#p': [target] }]))
      ).toStrictEqual([toTarget.id])
      expect(
        idsOf(await client().query('e', [{ '#e': [toTarget.id] }]))
      ).toStrictEqual([reply.id])
      expect(
        idsOf(
          await client().query('window', [
            { since: BASE_CREATED_AT + 150, until: BASE_CREATED_AT + 250 }
          ])
        )
      ).toStrictEqual([reply.id])
      expect(
        idsOf(
          await client().query('either', [
            { ids: [toTarget.id] },
            { ids: [unrelated.id] }
          ])
        )
      ).toStrictEqual([unrelated.id, toTarget.id])
    })

    it('logs every REQ and tracks open subscriptions until CLOSE', async () => {
      const filter = { '#p': [fixturePubkey(1)], kinds: [GIFT_WRAP_KIND] }
      await client().query('inbox', [filter])
      await client().query('other', [{ kinds: [TEXT_NOTE_KIND] }])

      expect(relay().reqLog()).toStrictEqual([
        expect.objectContaining({ filters: [filter], subId: 'inbox' }),
        expect.objectContaining({ subId: 'other' })
      ])
      expect(relay().openSubscriptions()).toStrictEqual([
        expect.objectContaining({ subIds: ['inbox', 'other'] })
      ])

      client().send(['CLOSE', 'inbox'])
      await client().query('sync', [{ ids: [] }])

      expect(relay().openSubscriptions()[0]?.subIds).toStrictEqual([
        'other',
        'sync'
      ])
    })
  })

  describe('event frames', () => {
    it('stores, acknowledges and broadcasts to matching live subscriptions', async () => {
      const listener = await connectRawClient(relay().url)
      await listener.query('live', [{ kinds: [TEXT_NOTE_KIND] }])
      await listener.query('nope', [{ kinds: [GIFT_WRAP_KIND] }])
      const event = makeEvent()

      client().send(['EVENT', event])

      await expect(
        client().waitFor(isVerb('OK', event.id))
      ).resolves.toStrictEqual(['OK', event.id, true, ''])
      await expect(
        listener.waitFor(isVerb('EVENT', 'live'))
      ).resolves.toStrictEqual(['EVENT', 'live', event])
      expect(listener.received().some(isVerb('EVENT', 'nope'))).toBe(false)
      expect(storedIds(relay())).toStrictEqual([event.id])
      await listener.close()
    })

    it('delivers injected events to live subscriptions', async () => {
      await client().query('live', [{ kinds: [TEXT_NOTE_KIND] }])
      const event = makeEvent()

      relay().inject(event)

      await expect(
        client().waitFor(isVerb('EVENT', 'live'))
      ).resolves.toStrictEqual(['EVENT', 'live', event])
    })

    it('keeps only the newest replaceable event per pubkey and kind', async () => {
      const older = makeEvent({
        created_at: BASE_CREATED_AT,
        kind: METADATA_KIND
      })
      const newer = makeEvent({
        created_at: BASE_CREATED_AT + 1,
        kind: METADATA_KIND
      })
      const relayList = makeEvent({ kind: RELAY_LIST_KIND })
      const newerRelayList = makeEvent({
        created_at: relayList.created_at + 1,
        kind: RELAY_LIST_KIND
      })
      const stale = makeEvent({
        created_at: BASE_CREATED_AT - 1,
        kind: METADATA_KIND
      })

      relay().seed([older, newer, relayList, newerRelayList])
      client().send(['EVENT', stale])

      await expect(
        client().waitFor(isVerb('OK', stale.id))
      ).resolves.toStrictEqual([
        'OK',
        stale.id,
        true,
        'duplicate: have a newer version'
      ])
      expect(storedIds(relay()).toSorted()).toStrictEqual(
        [newer.id, newerRelayList.id].toSorted()
      )
    })

    it('replaces addressable events by d-tag', () => {
      const first = makeEvent({ kind: APP_DATA_KIND, tags: [['d', 'a']] })
      const otherTag = makeEvent({ kind: APP_DATA_KIND, tags: [['d', 'b']] })
      const replacement = makeEvent({ kind: APP_DATA_KIND, tags: [['d', 'a']] })

      relay().seed([first, otherTag, replacement])

      expect(storedIds(relay()).toSorted()).toStrictEqual(
        [otherTag.id, replacement.id].toSorted()
      )
    })

    it('deletes referenced events only when the deletion has the same author', () => {
      const own = makeEvent()
      const foreign = makeEvent({ pubkey: fixturePubkey(2) })
      const deletion = makeEvent({
        kind: DELETION_KIND,
        tags: [
          ['e', own.id],
          ['e', foreign.id]
        ]
      })

      relay().seed([own, foreign, deletion])

      expect(storedIds(relay()).toSorted()).toStrictEqual(
        [foreign.id, deletion.id].toSorted()
      )
    })
  })

  describe('signature verification', () => {
    it('rejects unsigned events and accepts signed ones when enabled', async () => {
      const strict = await startTestRelay({ verifySignatures: true })
      const strictClient = await connectRawClient(strict.url)
      const secretKey = generateSecretKey()
      const signed = finalizeEvent(
        { content: 'signed', created_at: BASE_CREATED_AT, kind: 1, tags: [] },
        secretKey
      )
      const forged = makeEvent({ pubkey: getPublicKey(secretKey) })

      strictClient.send(['EVENT', forged])
      strictClient.send(['EVENT', signed])

      await expect(
        strictClient.waitFor(isVerb('OK', forged.id))
      ).resolves.toStrictEqual([
        'OK',
        forged.id,
        false,
        'invalid: bad signature'
      ])
      await expect(
        strictClient.waitFor(isVerb('OK', signed.id))
      ).resolves.toStrictEqual(['OK', signed.id, true, ''])
      await strictClient.close()
      await strict.stop()
    })
  })

  describe('faults', () => {
    it('refuse rejects the websocket upgrade', async () => {
      relay().setFault({ type: 'refuse' })
      const socket = new WebSocket(relay().url)

      const statusCode = await new Promise((resolve) => {
        socket.on('unexpected-response', (_request, response) =>
          resolve(response.statusCode)
        )
        socket.on('error', () => undefined)
      })

      expect(statusCode).toBe(REFUSED_STATUS_CODE)
      expect(relay().connectionCount()).toBe(1)
      socket.terminate()
    })

    it('neverEose withholds EOSE but still delivers stored events', async () => {
      const stored = makeEvent()
      relay().seed([stored])
      relay().setFault({ type: 'neverEose' })
      client().send(['REQ', 'stuck', { kinds: [TEXT_NOTE_KIND] }])
      await client().waitFor(isVerb('EVENT', 'stuck'))
      relay().setFault(null)

      await client().query('probe', [{ ids: [] }])

      expect(client().received().some(isVerb('EOSE', 'stuck'))).toBe(false)
      expect(relay().openSubscriptions()[0]?.subIds).toContain('stuck')
    })

    it('delayEose sends EOSE only after the delay', async () => {
      relay().setFault({ ms: EOSE_DELAY_MS, type: 'delayEose' })
      const startedAt = Date.now()

      await client().query('slow', [{ kinds: [TEXT_NOTE_KIND] }])

      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(EOSE_DELAY_MS)
    })

    it('dropAfter terminates the socket after n events', async () => {
      relay().seed([makeEvent(), makeEvent(), makeEvent()])
      relay().setFault({ events: 2, type: 'dropAfter' })

      client().send(['REQ', 'drop', { kinds: [TEXT_NOTE_KIND] }])
      await client().closed

      const received = client().received()
      expect(received.filter(isVerb('EVENT', 'drop'))).toHaveLength(2)
      expect(received.some(isVerb('EOSE', 'drop'))).toBe(false)
    })

    it('closed answers REQ with CLOSED and keeps no subscription', async () => {
      relay().setFault({ reason: 'auth-required: test', type: 'closed' })

      client().send(['REQ', 'denied', { kinds: [TEXT_NOTE_KIND] }])

      await expect(
        client().waitFor(isVerb('CLOSED', 'denied'))
      ).resolves.toStrictEqual(['CLOSED', 'denied', 'auth-required: test'])
      expect(relay().openSubscriptions()[0]?.subIds).toStrictEqual([])
      expect(relay().reqLog()).toHaveLength(1)
    })

    it('rejectPublish answers OK false and stores nothing', async () => {
      relay().setFault({ reason: 'blocked: test', type: 'rejectPublish' })
      const event = makeEvent()

      client().send(['EVENT', event])

      await expect(
        client().waitFor(isVerb('OK', event.id))
      ).resolves.toStrictEqual(['OK', event.id, false, 'blocked: test'])
      expect(relay().events()).toStrictEqual([])
    })

    it('disconnectAll drops every client', async () => {
      relay().disconnectAll()

      await client().closed

      expect(relay().connectionCount()).toBe(0)
    })
  })
})
