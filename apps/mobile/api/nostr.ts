import type { NDKKind, NDKSubscription } from '@nostr-dev-kit/ndk'
import NDK, { NDKEvent, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk'
import {
  getPublicKey,
  nip19,
  nip44,
  nip17,
  nip59,
  type Event
} from 'nostr-tools'
import { Buffer } from 'buffer'
import * as pako from 'pako'
import * as CBOR from 'cbor-js'
import { useAccountsStore } from '@/store/accounts'

export interface NostrKeys {
  nsec: string
  npub: string
  secretNostrKey: Uint8Array
}

export interface NostrMessage {
  id: string
  content: any
  created_at: number
  decryptedContent?: string
  isSender?: boolean
  pubkey?: string
}

export class NostrAPI {
  private ndk: NDK | null = null
  private activeSubscriptions: Set<NDKSubscription> = new Set()
  private eventQueue: NostrMessage[] = []
  private isProcessingQueue = false
  private readonly BATCH_SIZE = 10
  private readonly PROCESSING_INTERVAL = 200 // ms
  private isLoading = false
  private onLoadingChange?: (isLoading: boolean) => void

  constructor(private relays: string[]) {
    if (!relays || relays.length === 0) {
      this.relays = [
        'wss://relay.damus.io',
        'wss://nostr.bitcoiner.social',
        'wss://relay.nostr.band',
        'wss://nostr.mom'
      ]
    }
  }

  setLoadingCallback(callback: (isLoading: boolean) => void) {
    this.onLoadingChange = callback
  }

  private setLoading(loading: boolean) {
    this.isLoading = loading
    this.onLoadingChange?.(loading)
  }

  async connect() {
    try {
      if (!this.ndk) {
        this.ndk = new NDK({
          explicitRelayUrls: this.relays
        })
      }

      await this.ndk.connect()

      if (!this.ndk.pool) {
        throw new Error('NDK pool not initialized')
      }

      await this.ndk.pool.connect()

      const connectedRelays = Array.from(this.ndk.pool.relays.keys())

      if (connectedRelays.length === 0) {
        throw new Error(
          'No relays could be connected. Please check your relay URLs and internet connection.'
        )
      }

      const relayStatus = await Promise.all(
        connectedRelays.map(async (url) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const relay = this.ndk?.pool.relays.get(url)
              if (!relay) {
                return { url, status: 'not_found' }
              }

              const testEvent = await this.ndk?.fetchEvent(
                { kinds: [1], limit: 1 },
                // @ts-ignore - relayUrl is used by NDK but not in types
                { relayUrl: url }
              )

              return { url, status: 'connected', testEvent: testEvent !== null }
            } catch (_error) {
              if (attempt === 2) {
                return { url, status: 'error' }
              }
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (attempt + 1))
              )
            }
          }
          return { url, status: 'error' }
        })
      )

      const workingRelays = relayStatus.filter((r) => r.status === 'connected')
      if (workingRelays.length === 0) {
        throw new Error(
          'No relays are responding. Please check your internet connection and try again.'
        )
      }

      return true
    } catch (error) {
      this.ndk = null
      throw new Error(
        'Failed to connect to relays: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    }
  }

  static async generateNostrKeys(): Promise<NostrKeys> {
    const signer = NDKPrivateKeySigner.generate()
    const user = await signer.user()
    const secretNostrKey = new Uint8Array(
      Buffer.from(signer.privateKey!, 'hex')
    )
    const nsec = nip19.nsecEncode(secretNostrKey)
    const npub = user.npub

    return {
      nsec,
      npub,
      secretNostrKey
    }
  }

  async disconnect() {
    await this.closeAllSubscriptions()
    this.ndk = null
  }

  private async processEventQueue(callback: (message: NostrMessage) => void) {
    if (this.isProcessingQueue || this.eventQueue.length === 0) return

    this.isProcessingQueue = true
    this.setLoading(true)
    try {
      while (this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, this.BATCH_SIZE)
        await Promise.all(batch.map((message) => callback(message)))
        await new Promise((resolve) =>
          setTimeout(resolve, this.PROCESSING_INTERVAL)
        )
      }
    } finally {
      this.isProcessingQueue = false
      this.setLoading(false)
    }
  }

  async subscribeToKind1059(
    recipientNsec: string,
    recipientNpub: string,
    _callback: (message: NostrMessage) => void,
    limit?: number,
    since?: number,
    onEOSE?: (nsec: string) => void
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    this.setLoading(true)
    try {
      const { data: recipientSecretNostrKey } = nip19.decode(recipientNsec)
      const { data: recipientPubKey } = nip19.decode(recipientNpub)

      const recipientPubKeyFromNsec = getPublicKey(
        recipientSecretNostrKey as Uint8Array
      )

      const TWO_DAYS = 48 * 60 * 60
      const bufferedSince = since ? since - TWO_DAYS : undefined

      const subscriptionQuery = {
        kinds: [1059 as NDKKind],
        '#p': [recipientPubKeyFromNsec, recipientPubKey.toString()],
        ...(limit && { limit }),
        since: bufferedSince
      }

      const subscription = this.ndk?.subscribe(subscriptionQuery)
      if (subscription) {
        this.activeSubscriptions.add(subscription)
      }

      subscription?.on('event', async (event) => {
        try {
          const rawEvent = await event.toNostrEvent()

          const unwrappedEvent = await nip59.unwrapEvent(
            rawEvent as unknown as Event,
            recipientSecretNostrKey as Uint8Array
          )

          const message = {
            id: unwrappedEvent.id,
            content: unwrappedEvent,
            created_at: unwrappedEvent.created_at,
            pubkey: event.pubkey
          }

          _callback(message)
        } catch (error) {
          console.error('Error processing event:', error)
        }
      })

      subscription?.on('eose', () => {
        onEOSE?.(recipientNsec)
        this.setLoading(false)
      })

      subscription?.on('close', () => {
        this.activeSubscriptions.delete(subscription)
      })
    } catch (error) {
      console.error('Error setting up subscription:', error)
      this.setLoading(false)
      throw error
    }
  }

  async closeAllSubscriptions(): Promise<void> {
    this.setLoading(false)
    for (const subscription of this.activeSubscriptions) {
      subscription.stop()
    }
    this.activeSubscriptions.clear()
    this.eventQueue = []
    this.isProcessingQueue = false
  }

  async createKind1059(
    nsec: string,
    recipientNpub: string,
    content: string
  ): Promise<NDKEvent> {
    const { data: secretNostrKey } = nip19.decode(nsec)
    const recipientPubkey = nip19.decode(recipientNpub) as { data: string }
    const encodedContent = unescape(encodeURIComponent(content))
    const wrap = nip17.wrapEvent(
      secretNostrKey as Uint8Array,
      { publicKey: recipientPubkey.data },
      encodedContent
    )
    const tempNdk = new NDK()
    const event = new NDKEvent(tempNdk, wrap)
    return event
  }

  async publishEvent(event: NDKEvent): Promise<void> {
    try {
      if (!this.ndk) {
        await this.connect()
      }
      if (!this.ndk) {
        throw new Error('Failed to initialize NDK')
      }

      const connectedRelays = Array.from(this.ndk.pool.relays.keys())

      if (event.ndk !== this.ndk) {
        event.ndk = this.ndk
      }
      if (!event.sig) {
        const signer = this.ndk.signer
        if (!signer) {
          throw new Error('No signer available for event')
        }
        await event.sign(signer)
      }

      let published = false
      for (let i = 0; i < 3; i++) {
        try {
          const publishPromises = connectedRelays.map(async (url) => {
            try {
              const relay = this.ndk?.pool.relays.get(url)
              if (!relay) {
                return { url, success: false, error: 'Relay not found' }
              }

              await relay.publish(event)
              return { url, success: true }
            } catch (error) {
              return { url, success: false, error }
            }
          })
          const results = await Promise.all(publishPromises)
          const successfulPublishes = results.filter((r) => r.success)
          if (successfulPublishes.length > 0) {
            published = true
            break
          }
        } catch (_err) {
          if (i < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }
      }

      if (!published) {
        throw new Error('Failed to publish after 3 attempts')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to publish event: ${errorMessage}`)
    }
  }
}

const BASE85 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~'

function base85Encode(buf: Buffer): string {
  const pad = (4 - (buf.length % 4)) % 4
  const data = pad
    ? Buffer.concat([buf, Buffer.alloc(pad)], buf.length + pad)
    : buf

  let out = ''
  for (let i = 0; i < data.length; i += 4) {
    let acc = data.readUInt32BE(i)
    let chunk = ''
    for (let j = 0; j < 5; j++) {
      chunk = BASE85[acc % 85] + chunk
      acc = Math.floor(acc / 85)
    }
    out += chunk
  }
  return pad ? out.slice(0, out.length - pad) : out
}

const BASE85_DECODE = Object.fromEntries(
  BASE85.split('').map((ch, i) => [ch, i])
)

function base85Decode(str: string): Buffer {
  const len = str.length
  const rem = len % 5
  if (rem === 1) {
    throw new Error(`Invalid Base85 string length: mod 5 = ${rem}`)
  }
  const padChars = rem ? 5 - rem : 0
  const padBytes = padChars

  const padChar = BASE85[84]
  const full = padChars ? str + padChar.repeat(padChars) : str

  const out = []
  for (let i = 0; i < full.length; i += 5) {
    let acc = 0
    for (let j = 0; j < 5; j++) {
      const ch = full[i + j]
      const val = BASE85_DECODE[ch]
      if (val === undefined) {
        throw new Error(`Invalid character '${ch}' at position ${i + j}`)
      }
      acc = acc * 85 + val
    }
    out.push((acc >>> 24) & 0xff)
    out.push((acc >>> 16) & 0xff)
    out.push((acc >>> 8) & 0xff)
    out.push(acc & 0xff)
  }

  return Buffer.from(out.slice(0, out.length - padBytes))
}

export function compressMessage(data: any): string {
  try {
    const cborData = CBOR.encode(data)
    const jsonUint8 = new Uint8Array(cborData)

    const compressedData = pako.deflate(jsonUint8)
    const compressedBuffer = Buffer.from(compressedData)
    return base85Encode(compressedBuffer)
  } catch (_error) {
    throw new Error('Failed to compress data')
  }
}

export function decompressMessage(compressedString: string): any {
  try {
    const compressedBytes = base85Decode(compressedString)
    const cborBytes = pako.inflate(new Uint8Array(compressedBytes))
    const bufferSlice = cborBytes.buffer.slice(
      cborBytes.byteOffset,
      cborBytes.byteOffset + cborBytes.byteLength
    )
    return CBOR.decode(bufferSlice as unknown as Uint8Array)
  } catch (err) {
    throw new Error(
      'Failed to decompress message: ' +
        (err instanceof Error ? err.message : 'Unknown error')
    )
  }
}
