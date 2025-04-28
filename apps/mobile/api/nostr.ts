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
    // Decode the nsec
    const { type, data: secretNostrKey } = nip19.decode(nsec)

    // Check if the decoded type is 'nsec'
    if (type !== 'nsec') {
      throw new Error('Input is not a valid nsec')
    }

    // Validate inputs
    if (!secretNostrKey || secretNostrKey.length !== 32) {
      throw new Error('Invalid secretNostrKey: must be a 32-byte Uint8Array');
    }
    if (!recipientNpub) {
      throw new Error('Invalid recipientNpub: must be a non-empty string');
    }

    // Validate npub or hex format
    const isNpub = recipientNpub.startsWith('npub') && recipientNpub.length === 63 && /^[a-z0-9]+$/.test(recipientNpub);
    const isHex = /^[0-9a-f]{64}$/.test(recipientNpub);
    if (!isNpub && !isHex) {
      throw new Error(
        'Invalid recipientNpub: must be a valid npub (63 characters, lowercase) or 64-character hex public key'
      );
    }
    console.log('Input recipientNpub:', recipientNpub);

    // Connect to relays
    await this.connect();
    if (!this.ndk) throw new Error('Failed to connect to relays');
    console.log('Connected to relays:', Array.from(this.ndk.pool.relays.keys()));

    // Convert secretNostrKey (Uint8Array) to hex string
    const secretNostrKeyHex = Buffer.from(secretNostrKey).toString('hex');
    const ourPubkey = getPublicKey(secretNostrKeyHex);
    console.log('Sender pubkey:', ourPubkey);

    // Decode recipient's npub or use hex directly
    let recipientPubkey: string;
    if (isNpub) {
      try {
        const { data } = nip19.decode(recipientNpub) as { data: string };
        recipientPubkey = data;
        if (!/^[0-9a-f]{64}$/.test(recipientPubkey)) {
          throw new Error('Decoded recipientPubkey is not a valid 64-character hex string');
        }
        console.log('Decoded recipientPubkey:', recipientPubkey);
      } catch (error) {
        console.error('Failed to decode recipientNpub:', error);
        throw new Error('Invalid recipientNpub (checksum error): ' + error.message);
      }
    } else {
      recipientPubkey = recipientNpub; // Use hex directly
      console.log('Using recipientPubkey as hex:', recipientPubkey);
    }

    // Create NDKUser for recipient
    console.log('create recipient user')
    const recipientUser = new NDKUser({
      npub: recipientPubkey,
      relayUrls: this.relays
    });
    console.log('created')
    console.log('Recipient user created:', recipientUser.npub);
    recipientUser.ndk = this.ndk;

    // Ensure proper encoding before encryption
    const encodedContent = unescape(encodeURIComponent(content));

    // Create signer
    console.log('creating signer', secretNostrKeyHex)
    const signer = new NDKPrivateKeySigner(secretNostrKeyHex);
    if (!signer) throw new Error('Failed to create NDKPrivateKeySigner');
    console.log('Signer created');

    // Step 1: Create the kind:14 chat message event
    const kind14Event = new NDKEvent(this.ndk, {
      kind: 14,
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [], // Temporarily remove p tag to test checksum issue
      content: encodedContent,
    });

    // Debug: Log event before encryption
    console.log('Kind:14 event before encryption:', await kind14Event.toNostrEvent());

    // Encrypt kind:14 event using NIP-44
    try {
      await kind14Event.encrypt(recipientUser, signer);
      console.log('Kind:14 event encrypted successfully, content:', kind14Event.content);
    } catch (error) {
      console.error('Encryption failed for kind:14:', error, error.stack);
      // Fallback: Use nostr-tools nip44.encrypt
      console.log('Attempting fallback encryption with nostr-tools nip44');
      try {
        const conversationKey = nip44.getConversationKey(secretNostrKeyHex, recipientPubkey);
        const encryptedContent = nip44.encrypt(encodedContent, conversationKey);
        kind14Event.content = encryptedContent;
        console.log('Fallback encryption successful, content:', kind14Event.content);
      } catch (fallbackError) {
        console.error('Fallback encryption failed:', fallbackError);
        throw new Error('Failed to encrypt kind:14 event (both NDK and fallback): ' + error.message);
      }
    }

    // Step 2: Create sealed kind:13 event
    const kind13Event = new NDKEvent(this.ndk, {
      kind: 13,
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 172800), // Randomize timestamp
      tags: [['p', recipientPubkey]], // Add p tag here for NIP-17 compatibility
      content: kind14Event.content, // Use encrypted content from kind:14
    });

    // Sign kind:13 event
    try {
      await kind13Event.sign(signer);
      console.log('Kind:13 event signed successfully');
    } catch (error) {
      console.error('Signing failed for kind:13:', error);
      throw new Error('Failed to sign kind:13 event: ' + error.message);
    }

    // Step 3: Create kind:1059 gift-wrap event for recipient
    const kind1059Event = new NDKEvent(this.ndk, {
      kind: 1059,
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 172800),
      tags: [['p', recipientPubkey]], // Recipient's pubkey
      content: JSON.stringify(await kind13Event.toNostrEvent()),
    });

    try {
      await kind1059Event.sign(signer);
      console.log('Kind:1059 event (recipient) signed successfully');
    } catch (error) {
      console.error('Signing failed for kind:1059 (recipient):', error);
      throw new Error('Failed to sign kind:1059 event (recipient): ' + error.message);
    }

    // Step 4: Optionally create a copy for the sender (for backup)
    const senderKind1059Event = new NDKEvent(this.ndk, {
      kind: 1059,
      pubkey: ourPubkey,
      created_at: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 172800),
      tags: [['p', ourPubkey]], // Sender's pubkey
      content: JSON.stringify(await kind13Event.toNostrEvent()),
    });

    try {
      await senderKind1059Event.sign(signer);
      console.log('Kind:1059 event (sender) signed successfully');
    } catch (error) {
      console.error('Signing failed for kind:1059 (sender):', error);
      throw new Error('Failed to sign kind:1059 event (sender): ' + error.message);
    }

    // Step 5: Publish events
    try {
      await kind1059Event.publish();
      console.log('Recipient gift-wrap published successfully');
      await senderKind1059Event.publish();
      console.log('Sender gift-wrap published successfully');
    } catch (error) {
      console.error('Error publishing events:', error);
      throw new Error('Failed to publish events: ' + error.message);
    }
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
