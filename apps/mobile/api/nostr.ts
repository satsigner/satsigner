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
    secretNostrKey: Uint8Array,
    recipientNpub: string,
    content: string
  ): Promise<void> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

    // Convert secretNostrKey (Uint8Array) to hex string
    console.log("DEBUGPRINT[39]: nostr.ts:58 (after // Convert secretNostrKey (Uint8Array) t…)")
    const secretNostrKeyHex = Buffer.from(secretNostrKey).toString('hex')
    console.log("DEBUGPRINT[45]: nostr.ts:60 (after const secretNostrKeyHex = Buffer.from(se…)")
    console.log('this is it', secretNostrKey)
    const ourPubkey = getPublicKey(secretNostrKey)
    console.log("DEBUGPRINT[44]: nostr.ts:61 (after const ourPubkey = getPublicKey(secretNos…)")

    // Decode recipient's npub to hex pubkey
    console.log("DEBUGPRINT[40]: nostr.ts:63 (after // Decode recipients npub to hex pubkey)")
    const recipientPubkey = nip19.decode(recipientNpub).data as string

    // Ensure proper encoding before encryption
    console.log("DEBUGPRINT[41]: nostr.ts:67 (after // Ensure proper encoding before encrypt…)")
    const encodedContent = unescape(encodeURIComponent(content))

    // Create signer
    console.log("DEBUGPRINT[42]: nostr.ts:71 (after // Create signer)")
    const signer = new NDKPrivateKeySigner(secretNostrKeyHex)

    // Create NDKUser for recipient
    console.log("DEBUGPRINT[43]: nostr.ts:75 (after // Create NDKUser for recipient)")
    const recipientUser = new NDKUser({ npub: recipientPubkey })
    recipientUser.ndk = this.ndk

    // Step 1: Create the kind:14 chat message event
    console.log("DEBUGPRINT[34]: nostr.ts:75 (after // Step 1: Create the kind:14 chat messa…)")
    const kind14Event = new NDKEvent(this.ndk, {
      kind: 14,
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]], // Reference recipient
      content: encodedContent
    })

    // Step 2: Encrypt the kind:14 event using NIP-44
    console.log("DEBUGPRINT[35]: nostr.ts:85 (after // Step 2: Encrypt the kind:14 event usi…)")
    await kind14Event.encrypt(recipientUser, signer)

    // Create sealed kind:13 event
    const kind13Event = new NDKEvent(this.ndk, {
      kind: 13,
      pubkey: ourPubkey,
      created_at: Date.now(),
      tags: [],
      content: kind14Event.content
    })

    // Sign kind:13 event
    console.log("DEBUGPRINT[36]: nostr.ts:98 (after // Sign kind:13 event)")
    await kind13Event.sign(signer)
    await kind13Event.encrypt(recipientUser, signer)

    // Step 3: Create kind:1059 gift-wrap event for recipient
    console.log("DEBUGPRINT[37]: nostr.ts:103 (after // Step 3: Create kind:1059 gift-wrap ev…)")
    const kind1059Event = new NDKEvent(this.ndk, {
      kind: 1059,
      pubkey: ourPubkey,
      created_at: Date.now(),
      tags: [['p', recipientPubkey]], // Recipient's pubkey
      content: JSON.stringify(await kind13Event.toNostrEvent())
    })
    await kind1059Event.sign(signer)

    // Step 5: Publish events
    console.log("DEBUGPRINT[38]: nostr.ts:114 (after // Step 5: Publish events)")
    console.log('all right until now')
    await kind1059Event.publish()
    console.log('Recipient gift-wrap published successfully')
  }

  async fetchMessages(
    secretNostrKey: Uint8Array,
    recipientNpub: string,
    since?: number,
    limit: number = 3
  ): Promise<NostrMessage[]> {
    await this.connect()
    if (!this.ndk) throw new Error('Failed to connect to relays')

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
