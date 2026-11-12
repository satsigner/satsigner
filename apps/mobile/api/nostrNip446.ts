import {
  finalizeEvent,
  type NostrEvent,
  type VerifiedEvent,
  verifyEvent
} from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import {
  getConversationKey,
  decrypt as nip44Decrypt,
  encrypt as nip44Encrypt
} from 'nostr-tools/nip44'

import {
  NOSTR_NIP46_HANDLED_EVENTS_LIMIT,
  NOSTR_NIP46_LIVENESS_INTERVAL_MS,
  NOSTR_NIP46_PROBE_FILTER,
  NOSTR_NIP46_PROBE_TIMEOUT_MS,
  NOSTR_NIP46_RECONNECT_BASE_MS,
  NOSTR_NIP46_RECONNECT_MAX_MS,
  NOSTR_NIP46_STABLE_CONNECTION_MS,
  NOSTR_NIP46_SUBSCRIPTION_LOOKBACK_SECONDS,
  NOSTR_PUBLISH_TIMEOUT_MS,
  NOSTR_WS_CONNECT_TIMEOUT_MS
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { Nip46IncomingRequest } from '@/types/models/Nostr'
import { parseNip46Request } from '@/utils/nip46'
import { parseNostrEvent } from '@/utils/nostrEvent'

type OnRequestCallback = (request: Nip46IncomingRequest) => void

// Every relay delivers the same request, and a session restarted on unlock
// gets a new service whose lookback window delivers it again, so handled
// requests are kept across instances. Only a request a session decrypted is
// recorded, which keeps one session from hiding another's.
const handledEventIds = new Set<string>()

function markEventHandled(eventId: string) {
  handledEventIds.add(eventId)
  if (handledEventIds.size <= NOSTR_NIP46_HANDLED_EVENTS_LIMIT) {
    return
  }
  const [oldest] = handledEventIds
  handledEventIds.delete(oldest)
}

// Relays may ignore the subscription filter, so the author is checked again
// and the signature verified before the signer acts on a request.
function readClientRequest(
  event: NostrEvent,
  clientPubkey: string,
  conversationKey: Uint8Array
): Nip46IncomingRequest | null {
  if (
    event.kind !== nostrKinds.NostrConnect ||
    event.pubkey !== clientPubkey ||
    !verifyEvent(event)
  ) {
    return null
  }
  try {
    return parseNip46Request(
      JSON.parse(nip44Decrypt(event.content, conversationKey))
    )
  } catch {
    return null
  }
}

function subscribeOnSocket(
  ws: WebSocket,
  subId: string,
  filter: Record<string, unknown>,
  onEvent: (event: NostrEvent) => void
): void {
  ws.send(JSON.stringify(['REQ', subId, filter]))

  ws.addEventListener('message', (msg) => {
    try {
      const data: unknown = JSON.parse(String(msg.data))
      if (!Array.isArray(data) || data[0] !== 'EVENT' || data[1] !== subId) {
        return
      }
      const event = parseNostrEvent(data[2])
      if (event) {
        onEvent(event)
      }
    } catch {
      // ignore parse errors
    }
  })
}

function publishOnSocket(
  ws: WebSocket,
  event: VerifiedEvent
): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false

    function settle(result: boolean): void {
      if (done) {
        return
      }
      done = true
      resolve(result)
    }

    const timer = setTimeout(() => settle(false), NOSTR_PUBLISH_TIMEOUT_MS)

    function handleMessage(msg: MessageEvent): void {
      try {
        const data = JSON.parse(String(msg.data))
        if (Array.isArray(data) && data[0] === 'OK' && data[1] === event.id) {
          clearTimeout(timer)
          const ok = data[2] === true
          ws.removeEventListener('message', handleMessage)
          settle(ok)
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.addEventListener('message', handleMessage)
    ws.send(JSON.stringify(['EVENT', event]))
  })
}

type Nip46Subscription = {
  filter: Record<string, unknown>
  onEvent: (event: NostrEvent) => void
}

type RelayLink = {
  /** When the relay last sent anything; a reconnect asks again from here. */
  lastHeardAtMs: number
  openedAtMs: number
  url: string
}

type Nip46BunkerServiceOptions = {
  /** Called when the bunker loses its last relay, and when it gets one back. */
  onConnectionChange?: (isConnected: boolean) => void
}

function openRelaySocket(url: string): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url)

    let settled = false
    const timer = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      reject(new Error(`timeout: ${url}`))
    }, NOSTR_WS_CONNECT_TIMEOUT_MS)

    ws.addEventListener('open', () => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      resolve(ws)
    })
    ws.addEventListener('error', () => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      reject(new Error(`error: ${url}`))
    })
  })
}

function reconnectDelayMs(attempt: number) {
  return Math.min(
    NOSTR_NIP46_RECONNECT_BASE_MS * 2 ** attempt,
    NOSTR_NIP46_RECONNECT_MAX_MS
  )
}

function nowSeconds() {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

/**
 * Answers a paired client's requests on its relays. A relay that drops, that
 * stops answering, or that could not be reached at the start is tried again
 * with a growing delay until the bunker is disconnected, and asked again for
 * the requests sent while it was away.
 */
export class Nip46BunkerService {
  private sockets: WebSocket[] = []
  private conversationKey: Uint8Array | null = null
  private active = false
  private subId = `nip46-${Date.now()}`
  private probeId = `nip46-probe-${Date.now()}`
  private subscription: Nip46Subscription | null = null
  private links = new Map<WebSocket, RelayLink>()
  private failedOpens = new Map<string, number>()
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private probeTimers = new Set<ReturnType<typeof setTimeout>>()
  private livenessTimer: ReturnType<typeof setInterval> | null = null
  private readonly onConnectionChange?: (isConnected: boolean) => void

  constructor({ onConnectionChange }: Nip46BunkerServiceOptions = {}) {
    this.onConnectionChange = onConnectionChange
  }

  async connect(relays: string[]): Promise<void> {
    const startedAt = nowSeconds()
    const results = await Promise.allSettled(relays.map(openRelaySocket))

    // A relay can open and drop again before the slowest one settles.
    const openSockets = results.map((result) =>
      result.status === 'fulfilled' &&
      result.value.readyState === WebSocket.OPEN
        ? result.value
        : null
    )
    for (const [index, ws] of openSockets.entries()) {
      if (ws) {
        this.watchSocket(relays[index], ws)
      }
    }

    if (this.sockets.length === 0) {
      throw new Error('Failed to connect to any relay')
    }
    this.active = true
    this.livenessTimer = setInterval(
      () => this.probeQuietRelays(),
      NOSTR_NIP46_LIVENESS_INTERVAL_MS
    )
    for (const [index, ws] of openSockets.entries()) {
      if (!ws) {
        this.scheduleReconnect(relays[index], startedAt)
      }
    }
  }

  private watchSocket(url: string, ws: WebSocket, since?: number): void {
    const openedAtMs = Date.now()
    const link: RelayLink = { lastHeardAtMs: openedAtMs, openedAtMs, url }
    this.sockets.push(ws)
    this.links.set(ws, link)
    ws.addEventListener('message', () => {
      link.lastHeardAtMs = Date.now()
    })
    ws.addEventListener('close', () => this.dropSocket(ws))
    if (!this.subscription) {
      return
    }
    const filter =
      since === undefined
        ? this.subscription.filter
        : { ...this.subscription.filter, since }
    subscribeOnSocket(ws, this.subId, filter, this.subscription.onEvent)
  }

  private dropSocket(ws: WebSocket): void {
    const link = this.links.get(ws)
    // disconnect() closes the sockets itself.
    if (!this.active || !link) {
      return
    }
    this.links.delete(ws)
    this.sockets = this.sockets.filter((socket) => socket !== ws)
    if (this.sockets.length === 0) {
      this.onConnectionChange?.(false)
    }
    // A relay that accepts and then closes again (full, rate limited) waits
    // longer each time; one that held for a while starts over.
    const wasStable =
      Date.now() - link.openedAtMs >= NOSTR_NIP46_STABLE_CONNECTION_MS
    this.failedOpens.set(
      link.url,
      wasStable ? 0 : (this.failedOpens.get(link.url) ?? 0) + 1
    )
    this.scheduleReconnect(
      link.url,
      Math.floor(link.lastHeardAtMs / MS_PER_SECOND)
    )
  }

  // A relay that vanished without closing the socket (host down, NAT entry
  // gone) never sends `close`: a relay quiet for a while is asked for a
  // subscription that matches nothing, and dropped if it does not answer.
  private probeQuietRelays(): void {
    const now = Date.now()
    for (const [ws, link] of this.links) {
      if (now - link.lastHeardAtMs < NOSTR_NIP46_LIVENESS_INTERVAL_MS) {
        continue
      }
      try {
        ws.send(JSON.stringify(['REQ', this.probeId, NOSTR_NIP46_PROBE_FILTER]))
      } catch {
        this.closeDeadSocket(ws)
        continue
      }
      const timer = setTimeout(() => {
        this.probeTimers.delete(timer)
        if (link.lastHeardAtMs < now) {
          this.closeDeadSocket(ws)
        }
      }, NOSTR_NIP46_PROBE_TIMEOUT_MS)
      this.probeTimers.add(timer)
    }
  }

  private closeDeadSocket(ws: WebSocket): void {
    this.dropSocket(ws)
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }

  private scheduleReconnect(url: string, droppedAtSeconds: number): void {
    if (!this.active || this.reconnectTimers.has(url)) {
      return
    }
    const timer = setTimeout(
      () => {
        this.reconnectTimers.delete(url)
        void this.reconnect(url, droppedAtSeconds)
      },
      reconnectDelayMs(this.failedOpens.get(url) ?? 0)
    )
    this.reconnectTimers.set(url, timer)
  }

  private async reconnect(
    url: string,
    droppedAtSeconds: number
  ): Promise<void> {
    const ws = await openRelaySocket(url).catch(() => null)
    if (!this.active) {
      ws?.close()
      return
    }
    if (!ws) {
      this.failedOpens.set(url, (this.failedOpens.get(url) ?? 0) + 1)
      this.scheduleReconnect(url, droppedAtSeconds)
      return
    }
    const wasDisconnected = this.sockets.length === 0
    // Requests sent while the relay was away; the handled ids drop repeats.
    this.watchSocket(
      url,
      ws,
      droppedAtSeconds - NOSTR_NIP46_SUBSCRIPTION_LOOKBACK_SECONDS
    )
    if (wasDisconnected) {
      this.onConnectionChange?.(true)
    }
  }

  subscribe(
    signerPubkeyHex: string,
    signerSecretKey: Uint8Array,
    clientPubkey: string,
    onRequest: OnRequestCallback
  ): void {
    const convKey = getConversationKey(signerSecretKey, clientPubkey)
    this.conversationKey = convKey

    const filter = {
      '#p': [signerPubkeyHex],
      authors: [clientPubkey],
      kinds: [nostrKinds.NostrConnect],
      since: nowSeconds() - NOSTR_NIP46_SUBSCRIPTION_LOOKBACK_SECONDS
    }
    function onEvent(event: NostrEvent) {
      if (handledEventIds.has(event.id)) {
        return
      }
      const request = readClientRequest(event, clientPubkey, convKey)
      if (!request) {
        return
      }
      markEventHandled(event.id)
      onRequest(request)
    }
    this.subscription = { filter, onEvent }
    for (const ws of this.sockets) {
      subscribeOnSocket(ws, this.subId, filter, onEvent)
    }
  }

  async sendResponse(
    clientPubkey: string,
    signerSecretKey: Uint8Array,
    responsePayload: string
  ): Promise<void> {
    if (this.sockets.length === 0) {
      throw new Error('No connected relays')
    }

    if (!this.conversationKey) {
      this.conversationKey = getConversationKey(signerSecretKey, clientPubkey)
    }

    const encrypted = nip44Encrypt(responsePayload, this.conversationKey)

    const event = finalizeEvent(
      {
        content: encrypted,
        created_at: Math.floor(Date.now() / MS_PER_SECOND),
        kind: nostrKinds.NostrConnect,
        tags: [['p', clientPubkey]]
      },
      signerSecretKey
    )
    const publishResults = await Promise.allSettled(
      this.sockets.map((ws) => publishOnSocket(ws, event))
    )

    const succeeded = publishResults.filter(
      (r) => r.status === 'fulfilled' && r.value === true
    ).length
    if (succeeded === 0) {
      throw new Error('Failed to publish to any relay')
    }
  }

  disconnect(): void {
    this.active = false
    if (this.livenessTimer) {
      clearInterval(this.livenessTimer)
      this.livenessTimer = null
    }
    for (const timer of [
      ...this.reconnectTimers.values(),
      ...this.probeTimers
    ]) {
      clearTimeout(timer)
    }
    this.reconnectTimers.clear()
    this.probeTimers.clear()
    this.links.clear()
    this.failedOpens.clear()
    for (const ws of this.sockets) {
      try {
        ws.send(JSON.stringify(['CLOSE', this.subId]))
        ws.close()
      } catch {
        // ignore
      }
    }
    this.sockets = []
    this.conversationKey = null
    this.subscription = null
  }

  isConnected(): boolean {
    return (
      this.active && this.sockets.some((ws) => ws.readyState === WebSocket.OPEN)
    )
  }
}
