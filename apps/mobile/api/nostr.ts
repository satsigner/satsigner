import type { NDKKind, NDKSubscription } from '@nostr-dev-kit/ndk'
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import { Buffer } from 'buffer'
import * as CBOR from 'cbor-js'
import { type Event, nip17, nip19, nip59 } from 'nostr-tools'
import * as pako from 'pako'
import crypto from 'react-native-aes-crypto'

const POOL_SIZE = 1024 // 1KB of random values

// Create a pool of random values - initialize with empty array to avoid null
let randomPool = new Uint8Array(POOL_SIZE)
let randomPoolIndex = 0

// Synchronously initialize the random pool with Math.random
function initializeRandomPool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    randomPool[i] = Math.floor(Math.random() * 256)
  }
  randomPoolIndex = 0
}

// Initialize synchronously first
initializeRandomPool()

// Then asynchronously refill with better random values
async function refillRandomPool() {
  try {
    const randomHex = await crypto.randomKey(POOL_SIZE)
    const newPool = new Uint8Array(Buffer.from(randomHex, 'hex'))
    // Only update if we haven't used too many values
    if (randomPoolIndex < POOL_SIZE / 2) {
      randomPool = newPool
      randomPoolIndex = 0
    }
  } catch (_error) {
    // Error refilling random pool
  }
}

// Start refilling in the background
refillRandomPool()

// Extend the Crypto interface to include getRandomBase64String
declare global {
  interface Crypto {
    getRandomBase64String(length: number): Promise<string>
  }
}

// Add global crypto polyfill with getRandomBase64String
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (!array) return array
      const uint8Array = new Uint8Array(
        array.buffer,
        array.byteOffset,
        array.byteLength
      )
      for (let i = 0; i < uint8Array.length; i++) {
        uint8Array[i] = Math.floor(Math.random() * 256)
      }
      return array
    },
    getRandomBase64String: async (length: number): Promise<string> => {
      try {
        const randomHex = await crypto.randomKey(length)
        return Buffer.from(randomHex, 'hex').toString('base64')
      } catch (_error) {
        throw new Error(
          'Failed to generate secure random values: ' +
            (_error instanceof Error ? _error.message : 'Unknown error')
        )
      }
    }
  } as Crypto
}

// Ensure getRandomBase64String is available even if crypto is already defined
if (!global.crypto.getRandomBase64String) {
  global.crypto.getRandomBase64String = async (
    length: number
  ): Promise<string> => {
    try {
      const randomHex = await crypto.randomKey(length)
      return Buffer.from(randomHex, 'hex').toString('base64')
    } catch (error) {
      throw new Error(
        'Failed to generate secure random values: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    }
  }
}

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
  private processedMessageIds: Set<string> = new Set()
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

  getRelays(): string[] {
    return this.relays
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
    } catch (_error) {
      this.ndk = null
      throw new Error(
        'Failed to connect to relays: ' +
          (_error instanceof Error ? _error.message : 'Unknown error')
      )
    }
  }

  static async generateNostrKeys(): Promise<NostrKeys> {
    try {
      // Generate random bytes using react-native-aes-crypto
      const randomHex = await crypto.randomKey(32)
      const randomBytesArray = new Uint8Array(Buffer.from(randomHex, 'hex'))

      // Use the private key directly with NDKPrivateKeySigner
      const signer = new NDKPrivateKeySigner(randomBytesArray)
      const user = await signer.user()
      const nsec = nip19.nsecEncode(randomBytesArray)
      const npub = user.npub

      return {
        nsec,
        npub,
        secretNostrKey: randomBytesArray
      }
    } catch (_error) {
      throw new Error(
        'Failed to generate Nostr keys: ' +
          (_error instanceof Error ? _error.message : 'Unknown error')
      )
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.eventQueue.length === 0) return

    this.isProcessingQueue = true
    const batch = this.eventQueue.splice(0, this.BATCH_SIZE)

    for (const message of batch) {
      if (!this.processedMessageIds.has(message.id)) {
        this.processedMessageIds.add(message.id)
        try {
          this._callback?.(message)
        } catch (_error) {
          // Error processing message
        }
      }
    }

    this.isProcessingQueue = false
    if (this.eventQueue.length > 0) {
      setTimeout(() => this.processQueue(), this.PROCESSING_INTERVAL)
    }
  }

  private _callback?: (message: NostrMessage) => void

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
    this._callback = _callback

    try {
      const { data: recipientSecretNostrKey } = nip19.decode(recipientNsec)
      const { data: recipientPubKey } = nip19.decode(recipientNpub)

      const TWO_DAYS = 48 * 60 * 60
      const bufferedSince = since ? since - TWO_DAYS : undefined

      const subscriptionQuery = {
        kinds: [1059 as NDKKind],
        //'#p': [recipientPubKeyFromNsec, recipientPubKey.toString()],
        '#p': [recipientPubKey.toString()],
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
          const unwrappedEvent = nip59.unwrapEvent(
            rawEvent as unknown as Event,
            recipientSecretNostrKey as Uint8Array
          )

          // Only queue if not already processed
          if (!this.processedMessageIds.has(unwrappedEvent.id)) {
            const message = {
              id: unwrappedEvent.id,
              content: unwrappedEvent,
              created_at: unwrappedEvent.created_at,
              pubkey: event.pubkey
            }

            this.eventQueue.push(message)
            this.processQueue()
          }
        } catch (_error) {}
      })

      subscription?.on('eose', () => {
        onEOSE?.(recipientNsec)
        this.setLoading(false)
      })

      subscription?.on('close', () => {
        this.activeSubscriptions.delete(subscription)
      })
    } catch (_error) {
      this.setLoading(false)
      throw _error
    }
  }

  async closeAllSubscriptions() {
    for (const subscription of this.activeSubscriptions) {
      try {
        subscription.stop()
      } catch (_error) {
        // Error closing subscription
      }
    }
    this.activeSubscriptions.clear()
    this.eventQueue = []
    this._callback = undefined
  }

  async createKind1059(
    nsec: string,
    recipientNpub: string,
    content: string
  ): Promise<NDKEvent> {
    const { data: secretNostrKey } = nip19.decode(nsec)
    const recipientPubkey = nip19.decode(recipientNpub) as { data: string }
    const encodedContent = unescape(encodeURIComponent(content))

    // Create a simple synchronous random value generator
    const getRandomBytes = (length: number): Uint8Array => {
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256)
      }
      return bytes
    }

    // Create a synchronous crypto object
    const syncCrypto = {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (!array) return array
        const bytes = getRandomBytes(array.byteLength)
        const uint8Array = new Uint8Array(
          array.buffer,
          array.byteOffset,
          array.byteLength
        )
        uint8Array.set(bytes)
        return array
      },
      getRandomBase64String: (length: number): string => {
        const bytes = getRandomBytes(length)
        return Buffer.from(bytes).toString('base64')
      }
    }

    // Store original crypto and replace with our sync version
    const originalCrypto = global.crypto
    Object.assign(global.crypto, syncCrypto)

    try {
      const wrap = nip17.wrapEvent(
        secretNostrKey as Uint8Array,
        { publicKey: recipientPubkey.data },
        encodedContent
      )
      const tempNdk = new NDK()
      const event = new NDKEvent(tempNdk, wrap)
      return event
    } finally {
      // Restore original crypto
      Object.assign(global.crypto, originalCrypto)
    }
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
            } catch (_error) {
              return { url, success: false, error: _error }
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
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : 'Unknown error'
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
  } catch (_error) {
    throw new Error(
      'Failed to decompress message: ' +
        (_error instanceof Error ? _error.message : 'Unknown error')
    )
  }
}
