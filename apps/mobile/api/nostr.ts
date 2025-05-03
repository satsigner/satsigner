/*
declare module 'cbor-js' {
  export function encode(data: any): Uint8Array
  export function decode(data: Uint8Array): any
}
*/
import type { NDKKind } from '@nostr-dev-kit/ndk'
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
import * as base85 from 'base85'
/*

import * as ascii85 from 'ascii85'
import basex from 'base-x'
import * as zlib from 'react-zlib-js'
import { json } from 'stream/consumers'
*/

export interface NostrKeys {
  nsec: string
  npub: string
  secretNostrKey: Uint8Array
}

export interface NostrMessage {
  content: string
  created_at: number
  pubkey: string
  decryptedContent?: string
  isSender?: boolean
}

export class NostrAPI {
  private ndk: NDK | null = null

  constructor(private relays: string[]) {
    // Add default reliable relays if none provided
    if (!relays || relays.length === 0) {
      this.relays = [
        'wss://relay.damus.io',
        'wss://nostr.bitcoiner.social',
        'wss://relay.nostr.band',
        'wss://nos.lol'
      ]
    }
  }

  async connect() {
    try {
      // Initialize NDK if not already initialized
      if (!this.ndk) {
        this.ndk = new NDK({
          explicitRelayUrls: this.relays
        })
      }

      // Ensure NDK is connected
      await this.ndk.connect()

      // Ensure pool is initialized and connected
      if (!this.ndk.pool) {
        throw new Error('NDK pool not initialized')
      }

      await this.ndk.pool.connect()

      // Verify relay connections
      const connectedRelays = Array.from(this.ndk.pool.relays.keys())

      if (connectedRelays.length === 0) {
        throw new Error(
          'No relays could be connected. Please check your relay URLs and internet connection.'
        )
      }

      // Test each relay's connection with retries
      const relayStatus = await Promise.all(
        connectedRelays.map(async (url) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const relay = this.ndk?.pool.relays.get(url)
              if (!relay) {
                console.log(`Relay not found in pool: ${url}`)
                return { url, status: 'not_found' }
              }

              // Try to fetch a simple event to test the connection
              const testEvent = await this.ndk?.fetchEvent(
                { kinds: [1], limit: 1 },
                // @ts-ignore - relayUrl is used by NDK but not in types
                { relayUrl: url }
              )

              return { url, status: 'connected', testEvent: testEvent !== null }
            } catch (error) {
              if (attempt === 2) {
                return { url, status: 'error' }
              }
              // Wait before retry
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (attempt + 1))
              )
            }
          }
          return { url, status: 'error' }
        })
      )

      // If no relays are working, throw an error
      const workingRelays = relayStatus.filter((r) => r.status === 'connected')
      if (workingRelays.length === 0) {
        throw new Error(
          'No relays are responding. Please check your internet connection and try again.'
        )
      }

      return true
    } catch (error) {
      this.ndk = null // Reset ndk on error
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

  /*
















  */

  async fetchMessages(
    nsec: string,
    recipientNpub: string,
    since?: number,
    limit: number = 30
  ): Promise<NostrMessage[]> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    // Decode the nsec
    const { type, data: secretNostrKey } = nip19.decode(nsec)

    // Check if the decoded type is 'nsec'
    if (type !== 'nsec') {
      throw new Error('Input is not a valid nsec')
    }

    const user = this.ndk.getUser({ npub: recipientNpub })
    const ourPubkey = getPublicKey(secretNostrKey)

    try {
      // Create a subscription to fetch events
      const subscriptionQuery = {
        kinds: [1059 as NDKKind],
        '#p': [ourPubkey], // Events where we are the recipient
        authors: [user.pubkey], // Events from the other user
        limit
      }

      const subscription = this.ndk?.subscribe(subscriptionQuery)

      // Also subscribe to our own sent messages
      const sentMessagesQuery = {
        kinds: [1059 as NDKKind],
        authors: [ourPubkey], // Our sent messages
        '#p': [user.pubkey], // Where the other user is the recipient
        limit
      }

      const sentSubscription = this.ndk?.subscribe(sentMessagesQuery)

      // Subscribe to self-messages (where we are both sender and recipient)
      const selfMessagesQuery = {
        kinds: [1059 as NDKKind],
        authors: [ourPubkey], // We are the sender
        '#p': [ourPubkey], // We are also the recipient
        limit
      }

      const selfSubscription = this.ndk?.subscribe(selfMessagesQuery)

      // Log the relay queries
      console.log('Relay Queries:', {
        received: subscriptionQuery,
        sent: sentMessagesQuery,
        self: selfMessagesQuery
      })

      // Collect events from all subscriptions
      const events = new Set<NDKEvent>()
      subscription?.on('event', (event) => {
        events.add(event)
      })
      sentSubscription?.on('event', (event) => {
        events.add(event)
      })
      selfSubscription?.on('event', (event) => {
        events.add(event)
      })

      // Wait for all subscriptions to complete
      await Promise.all([
        new Promise((resolve) => {
          subscription?.on('eose', () => resolve(true))
          setTimeout(resolve, 5000)
        }),
        new Promise((resolve) => {
          sentSubscription?.on('eose', () => resolve(true))
          setTimeout(resolve, 5000)
        }),
        new Promise((resolve) => {
          selfSubscription?.on('eose', () => resolve(true))
          setTimeout(resolve, 5000)
        })
      ])

      // Process gift wrap messages
      const decryptedMessages = await Promise.all(
        Array.from(events).map(async (giftWrapEvent: NDKEvent) => {
          try {
            // Parse the gift wrap content which contains the kind:13 event
            const kind13Event = JSON.parse(giftWrapEvent.content)

            // Determine if we're the sender or recipient
            const isSender = giftWrapEvent.pubkey === ourPubkey
            const otherPubkey = isSender ? user.pubkey : ourPubkey

            // Decrypt the kind:13 event content using NIP-44
            const conversationKey = nip44.getConversationKey(
              secretNostrKey,
              otherPubkey
            )

            const decryptedContent = nip44.decrypt(
              kind13Event.content,
              conversationKey
            )

            // Decode the base64 content
            const decodedContent = Buffer.from(
              decryptedContent,
              'base64'
            ).toString('utf-8')
            // Ensure proper encoding of decrypted content
            const finalContent = decodeURIComponent(escape(decodedContent))

            return {
              content: kind13Event.content,
              created_at:
                kind13Event.created_at ?? Math.floor(Date.now() / 1000),
              pubkey: kind13Event.pubkey,
              decryptedContent: finalContent,
              isSender
            }
          } catch (_error) {
            return {
              content: giftWrapEvent.content,
              created_at:
                giftWrapEvent.created_at ?? Math.floor(Date.now() / 1000),
              pubkey: giftWrapEvent.pubkey,
              decryptedContent: '[Failed to decrypt]',
              isSender: giftWrapEvent.pubkey === ourPubkey
            }
          }
        })
      )

      // Sort messages by timestamp, newest first
      return decryptedMessages.sort(
        (a: NostrMessage, b: NostrMessage) =>
          (b.created_at ?? 0) - (a.created_at ?? 0)
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      throw new Error(
        `Failed to fetch messages: ${errorMessage}. Please check your relay connections and try again.`
      )
    }
  }

  async disconnect() {
    this.ndk = null
  }

  /*












*/

  async subscribeToKind1059New(
    commonNsec: string,
    deviceNsec: string,
    callback: (message: NostrMessage) => void
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    // Decode the nsec
    const { type: commonType, data: commonSecretNostrKey } =
      nip19.decode(commonNsec)
    const { type: deviceType, data: deviceSecretNostrKey } =
      nip19.decode(deviceNsec)

    // Check if the decoded type is 'nsec'
    if (commonType !== 'nsec' || deviceType !== 'nsec') {
      throw new Error('Input is not a valid nsec')
    }

    //const user = this.ndk.getUser({ npub: commonNpub })
    const commonPubkey = getPublicKey(commonSecretNostrKey as Uint8Array)
    const devicePubkey = getPublicKey(deviceSecretNostrKey as Uint8Array)

    // Create a subscription to fetch events
    const subscriptionQuery = {
      kinds: [1059 as NDKKind],
      '#p': [commonPubkey, devicePubkey], // Events where we are the recipient
      limit: 10,
      /**/
      ids: [
        // My message?
        '07bcca94cf0305deb52ea1c0de8a95c1e4ba3e568120eff2c6562103aba84d42',
        // BITCOIN SAFE ANNOUNCEMENT
        '2c3df5ce6ec6e3c5d60ed635c45fd83cb124a27d581a619a935dbbc2a02e4847'
      ]
      /**/
    }

    const subscription = this.ndk?.subscribe(subscriptionQuery)

    subscription?.on('event', async (event) => {
      const rawEvent = await event.toNostrEvent()
      if (!rawEvent.kind || !rawEvent.sig) {
        console.log('Invalid event format')
        return
      }
      try {
        const unwrappedEvent = await nip59.unwrapEvent(
          rawEvent as unknown as Event,
          commonSecretNostrKey as Uint8Array
        )

        // Try to parse as JSON first
        try {
          const jsonContent = JSON.parse(unwrappedEvent.content)
          console.log('🟢 JSON content:', jsonContent)
          return jsonContent
        } catch (jsonError) {
          try {
            const compressedContent = unwrappedEvent.content
            const decompressedContent = decompressMessage(
              unwrappedEvent.content
            )
            console.log('🟢 Decompressed content:', decompressedContent)
          } catch (decompressError) {
            console.log('🔴 Failed to decompress content:', decompressError)
            return unwrappedEvent.content
          }
        }
      } catch (unwrapError) {
        console.log('❌ Unwrap error:', unwrapError)
      }
    })

    // Return a promise that resolves when the subscription is set up
    return new Promise((resolve) => {
      subscription?.on('eose', () => resolve())
      // Also resolve after a timeout to prevent hanging
      setTimeout(resolve, 5000)
    })
  }

  /*

























  */

  async createKind1059WrappedEvent(
    nsec: string,
    recipientNpub: string,
    content: string
  ): Promise<NDKEvent> {
    // Decode the nsec
    const { type, data: secretNostrKey } = nip19.decode(nsec)

    // Check if the decoded type is 'nsec'
    if (type !== 'nsec') {
      throw new Error('Input is not a valid nsec')
    }

    // Decode recipient's npub or use hex directly
    let recipientPubkey: string
    const isNpub =
      recipientNpub.startsWith('npub') &&
      recipientNpub.length === 63 &&
      /^[a-z0-9]+$/.test(recipientNpub)
    if (isNpub) {
      try {
        const { data } = nip19.decode(recipientNpub) as { data: string }
        recipientPubkey = data
        if (!/^[0-9a-f]{64}$/.test(recipientPubkey)) {
          throw new Error(
            'Decoded recipientPubkey is not a valid 64-character hex string'
          )
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        throw new Error(
          'Invalid recipientNpub (checksum error): ' + errorMessage
        )
      }
    } else {
      recipientPubkey = recipientNpub // Use hex directly
    }

    const encodedContent = unescape(encodeURIComponent(content))

    const wrap = nip17.wrapEvent(
      secretNostrKey,
      { publicKey: recipientPubkey },
      encodedContent
    )
    const tempNdk = new NDK()
    const event = new NDKEvent(tempNdk, wrap)
    return event
  }

  /*










  





  */

  async sendMessage(event: NDKEvent): Promise<void> {
    try {
      // Ensure we're connected
      if (!this.ndk) {
        console.log('NDK not initialized, attempting to connect...')
        await this.connect()
      }

      if (!this.ndk) {
        throw new Error('Failed to initialize NDK')
      }

      // Log connected relays and their status
      const connectedRelays = Array.from(this.ndk.pool.relays.keys())
      console.log('Connected relays before sending:', connectedRelays)

      // Check relay status
      for (const url of connectedRelays) {
        const relay = this.ndk.pool.relays.get(url)
        if (relay) {
          console.log(`Relay ${url} status:`, {
            connected: relay.connected,
            status: relay.status
          })
        }
      }

      // Ensure event is using the correct NDK instance
      if (event.ndk !== this.ndk) {
        console.log('Updating event NDK instance')
        event.ndk = this.ndk
      }

      // Ensure event is signed
      if (!event.sig) {
        console.log('Event not signed, attempting to sign...')
        const signer = this.ndk.signer
        if (!signer) {
          throw new Error('No signer available for event')
        }
        await event.sign(signer)
        console.log('Event signed successfully')
      }

      let published = false
      for (let i = 0; i < 3; i++) {
        try {
          console.log(`Publishing attempt ${i + 1}/3`)
          console.log('Event details:', {
            kind: event.kind,
            pubkey: event.pubkey,
            content: event.content?.substring(0, 100) + '...', // Log first 100 chars of content
            created_at: event.created_at,
            sig: event.sig?.substring(0, 20) + '...' // Log first 20 chars of signature
          })

          // Try to publish to each relay individually
          const publishPromises = connectedRelays.map(async (url) => {
            try {
              const relay = this.ndk?.pool.relays.get(url)
              if (!relay) {
                console.log(`Relay ${url} not found in pool`)
                return { url, success: false, error: 'Relay not found' }
              }

              console.log(`Attempting to publish to ${url}`)
              await relay.publish(event)
              return { url, success: true }
            } catch (error) {
              console.log(`Failed to publish to ${url}:`, error)
              return { url, success: false, error }
            }
          })

          const results = await Promise.all(publishPromises)
          console.log('Publish results:', results)

          const successfulPublishes = results.filter((r) => r.success)
          if (successfulPublishes.length > 0) {
            published = true
            console.log(
              'Event published successfully to:',
              successfulPublishes.map((r) => r.url)
            )
            break
          } else {
            console.log('No relays accepted the event')
          }
        } catch (err) {
          console.log(`Attempt ${i + 1} failed:`, err)
          if (i < 2) {
            console.log(`Waiting 1 second before retry...`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }
      }

      if (!published) {
        throw new Error('Failed to publish after 3 attempts')
      }

      console.log('Event published successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      console.error('Detailed error:', error)
      throw new Error(`Failed to publish event: ${errorMessage}`)
    }
  }
}

/*










  





 

// Incase we don't want to call the CBOR library
export function cborSerialize(content: any): Uint8Array {
  // Helper function to encode a string
  function encodeString(str: string): Uint8Array {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(str)
    const length = bytes.length

    // Major type 3 (text string) with length
    let header: number
    if (length < 24) {
      header = 0x60 + length // Major type 3 (0x60) + length
    } else if (length < 256) {
      header = 0x78 // Major type 3, length 1 byte
    } else if (length < 65536) {
      header = 0x79 // Major type 3, length 2 bytes
    } else {
      header = 0x7a // Major type 3, length 4 bytes
    }

    const result = new Uint8Array(length + 1)
    result[0] = header
    result.set(bytes, 1)
    return result
  }

  // Helper function to encode a number
  function encodeNumber(num: number): Uint8Array {
    if (Number.isInteger(num)) {
      if (num >= 0) {
        // Positive integer
        if (num < 24) {
          return new Uint8Array([num])
        } else if (num < 256) {
          return new Uint8Array([0x18, num])
        } else if (num < 65536) {
          const result = new Uint8Array(3)
          result[0] = 0x19
          result[1] = (num >> 8) & 0xff
          result[2] = num & 0xff
          return result
        } else {
          const result = new Uint8Array(5)
          result[0] = 0x1a
          result[1] = (num >> 24) & 0xff
          result[2] = (num >> 16) & 0xff
          result[3] = (num >> 8) & 0xff
          result[4] = num & 0xff
          return result
        }
      } else {
        // Negative integer
        const absNum = -1 - num
        if (absNum < 24) {
          return new Uint8Array([0x20 + absNum])
        } else if (absNum < 256) {
          return new Uint8Array([0x38, absNum])
        } else if (absNum < 65536) {
          const result = new Uint8Array(3)
          result[0] = 0x39
          result[1] = (absNum >> 8) & 0xff
          result[2] = absNum & 0xff
          return result
        } else {
          const result = new Uint8Array(5)
          result[0] = 0x3a
          result[1] = (absNum >> 24) & 0xff
          result[2] = (absNum >> 16) & 0xff
          result[3] = (absNum >> 8) & 0xff
          result[4] = absNum & 0xff
          return result
        }
      }
    } else {
      throw new Error('Floating point numbers not supported')
    }
  }

  // Handle object encoding
  if (typeof content === 'object' && content !== null) {
    const entries = Object.entries(content)
    const mapHeader = new Uint8Array([0xa0 + entries.length]) // Major type 5 (map) + length

    const encodedEntries = entries.map(([key, value]) => {
      const encodedKey = encodeString(key)
      const encodedValue = encodeNumber(value as number)
      const result = new Uint8Array(encodedKey.length + encodedValue.length)
      result.set(encodedKey)
      result.set(encodedValue, encodedKey.length)
      return result
    })

    const totalLength =
      mapHeader.length +
      encodedEntries.reduce((sum, entry) => sum + entry.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    result.set(mapHeader, offset)
    offset += mapHeader.length

    for (const entry of encodedEntries) {
      result.set(entry, offset)
      offset += entry.length
    }

    return result
    //return formatBinaryOutput(result)
  }

  throw new Error('Unsupported content type for CBOR serialization')
}

























*/

// Python's base85 alphabet for b85encode:
const BASE85 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~'

function base85Encode(buf: Buffer) {
  // pad to 4-byte boundary
  const pad = (4 - (buf.length % 4)) % 4
  const data = pad
    ? Buffer.concat([buf, Buffer.alloc(pad)], buf.length + pad)
    : buf

  let out = ''
  for (let i = 0; i < data.length; i += 4) {
    // read 4 bytes as a big-endian uint32
    let acc = data.readUInt32BE(i)
    let chunk = ''
    // turn into 5 base-85 chars
    for (let j = 0; j < 5; j++) {
      chunk = BASE85[acc % 85] + chunk
      acc = Math.floor(acc / 85)
    }
    out += chunk
  }
  // drop padding characters
  return pad ? out.slice(0, out.length - pad) : out
}

const BASE85_DECODE = Object.fromEntries(
  BASE85.split('').map((ch, i) => [ch, i])
)

function base85Decode(str: string) {
  const len = str.length
  const rem = len % 5
  if (rem === 1) {
    throw new Error(`Invalid Base85 string length: mod 5 = ${rem}`)
  }
  // how many pad-chars we need to add to make a full 5-char block
  const padChars = rem ? 5 - rem : 0
  // this is also the number of bytes the encoder originally padded (and then dropped)
  const padBytes = padChars

  // pad the final, short group with the highest symbol ('~', value = 84)
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
    // unpack into four bytes (big-endian)
    out.push((acc >>> 24) & 0xff)
    out.push((acc >>> 16) & 0xff)
    out.push((acc >>> 8) & 0xff)
    out.push(acc & 0xff)
  }

  // drop the same number of padding _bytes_ that were added during encoding
  return Buffer.from(out.slice(0, out.length - padBytes))
}

export function compressMessage(data: any) {
  try {
    const cborData = CBOR.encode(data)
    //const cborData = cborSerialize(data)
    const jsonUint8 = new Uint8Array(cborData)

    const compressedData = pako.deflate(jsonUint8)
    const compressedBuffer = Buffer.from(compressedData)
    // Use our own base85Encode as fallback
    return base85Encode(compressedBuffer)
  } catch (error) {
    throw new Error('Failed to compress data')
  }
}

export function decompressMessage(compressedString: string) {
  try {
    // 1) Base85 → Uint8Array
    const compressedBytes = base85Decode(compressedString)

    // 2) Inflate → Uint8Array of cbor bytes
    const cborBytes = pako.inflate(compressedBytes)

    // 3) Decode cbor → original object
    const bufferSlice = cborBytes.buffer.slice(
      cborBytes.byteOffset,
      cborBytes.byteOffset + cborBytes.byteLength
    )
    return CBOR.decode(bufferSlice as unknown as Uint8Array)
  } catch (err) {
    console.error('Decompression error:', err)
  }
}

/*

const d = { created_at: 1746003358 }

console.log('Compression')
const compressed_string = compressMessage(d)
console.log('encoded:', compressed_string)

console.log('Try decompression')
const decompressed_str = decompressMessage(compressed_string)
console.log('Decompressed:', decompressed_str)

const decompressed_str2 = decompressMessage(
  'c$};7s#Z!aN=+<DO^Ht|QL-{LH!(9ZH@7e|)ltexOiIlG3h5}Nq!uR^WfqiV=I1F{DLLoo78Iox7pJBu_yVcK^i%~!MMb4r0HoX)L;'
)
console.log('🟢🟢🟢🟢🟢 Decompressed:', decompressed_str2)

/* AAAA */
/*
const string1 = 'Hello, world!!!!'
var z85 = base85.encode(Buffer.from(string1))
console.log('✅', z85) // nm=QNz.92Pz/PV8aT50L
console.log('✅', Buffer.from(string1))

var string2 = 'Hello, world!!!!z'
var encoded = base85.encode(Buffer.from(string2))
console.log('✅', encoded)
console.log('✅', Buffer.from(string2))
*/
