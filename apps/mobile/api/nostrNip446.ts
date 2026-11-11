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

export class Nip46BunkerService {
  private sockets: WebSocket[] = []
  private conversationKey: Uint8Array | null = null
  private active = false
  private subId = `nip46-${Date.now()}`

  async connect(relays: string[]): Promise<void> {
    const results = await Promise.allSettled(
      relays.map(
        (url) =>
          new Promise<WebSocket>((resolve, reject) => {
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
      )
    )

    for (const [, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        this.sockets.push(result.value)
      }
    }

    if (this.sockets.length === 0) {
      throw new Error('Failed to connect to any relay')
    }
    this.active = true
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
      since:
        Math.floor(Date.now() / MS_PER_SECOND) -
        NOSTR_NIP46_SUBSCRIPTION_LOOKBACK_SECONDS
    }
    for (const ws of this.sockets) {
      subscribeOnSocket(ws, this.subId, filter, (event) => {
        if (handledEventIds.has(event.id)) {
          return
        }
        const request = readClientRequest(event, clientPubkey, convKey)
        if (!request) {
          return
        }
        markEventHandled(event.id)
        onRequest(request)
      })
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
    this.active = false
  }

  isConnected(): boolean {
    return (
      this.active && this.sockets.some((ws) => ws.readyState === WebSocket.OPEN)
    )
  }
}
