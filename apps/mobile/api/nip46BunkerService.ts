import { finalizeEvent, type NostrEvent, type VerifiedEvent } from 'nostr-tools'
import {
  decrypt as nip44Decrypt,
  encrypt as nip44Encrypt,
  getConversationKey
} from 'nostr-tools/nip44'

import { NIP46_EVENT_KIND } from '@/constants/nip46'

const WS_CONNECT_TIMEOUT_MS = 15_000
const PUBLISH_TIMEOUT_MS = 10_000

type Nip46IncomingRequest = {
  id: string
  method: string
  params: string[]
}

type OnRequestCallback = (request: Nip46IncomingRequest) => void

// Module-level dedup to rule out any `this` binding issues
const globalSeenEvents = new Set<string>()

function subscribeOnSocket(
  ws: WebSocket,
  subId: string,
  filter: Record<string, unknown>,
  onEvent: (event: NostrEvent) => void
): void {
  ws.send(JSON.stringify(['REQ', subId, filter]))

  ws.addEventListener('message', (msg) => {
    try {
      const data = JSON.parse(String(msg.data))
      if (
        Array.isArray(data) &&
        data[0] === 'EVENT' &&
        data[1] === subId &&
        data[2]
      ) {
        onEvent(data[2] as NostrEvent)
      }
      if (Array.isArray(data) && data[0] === 'EOSE' && data[1] === subId) {
        // EOSE received, subscription is caught up
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

    const timer = setTimeout(() => settle(false), PUBLISH_TIMEOUT_MS)

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
  private relays: string[] = []
  private conversationKey: Uint8Array | null = null
  private active = false
  private subId = `nip46-${Date.now()}`

  async connect(relays: string[]): Promise<void> {
    this.relays = relays

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
            }, WS_CONNECT_TIMEOUT_MS)

            ws.addEventListener('open', () => {
              if (settled) {
                return
              }
              settled = true
              clearTimeout(timer)
              resolve(ws)
            })
            ws.addEventListener('error', (ev) => {
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
            ws.addEventListener('close', () => {
              // socket closed
            })
          })
      )
    )

    for (const [i, result] of results.entries()) {
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
      kinds: [NIP46_EVENT_KIND],
      since: Math.floor(Date.now() / 1000) - 10
    }
    for (const ws of this.sockets) {
      subscribeOnSocket(ws, this.subId, filter, (event) => {
        // Dedup by event ID using module-level Set
        if (globalSeenEvents.has(event.id)) {
          return
        }
        globalSeenEvents.add(event.id)

        try {
          const decrypted = nip44Decrypt(event.content, convKey)
          const parsed = JSON.parse(decrypted) as {
            id?: string
            method?: string
            params?: string[]
          }

          if (!parsed.id || !parsed.method) {
            return
          }

          onRequest({
            id: parsed.id,
            method: parsed.method,
            params: Array.isArray(parsed.params) ? parsed.params : []
          })
        } catch {
          // decryption failed
        }
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
        created_at: Math.floor(Date.now() / 1000),
        kind: NIP46_EVENT_KIND,
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
