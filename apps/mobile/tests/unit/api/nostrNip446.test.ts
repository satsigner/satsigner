import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { encrypt, getConversationKey } from 'nostr-tools/nip44'

import { Nip46BunkerService } from '@/api/nostrNip446'
import {
  NOSTR_NIP46_LIVENESS_INTERVAL_MS,
  NOSTR_NIP46_PROBE_FILTER,
  NOSTR_NIP46_PROBE_TIMEOUT_MS,
  NOSTR_NIP46_RECONNECT_BASE_MS,
  NOSTR_NIP46_RECONNECT_MAX_MS,
  NOSTR_NIP46_STABLE_CONNECTION_MS,
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
  // Relays that refuse the connection, and relays that close right after.
  static unreachable = new Set<string>()
  static dropOnOpen = new Set<string>()

  readonly url: string
  readyState = OPEN
  sent: unknown[] = []
  private listeners = new Map<string, Listener[]>()

  constructor(url: string) {
    this.url = url
    FakeRelaySocket.created.push(this)
    queueMicrotask(() => this.connectFake())
  }

  private connectFake() {
    if (FakeRelaySocket.unreachable.has(this.url)) {
      this.readyState = CLOSED
      this.emit('error', '')
      return
    }
    this.emit('open', '')
    if (FakeRelaySocket.dropOnOpen.has(this.url)) {
      this.readyState = CLOSED
      this.emit('close', '')
    }
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

// Every service is disconnected after its test, so no relay timer outlives it.
const startedServices: Nip46BunkerService[] = []

function stopServices() {
  for (const service of startedServices.splice(0)) {
    service.disconnect()
  }
}

async function startBunker(
  relays: string[],
  clientSecretKey: Uint8Array,
  onRequest: jest.Mock
) {
  const service = new Nip46BunkerService()
  startedServices.push(service)
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
    stopServices()
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
    FakeRelaySocket.unreachable.clear()
    FakeRelaySocket.dropOnOpen.clear()
    Reflect.set(globalThis, 'WebSocket', FakeRelaySocket)
  })

  afterEach(() => {
    stopServices()
    jest.useRealTimers()
    Reflect.set(globalThis, 'WebSocket', realWebSocket)
  })

  async function startWatchedBunker(
    relays = [RELAY_A],
    onConnectionChange = jest.fn()
  ) {
    const clientSecretKey = generateSecretKey()
    const onRequest = jest.fn()
    const service = new Nip46BunkerService({ onConnectionChange })
    startedServices.push(service)
    await service.connect(relays)
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

  function socketsFor(url: string) {
    return FakeRelaySocket.created.filter((socket) => socket.url === url)
  }

  it('reconnects a dropped relay and takes the requests sent meanwhile', async () => {
    const { clientSecretKey, onRequest, service } = await startWatchedBunker()
    const [first] = FakeRelaySocket.created
    first.emit('message', '["EOSE","x"]')
    const heardAt = Math.floor(Date.now() / MS_PER_SECOND)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_STABLE_CONNECTION_MS)

    dropRelay(first)
    expect(service.isConnected()).toBe(false)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)

    const [, second] = socketsFor(RELAY_A)
    expect(second.subscriptionFilter()).toMatchObject({
      since: heardAt - NOSTR_NIP46_SUBSCRIPTION_LOOKBACK_SECONDS
    })
    second.deliver(requestFrom(clientSecretKey, 'after-drop'))
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'after-drop' })
    )
    expect(service.isConnected()).toBe(true)
  })

  it('reports losing the last relay and getting it back', async () => {
    const onConnectionChange = jest.fn()
    await startWatchedBunker([RELAY_A], onConnectionChange)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_STABLE_CONNECTION_MS)

    dropRelay(FakeRelaySocket.created[0])
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)

    expect(onConnectionChange.mock.calls).toStrictEqual([[false], [true]])
  })

  it('waits longer each time a relay drops right after it opens', async () => {
    await startWatchedBunker()

    dropRelay(FakeRelaySocket.created[0])
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)
    expect(socketsFor(RELAY_A)).toHaveLength(1)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)
    expect(socketsFor(RELAY_A)).toHaveLength(2)

    dropRelay(socketsFor(RELAY_A)[1])
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS * 3)
    expect(socketsFor(RELAY_A)).toHaveLength(2)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)
    expect(socketsFor(RELAY_A)).toHaveLength(3)
  })

  it('reconnects a relay that stops answering without closing', async () => {
    const onConnectionChange = jest.fn()
    await startWatchedBunker([RELAY_A], onConnectionChange)

    await jest.advanceTimersByTimeAsync(
      NOSTR_NIP46_LIVENESS_INTERVAL_MS + NOSTR_NIP46_PROBE_TIMEOUT_MS
    )

    const [first] = socketsFor(RELAY_A)
    expect(first.sent).toContainEqual([
      'REQ',
      expect.any(String),
      NOSTR_NIP46_PROBE_FILTER
    ])
    expect(onConnectionChange).toHaveBeenCalledWith(false)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_MAX_MS)
    expect(socketsFor(RELAY_A).length).toBeGreaterThan(1)
  })

  it('keeps a quiet relay that answers the probe', async () => {
    const onConnectionChange = jest.fn()
    await startWatchedBunker([RELAY_A], onConnectionChange)
    const [socket] = FakeRelaySocket.created

    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_LIVENESS_INTERVAL_MS)
    socket.emit('message', '["EOSE","probe"]')
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_PROBE_TIMEOUT_MS)

    expect(onConnectionChange).not.toHaveBeenCalled()
    expect(FakeRelaySocket.created).toHaveLength(1)
  })

  it('retries a relay that could not be reached at the start', async () => {
    FakeRelaySocket.unreachable.add(RELAY_B)
    await startWatchedBunker([RELAY_A, RELAY_B])
    FakeRelaySocket.unreachable.clear()

    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)

    expect(socketsFor(RELAY_B)).toHaveLength(2)
    expect(socketsFor(RELAY_B)[1].subscriptionFilter()).not.toBeNull()
  })

  it('retries a relay that dropped while another was still connecting', async () => {
    FakeRelaySocket.dropOnOpen.add(RELAY_B)
    const { service } = await startWatchedBunker([RELAY_A, RELAY_B])
    FakeRelaySocket.dropOnOpen.clear()

    expect(service.isConnected()).toBe(true)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS)

    expect(socketsFor(RELAY_B)).toHaveLength(2)
  })

  it('stops trying once the bunker is disconnected', async () => {
    const { service } = await startWatchedBunker()

    dropRelay(FakeRelaySocket.created[0])
    service.disconnect()
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_MAX_MS)

    expect(FakeRelaySocket.created).toHaveLength(1)
  })

  it('closes a relay that opens after the bunker was disconnected', async () => {
    const { service } = await startWatchedBunker()
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_STABLE_CONNECTION_MS)

    dropRelay(FakeRelaySocket.created[0])
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_BASE_MS - 1)
    const opening = jest.advanceTimersByTimeAsync(1)
    service.disconnect()
    await opening

    expect(socketsFor(RELAY_A).at(-1)?.readyState).toBe(CLOSED)
    expect(service.isConnected()).toBe(false)
  })

  it('does not reconnect a relay it closed itself', async () => {
    const onConnectionChange = jest.fn()
    const { service } = await startWatchedBunker([RELAY_A], onConnectionChange)
    const [socket] = FakeRelaySocket.created

    service.disconnect()
    dropRelay(socket)
    await jest.advanceTimersByTimeAsync(NOSTR_NIP46_RECONNECT_MAX_MS)

    expect(FakeRelaySocket.created).toHaveLength(1)
    expect(onConnectionChange).not.toHaveBeenCalled()
  })
})
