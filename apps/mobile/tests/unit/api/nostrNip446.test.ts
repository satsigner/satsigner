import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { encrypt, getConversationKey } from 'nostr-tools/nip44'

import { Nip46BunkerService } from '@/api/nostrNip446'
import {
  NOSTR_NIP46_RECONNECT_BASE_MS,
  NOSTR_NIP46_RECONNECT_MAX_MS,
  NOSTR_NIP46_SUBSCRIPTION_LOOKBACK_SECONDS
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'

// The shared manual mock stubs getPublicKey, which the NIP-44 keys rely on.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

type Listener = (message: { data: string }) => void

const OPEN = 1
const CLOSED = 3
const RELAY_A = 'wss://relay-a.example'
const RELAY_B = 'wss://relay-b.example'

class FakeRelaySocket {
  static readonly OPEN = OPEN
  static created: FakeRelaySocket[] = []

  readonly url: string
  readyState = OPEN
  sent: unknown[] = []
  private listeners = new Map<string, Listener[]>()

  constructor(url: string) {
    this.url = url
    FakeRelaySocket.created.push(this)
    queueMicrotask(() => this.emit('open', ''))
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item !== listener)
    )
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.readyState = CLOSED
  }

  emit(type: string, data: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data })
    }
  }

  subscriptionId() {
    const request = this.sent.find(
      (frame) => Array.isArray(frame) && frame[0] === 'REQ'
    )
    return Array.isArray(request) ? String(request[1]) : ''
  }

  subscriptionFilter(): unknown {
    const request = this.sent.find(
      (frame) => Array.isArray(frame) && frame[0] === 'REQ'
    )
    return Array.isArray(request) ? request[2] : null
  }

  deliver(event: object) {
    this.emit(
      'message',
      JSON.stringify(['EVENT', this.subscriptionId(), event])
    )
  }
}

const signerSecretKey = generateSecretKey()
const signerPubkey = getPublicKey(signerSecretKey)

function requestFrom(clientSecretKey: Uint8Array, id: string) {
  const conversationKey = getConversationKey(clientSecretKey, signerPubkey)
  return finalizeEvent(
    {
      content: encrypt(
        JSON.stringify({ id, method: 'get_public_key', params: [] }),
        conversationKey
      ),
      created_at: Math.floor(Date.now() / MS_PER_SECOND),
      kind: nostrKinds.NostrConnect,
      tags: [['p', signerPubkey]]
    },
    clientSecretKey
  )
}

async function startBunker(
  relays: string[],
  clientSecretKey: Uint8Array,
  onRequest: jest.Mock
) {
  const service = new Nip46BunkerService()
  const firstSocket = FakeRelaySocket.created.length
  await service.connect(relays)
  service.subscribe(
    signerPubkey,
    signerSecretKey,
    getPublicKey(clientSecretKey),
    onRequest
  )
  return FakeRelaySocket.created.slice(firstSocket)
}

describe('nip46 bunker service', () => {
  const realWebSocket: unknown = Reflect.get(globalThis, 'WebSocket')

  beforeEach(() => {
    FakeRelaySocket.created = []
    Reflect.set(globalThis, 'WebSocket', FakeRelaySocket)
  })

  afterEach(() => {
    Reflect.set(globalThis, 'WebSocket', realWebSocket)
  })

  it('asks relays only for requests the paired client wrote', async () => {
    const clientSecretKey = generateSecretKey()
    const [socket] = await startBunker([RELAY_A], clientSecretKey, jest.fn())

    expect(socket.subscriptionFilter()).toMatchObject({
      '#p': [signerPubkey],
      authors: [getPublicKey(clientSecretKey)],
      kinds: [nostrKinds.NostrConnect]
    })
  })

  it('keeps another app on the same identity from swallowing a request', async () => {
    const clientA = generateSecretKey()
    const clientB = generateSecretKey()
    const onRequestA = jest.fn()
    const onRequestB = jest.fn()
    const [socketA] = await startBunker([RELAY_A], clientA, onRequestA)
    const [socketB] = await startBunker([RELAY_A], clientB, onRequestB)
    const request = requestFrom(clientB, 'for-b')

    socketA.deliver(request)
    socketB.deliver(request)

    expect(onRequestA).not.toHaveBeenCalled()
    expect(onRequestB).toHaveBeenCalledTimes(1)
    expect(onRequestB).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'for-b', method: 'get_public_key' })
    )
  })

  it('handles a request delivered by several relays once', async () => {
    const clientSecretKey = generateSecretKey()
    const onRequest = jest.fn()
    const sockets = await startBunker(
      [RELAY_A, RELAY_B],
      clientSecretKey,
      onRequest
    )
    const request = requestFrom(clientSecretKey, 'once')

    for (const socket of sockets) {
      socket.deliver(request)
    }

    expect(onRequest).toHaveBeenCalledTimes(1)
  })

  it('does not hand a request back to a session restarted within the lookback', async () => {
    const clientSecretKey = generateSecretKey()
    const onRequest = jest.fn()
    const request = requestFrom(clientSecretKey, 'before-lock')
    const [firstSocket] = await startBunker(
      [RELAY_A],
      clientSecretKey,
      onRequest
    )
    firstSocket.deliver(request)

    const [restartedSocket] = await startBunker(
      [RELAY_A],
      clientSecretKey,
      onRequest
    )
    restartedSocket.deliver(request)

    expect(onRequest).toHaveBeenCalledTimes(1)
  })

  it('ignores a replayed request whose id was changed', async () => {
    const clientSecretKey = generateSecretKey()
    const onRequest = jest.fn()
    const [socket] = await startBunker([RELAY_A], clientSecretKey, onRequest)
    const request = requestFrom(clientSecretKey, 'original')

    socket.deliver(request)
    socket.deliver({ ...request, id: 'f'.repeat(64) })

    expect(onRequest).toHaveBeenCalledTimes(1)
  })

  it('ignores a request with a forged signature', async () => {
    const clientSecretKey = generateSecretKey()
    const onRequest = jest.fn()
    const [socket] = await startBunker([RELAY_A], clientSecretKey, onRequest)
    const request = requestFrom(clientSecretKey, 'forged')
    const otherRequest = requestFrom(clientSecretKey, 'other')

    socket.deliver({ ...request, sig: otherRequest.sig })

    expect(onRequest).not.toHaveBeenCalled()
  })

  it('ignores a request written by another key', async () => {
    const clientSecretKey = generateSecretKey()
    const onRequest = jest.fn()
    const [socket] = await startBunker([RELAY_A], clientSecretKey, onRequest)

    socket.deliver(requestFrom(generateSecretKey(), 'stranger'))

    expect(onRequest).not.toHaveBeenCalled()
  })
})

describe('nip46 bunker relay reconnect', () => {
  const realWebSocket: unknown = Reflect.get(globalThis, 'WebSocket')

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })
    FakeRelaySocket.created = []
    Reflect.set(globalThis, 'WebSocket', FakeRelaySocket)
  })

  afterEach(() => {
    jest.useRealTimers()
    Reflect.set(globalThis, 'WebSocket', realWebSocket)
  })

  async function startWatchedBunker(onConnectionChange = jest.fn()) {
    const clientSecretKey = generateSecretKey()
    const onRequest = jest.fn()
    const service = new Nip46BunkerService({ onConnectionChange })
    await service.connect([RELAY_A])
    service.subscribe(
      signerPubkey,
      signerSecretKey,
      getPublicKey(clientSecretKey),
      onRequest
    )
    return { clientSecretKey, onRequest, service }
  }

  function dropRelay(socket: FakeRelaySocket) {
    socket.readyState = CLOSED
    socket.emit('close', '')
  }

  it('reconnects a dropped relay and takes the requests sent meanwhile', async () => {
    const { clientSecretKey, onRequest, service } = await startWatchedBunker()
    const [first] = FakeRelaySocket.created
    const droppedAt = Math.floor(Date.now() / MS_PER_SECOND)

    dropRelay(first)
    expect(service.isConnected()).toBe(false)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)

    const [, second] = FakeRelaySocket.created
    expect(second?.url).toBe(RELAY_A)
    expect(second.subscriptionFilter()).toMatchObject({
      since: droppedAt - NOSTR_NIP46_SUBSCRIPTION_LOOKBACK_SECONDS
    })
    second.deliver(requestFrom(clientSecretKey, 'after-drop'))
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'after-drop' })
    )
    expect(service.isConnected()).toBe(true)
  })

  it('reports losing the last relay and getting it back', async () => {
    const onConnectionChange = jest.fn()
    await startWatchedBunker(onConnectionChange)

    dropRelay(FakeRelaySocket.created[0])
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)

    expect(onConnectionChange.mock.calls).toStrictEqual([[false], [true]])
  })

  it('stops trying once the bunker is disconnected', async () => {
    const { service } = await startWatchedBunker()

    dropRelay(FakeRelaySocket.created[0])
    service.disconnect()
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_MAX_MS)

    expect(FakeRelaySocket.created).toHaveLength(1)
  })

  it('does not reconnect a relay it closed itself', async () => {
    const onConnectionChange = jest.fn()
    const { service } = await startWatchedBunker(onConnectionChange)
    const [socket] = FakeRelaySocket.created

    service.disconnect()
    dropRelay(socket)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_MAX_MS)

    expect(FakeRelaySocket.created).toHaveLength(1)
    expect(onConnectionChange).not.toHaveBeenCalled()
  })
})
