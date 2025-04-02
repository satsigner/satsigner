import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import * as bip39 from 'bip39'
import { generateSecretKey, nip19, getPublicKey, nip04 } from 'nostr-tools'
import { type Label } from '@/utils/bip329'

export interface NostrKeys {
  nsec: string
  npub: string
  secretKey: Uint8Array
}

export interface NostrMessage {
  content: string
  created_at: number
  pubkey: string
  decryptedContent?: string
  isSender?: boolean
}

interface NDKEventType {
  content: string
  created_at?: number
  pubkey: string
}

export class NostrAPI {
  private ndk: NDK | null = null

  constructor(private relays: string[]) {}

  private async connect() {
    if (!this.ndk) {
      this.ndk = new NDK({
        explicitRelayUrls: this.relays
      })
      await this.ndk.connect()
    }
  }

  async generateKeys(mnemonic: string, passphrase: string): Promise<NostrKeys> {
    const seed = await bip39.mnemonicToSeed(mnemonic, passphrase)
    const secretKey = new Uint8Array(seed.slice(0, 32))
    const nsec = nip19.nsecEncode(secretKey)
    const publicKey = getPublicKey(secretKey)
    const npub = nip19.npubEncode(publicKey)

    return {
      nsec,
      npub,
      secretKey
    }
  }

  async sendMessage(
    secretKey: Uint8Array,
    recipientNpub: string,
    content: string
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    const ourPubkey = getPublicKey(secretKey)
    const { data: recipientPubkey } = nip19.decode(recipientNpub)

    // Ensure proper encoding before encryption
    const encodedContent = unescape(encodeURIComponent(content))

    // Create nip04 encrypted message
    const encryptedMessage = await nip04.encrypt(
      secretKey,
      recipientPubkey as string,
      encodedContent
    )

    // Create and publish the event
    const event = new NDKEvent(this.ndk, {
      kind: 4, // nip04 encrypted message
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey as string]], // recipient's pubkey
      content: encryptedMessage
    })

    // Convert secret key to hex string for NDKPrivateKeySigner
    const secretKeyHex = Array.from(secretKey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const signer = new NDKPrivateKeySigner(secretKeyHex)
    await event.sign(signer)

    await event.publish()
  }

  async fetchMessages(
    secretKey: Uint8Array,
    recipientNpub: string,
    since?: number,
    limit: number = 3
  ): Promise<NostrMessage[]> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    const user = this.ndk.getUser({ npub: recipientNpub })
    const ourPubkey = getPublicKey(secretKey)

    // Get nip04 encrypted messages with pagination
    const messages = await this.ndk.fetchEvents({
      kinds: [4], // nip04 encrypted messages
      authors: [ourPubkey, user.pubkey],
      limit,
      since
    })

    // Decrypt messages
    const decryptedMessages = await Promise.all(
      Array.from(messages).map(async (msg: NDKEvent) => {
        try {
          // Determine if we're the sender or recipient
          const isSender = msg.pubkey === ourPubkey
          const otherPubkey = isSender ? user.pubkey : ourPubkey

          // Decrypt the message
          const decryptedContent = await nip04.decrypt(
            secretKey,
            otherPubkey,
            msg.content
          )

          // Ensure proper encoding of decrypted content
          const decodedContent = decodeURIComponent(escape(decryptedContent))

          return {
            content: msg.content,
            created_at: msg.created_at ?? Math.floor(Date.now() / 1000),
            pubkey: msg.pubkey,
            decryptedContent: decodedContent,
            isSender
          }
        } catch (error) {
          console.error('Error decrypting message:', error)
          return {
            content: msg.content,
            created_at: msg.created_at ?? Math.floor(Date.now() / 1000),
            pubkey: msg.pubkey,
            decryptedContent: '[Failed to decrypt]',
            isSender: msg.pubkey === ourPubkey
          }
        }
      })
    )

    // Sort messages by timestamp, newest first
    return decryptedMessages.sort(
      (a: NostrMessage, b: NostrMessage) =>
        (b.created_at ?? 0) - (a.created_at ?? 0)
    )
  }

  async disconnect() {
    // NDK doesn't have a disconnect method, so we just nullify the instance
    this.ndk = null
  }
}
