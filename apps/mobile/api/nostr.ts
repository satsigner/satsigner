import NDK, { NDKEvent, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk'
import * as bip39 from 'bip39'
import { getPublicKey, nip04, nip19 } from 'nostr-tools'

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

  constructor(private relays: string[]) {}

  async connect() {
    if (!this.ndk) {
      this.ndk = new NDK({
        explicitRelayUrls: this.relays
      })
      await this.ndk.connect()
    }
  }

  static async generateNostrKeys(
    mnemonic: string,
    passphrase: string
  ): Promise<NostrKeys> {
    const seed = await bip39.mnemonicToSeed(mnemonic, passphrase)
    const secretNostrKey = new Uint8Array(seed.slice(0, 32))
    const nsec = nip19.nsecEncode(secretNostrKey)
    const publicKey = getPublicKey(secretNostrKey)
    const npub = nip19.npubEncode(publicKey)

    return {
      nsec,
      npub,
      secretNostrKey
    }
  }

  async sendMessage(
    nsec: string,
    recipientNpub: string,
    content: string
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) {
      throw new Error('Failed to connect to relays')
    }

    // Decode the nsec
    const { type, data: secretNostrKey } = nip19.decode(nsec)

    // Check if the decoded type is 'nsec'
    if (type !== 'nsec') {
      throw new Error('Input is not a valid nsec')
    }

    // Convert secretNostrKey (Uint8Array) to hex string
    const secretNostrKeyHex = Buffer.from(secretNostrKey).toString('hex')
    const ourPubkey = getPublicKey(secretNostrKeyHex)

    // Decode recipient's npub to hex pubkey
    console.log(recipientNpub)
    const recipientPubkey = nip19.decode(recipientNpub).data as string
    console.log(recipientPubkey)

    // Ensure proper encoding before encryption
    const encodedContent = unescape(encodeURIComponent(content))

    // Create signer
    const signer = new NDKPrivateKeySigner(secretNostrKeyHex)

    // Create NDKUser for recipient
    const recipientUser = new NDKUser({
      npub: recipientPubkey,
      relayUrls: this.relays
    })
    recipientUser.ndk = this.ndk

    // Step 1: Create the kind:14 chat message event
    const kind14Event = new NDKEvent(this.ndk, {
      kind: 14,
      pubkey: ourPubkey,
      created_at: new Date().getTime() / 1000,
      tags: [['p', recipientPubkey]], // Reference recipient
      content: encodedContent
    })

    // Step 2: Encrypt the kind:14 event using NIP-44

    // Debug: Log event before encryption
    console.log(
      'Kind:14 event before encryption:',
      await kind14Event.toNostrEvent()
    )

    // Encrypt kind:14 event using NIP-44
    try {
      await kind14Event.encrypt(recipientUser, signer)
      console.log('Kind:14 event encrypted successfully')
    } catch (error) {
      console.error('Encryption failed for kind:14:', error)
      throw new Error('Failed to encrypt kind:14 event: ' + error.message)
    }

    // Create sealed kind:13 event
    console.log(
      'DEBUGPRINT[48]: nostr.ts:99 (after // Create sealed kind:13 event)'
    )
    const kind13Event = new NDKEvent(this.ndk, {
      kind: 13,
      pubkey: ourPubkey,
      created_at: Date.now(),
      tags: [],
      content: kind14Event.content
    })

    // Sign kind:13 event
    await kind13Event.sign(signer)
    await kind13Event.encrypt(recipientUser, signer)

    // Step 3: Create kind:1059 gift-wrap event for recipient
    const kind1059Event = new NDKEvent(this.ndk, {
      kind: 1059,
      pubkey: ourPubkey,
      created_at: Date.now(),
      tags: [['p', recipientPubkey]], // Recipient's pubkey
      content: JSON.stringify(await kind13Event.toNostrEvent())
    })
    await kind1059Event.sign(signer)

    // Step 5: Publish events
    await kind1059Event.publish()
  }

  async fetchMessages(
    nsec: string,
    recipientNpub: string,
    since?: number,
    limit: number = 3
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
            secretNostrKey,
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
        } catch {
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
