import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { encrypt, getConversationKey } from 'nostr-tools/nip44'

import { Nip46BunkerService } from '@/api/nostrNip446'
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
