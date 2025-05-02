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

import * as base85 from 'base85'

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
              if (!relay) return { url, status: 'not_found' }

              // Try to fetch a simple event to test the connection
              const testEvent = await this.ndk?.fetchEvent(
                { kinds: [1], limit: 1 },
                // @ts-ignore - relayUrl is used by NDK but not in types
                { relayUrl: url }
              )

              // If we get here, the relay is working
              return { url, status: 'connected', testEvent: testEvent !== null }
            } catch (_error) {
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
      ids: [
        // My message?
        '07bcca94cf0305deb52ea1c0de8a95c1e4ba3e568120eff2c6562103aba84d42',
        // BITCOIN SAFE ANNOUNCEMENT
        '2c3df5ce6ec6e3c5d60ed635c45fd83cb124a27d581a619a935dbbc2a02e4847'
      ]
    }

    const subscription = this.ndk?.subscribe(subscriptionQuery)

    subscription?.on('event', async (event) => {
      const rawEvent = await event.toNostrEvent()
      if (!rawEvent.kind || !rawEvent.sig) {
        console.log('Invalid event format')
        return
      }
      console.log('🟡 ', rawEvent.content)

      try {
        const unwrappedEvent = await nip59.unwrapEvent(
          rawEvent as unknown as Event,
          commonSecretNostrKey as Uint8Array
        )

        console.log('🟢 Raw content:', unwrappedEvent.content)

        // Try to parse as JSON first
        try {
          const jsonContent = JSON.parse(unwrappedEvent.content)
          console.log('🟢 JSON content:', jsonContent)

          const compressedContent = compressMessageContent(jsonContent)
          console.log('⚪️ Compressed content:', compressedContent)

          const decompressedContent =
            decompressMessageContent(compressedContent)
          console.log('⚪️⚪️⚪️ Decompressed content:', decompressedContent)
        } catch (jsonError) {
          console.log('🗜️ Not JSON, trying to decompress...')
          try {
            const decompressedContent = decompressMessageContent(
              unwrappedEvent.content
            )
            console.log('🟢 Decompressed content:', decompressedContent)
          } catch (decompressError) {
            console.log('🔴 Failed to decompress content:', decompressError)
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
        await this.connect()
      }

      if (!this.ndk) {
        throw new Error('Failed to initialize NDK')
      }

      // Ensure event is using the correct NDK instance
      if (event.ndk !== this.ndk) {
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
      }

      // Simple publish with retry
      let published = false
      for (let i = 0; i < 3; i++) {
        try {
          console.log(`Publishing attempt ${i + 1}/3`)
          await event.publish()
          published = true
          break
        } catch (err) {
          console.log(`Attempt ${i + 1} failed:`, err)
          if (i < 2) {
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
      throw new Error(`Failed to publish event: ${errorMessage}`)
    }
  }
}

function encodeBase85(data: Uint8Array): Uint8Array {
  const base85Chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~'
  const result: number[] = []

  // Process data in chunks of 4 bytes
  for (let i = 0; i < data.length; i += 4) {
    // Get 4 bytes or pad with zeros
    const chunk = new Uint8Array(4)
    for (let j = 0; j < 4; j++) {
      chunk[j] = i + j < data.length ? data[i + j] : 0
    }

    // Convert to 32-bit integer (network byte order)
    let value = 0
    for (let j = 0; j < 4; j++) {
      value = (value << 8) | chunk[j]
    }

    // Convert to base85 (5 characters)
    for (let j = 0; j < 5; j++) {
      result.unshift(base85Chars.charCodeAt(value % 85))
      value = Math.floor(value / 85)
    }
  }

  return new Uint8Array(result)
}

export function compressMessageContent(content: any): string {
  // Convert to JSON string and then to Buffer
  const jsonString = JSON.stringify(content)
  const jsonBuffer = Buffer.from(jsonString)

  // Compress with zlib (using pako)
  const compressedData = pako.deflate(jsonBuffer)

  console.log('compressedData', compressedData)

  // Convert to base85 using our custom encoder
  const base85Encoded = encodeBase85(compressedData)
  console.log('base85Encoded', base85Encoded)

  // Add the 'c$' prefix
  return `${base85Encoded}`
}

function decodeBase85(encoded: string): Uint8Array {
  const base85Chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~'
  const result = new Uint8Array(Math.floor((encoded.length * 4) / 5))
  let value = 0
  let count = 0
  let pos = 0

  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i]
    const digit = base85Chars.indexOf(char)
    if (digit === -1) continue

    value = value * 85 + digit
    count++

    if (count === 5) {
      result[pos++] = (value >> 24) & 0xff
      result[pos++] = (value >> 16) & 0xff
      result[pos++] = (value >> 8) & 0xff
      result[pos++] = value & 0xff
      value = 0
      count = 0
    }
  }

  return result
}

export function decompressMessageContent(compressed: string): any {
  try {
    // Decode base85
    const decoded = decodeBase85(compressed)

    // Decompress with pako
    const decompressed = pako.inflate(decoded)

    // Convert to string and parse JSON
    const jsonString = Buffer.from(decompressed).toString('utf-8')
    return JSON.parse(jsonString)
  } catch (error) {
    console.log('Decompression error:', error)
    throw new Error('Failed to decompress content')
  }
}

function formatBinaryOutput(data: Uint8Array): string {
  let output = "b'"
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]
    if (byte >= 32 && byte <= 126 && byte !== 39) {
      // Printable ASCII except single quote
      output += String.fromCharCode(byte)
    } else {
      output += `\\x${byte.toString(16).padStart(2, '0')}`
    }
  }
  output += "'"
  return output
}

function parseBinaryString(binaryStr: string): Uint8Array {
  // Remove b' and ' from the string
  const content = binaryStr.slice(2, -1)
  const bytes: number[] = []
  let i = 0
  while (i < content.length) {
    if (content[i] === '\\' && content[i + 1] === 'x') {
      // Handle hex escape sequence
      const hex = content.slice(i + 2, i + 4)
      bytes.push(parseInt(hex, 16))
      i += 4
    } else {
      // Handle regular ASCII character
      bytes.push(content.charCodeAt(i))
      i++
    }
  }
  return new Uint8Array(bytes)
}

export function cborSerialize(content: any): string {
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

    return formatBinaryOutput(result)
  }

  throw new Error('Unsupported content type for CBOR serialization')
}

console.log('--------------------------------')
const d = JSON.parse('{"created_at": 1746003358}')

const cborSerialized = cborSerialize(d)
console.log('cborSerialized -----------', cborSerialized)

// Convert the binary string representation to actual binary data
const binaryData = parseBinaryString(cborSerialized)

// Compress the binary data
const zlibCompressedData = pako.deflate(binaryData)
console.log('zlibCompressedData -------', zlibCompressedData)

const zlibCompressedDataX = Buffer.from(cborSerialized, 'base64')
console.log('zlibCompressedData 64 ----', zlibCompressedDataX)

const zlibCompressedDataBinaryOutput = formatBinaryOutput(zlibCompressedData)
console.log('zlib formatBinaryOutput  -', zlibCompressedDataBinaryOutput)

// Convert binary data to base64 first, then to string
//const base64String = Buffer.from(zlibCompressedData).toString('base64')
//const base85EncodedX = base85.encode(base64String)
//console.log('base85EncodedX -----------', base85EncodedX)

// Use our custom base85 encoder
const base85Encoded = encodeBase85(zlibCompressedData)
console.log('base85Encoded ------------', base85Encoded)

const base85Decoded = base85.decode(Buffer.from(base85Encoded))
console.log('base85Decoded ------------', base85Decoded)

console.log("expected ----------------- 'c${09m0XmXSdy9&pI9Q5A^3D206?AxE&'")

/*
d = {"created_at": 1746003358}
cbor_serialized = cbor2.dumps(d)	# b'\xa1jcreated_at\x1ah\x11\xe5\x9e'
compressed_data = zlib.compress(cbor_serialized)	# b'x\x9c[\x98\x95\\\x94\x9aX\x92\x9a\x12\x9fX"\x95!\xf8t\x1e\x00@\x9e\x07.'
message_content = base64.b85encode(compressed_data).decode()	# 'c${09m0XmXSdy9&pI9Q5A^3D206?AxE&'
*/

/*

const zlibExpaned = pako.inflate(decodeBase85(base85Encoded))
console.log('zlibExpaned ---------------', zlibExpaned)
*/

console.log('- - - - - - - - - - - - - - -')

const text = 'Hello,d!!!!'
const hello = base85.encode(text)
console.log(hello) // nm=QNz.92Pz/PV8aT50L

const helloDecoded = base85.decode(hello)
console.log(helloDecoded.toString('utf8')) // Hello, world!!!!

const decoded = base85.decode(
  'vqG:5Cw?IqayPd#az#9uAbn%daz>L5wPF#evpK6}vix96y?$k6z*rGH'
)
console.log(decoded.toString('utf8')) // all work and no play makes jack a dull boy!!
